#!/usr/bin/env node
// Pre-fetches "no website" business leads from Overpass for every area/category
// combo into data/*.json, so the dashboard never depends on Overpass at click-time.
// Run locally (node scripts/fetch-osm.js) or via the refresh-leads GitHub Action.
"use strict";
const fs = require("fs");
const path = require("path");

const BBOX = { // south,west,north,east — keep in sync with dashboard.html
  dc:      "38.80,-77.12,39.00,-76.90",
  arlalex: "38.79,-77.20,38.93,-77.03",
  fairfax: "38.70,-77.40,38.95,-77.15",
  moco:    "38.95,-77.25,39.12,-76.95",
  pg:      "38.80,-77.00,39.05,-76.75",
  loudoun: "38.95,-77.60,39.15,-77.35",
};
const CATS = {
  food:    ['node["amenity"~"^(restaurant|cafe|fast_food)$"]','way["amenity"~"^(restaurant|cafe|fast_food)$"]'],
  beauty:  ['node["shop"~"^(hairdresser|beauty)$"]','way["shop"~"^(hairdresser|beauty)$"]'],
  auto:    ['node["shop"="car_repair"]','way["shop"="car_repair"]'],
  health:  ['node["amenity"~"^(dentist|clinic|doctors)$"]','way["amenity"~"^(dentist|clinic|doctors)$"]'],
  cleaning:['node["shop"~"^(laundry|dry_cleaning)$"]','way["shop"~"^(laundry|dry_cleaning)$"]'],
  fitness: ['node["leisure"="fitness_centre"]','way["leisure"="fitness_centre"]'],
  retail:  ['node["shop"~"^(clothes|convenience|gift|florist|furniture|jewelry|shoes|books)$"]','way["shop"~"^(clothes|convenience|gift|florist|furniture|jewelry|shoes|books)$"]'],
};
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const FILTERS = '["name"][!"website"][!"contact:website"]';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function query(bbox, sels) {
  const q = `[out:json][timeout:60];(${sels.map(s => s + FILTERS + `(${bbox});`).join("")});out center 200;`;
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      const r = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(q),
        // overpass-api.de returns 406 to clients without a real User-Agent
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "dmv-client-engine/1.0 (github.com/Kirans0615/dmv-client-engine)" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()).elements || [];
    } catch (e) {
      lastErr = e;
      console.log(`    retry ${attempt + 1} (${e.message})`);
      await sleep(15000 * (attempt + 1));
    }
  }
  throw lastErr;
}

function slim(el) {
  const t = el.tags || {};
  return {
    id: el.type + el.id,
    name: t.name,
    cuisine: t.cuisine || "",
    addr: [t["addr:housenumber"], t["addr:street"], t["addr:city"]].filter(Boolean).join(" "),
    phone: t.phone || t["contact:phone"] || "",
    lat: el.lat || (el.center && el.center.lat) || null,
    lon: el.lon || (el.center && el.center.lon) || null,
  };
}

(async () => {
  const outDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(outDir, { recursive: true });
  let failures = 0;
  for (const [areaKey, bbox] of Object.entries(BBOX)) {
    for (const [catKey, sels] of Object.entries(CATS)) {
      const file = path.join(outDir, `osm-${areaKey}-${catKey}.json`);
      process.stdout.write(`${areaKey}/${catKey}… `);
      try {
        const els = (await query(bbox, sels)).filter(e => e.tags && e.tags.name).map(slim);
        els.sort((a, b) => (b.phone ? 1 : 0) - (a.phone ? 1 : 0));
        fs.writeFileSync(file, JSON.stringify({ updated: new Date().toISOString(), leads: els }));
        console.log(`${els.length} leads`);
      } catch (e) {
        failures++;
        console.log(`FAILED (${e.message})` + (fs.existsSync(file) ? " — keeping previous snapshot" : ""));
      }
      await sleep(3000); // be polite: one query at a time, gap between
    }
  }
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ updated: new Date().toISOString() }));
  console.log(failures ? `Done with ${failures} failures (previous snapshots kept).` : "Done — all combos refreshed.");
  process.exit(failures === Object.keys(BBOX).length * Object.keys(CATS).length ? 1 : 0);
})();
