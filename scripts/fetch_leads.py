#!/usr/bin/env python3
"""Compile verified no-website business leads for the DMV Client Engine dashboard.

Source: Overture Maps places (aggregates Meta/Facebook + Microsoft business data).
A lead is kept only when ALL of these hold:
  - no website listed anywhere in Overture's aggregated data
  - has a real contact channel: phone or email (social link shown as a bonus)
  - not a chain (no brand record)
  - operating and high-confidence (>= 0.7)
  - its obvious domain (business-name.com) does not serve a page mentioning it

Writes data/leads-<area>-<category>.json in the shape dashboard.html reads.
Run: pip install overturemaps && python3 scripts/fetch_leads.py
"""
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

BBOX = {  # west,south,east,north (overturemaps CLI order)
    "dc":      "-77.12,38.80,-76.90,39.00",
    "arlalex": "-77.20,38.79,-77.03,38.93",
    "fairfax": "-77.40,38.70,-77.15,38.95",
    "moco":    "-77.25,38.95,-76.95,39.12",
    "pg":      "-77.00,38.80,-76.75,39.05",
    "loudoun": "-77.60,38.95,-77.35,39.15",
}

# dashboard category key -> (label, predicate over overture category string)
CAT_RULES = {
    "food":     ("Restaurant / café",   re.compile(r"restaurant|cafe|coffee|bakery|ice_cream|(^|_)deli($|_)|diner|pizza|food_truck|juice|bubble_tea|sandwich|caterer")),
    "beauty":   ("Salon / barber",      re.compile(r"salon|barber|beauty|nail|(^|_)spa(s)?($|_)|braid|lash|esthetic")),
    "auto":     ("Auto services",       re.compile(r"automotive|auto_|car_repair|car_wash|tire|oil_change|auto_glass|car_detail")),
    "health":   ("Health practice",     re.compile(r"dentist|dental|doctor|medical|clinic|chiropract|physical_therapy|optometr|acupunctur|pediatric|dermatolog")),
    "cleaning": ("Cleaning / laundry",  re.compile(r"laundr|dry_clean|cleaning")),
    "fitness":  ("Gym / fitness",       re.compile(r"gym|fitness|yoga|pilates|martial_arts|crossfit|personal_train|dance_school")),
    "retail":   ("Retail shop",         re.compile(r"store$|store_|boutique|florist|jewel|gift_shop|bookstore|shop$")),
    "trades":   ("Contractor / trades", re.compile(r"contractor|plumb|electrician|hvac|heating|roofing|landscap|remodel|handyman|painting_|carpent|masonry|paving|fencing|tree_service|pest_control|locksmith|moving_company")),
}

MAX_PER_COMBO = 100
MIN_CONFIDENCE = 0.7


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("&", "and"))


def has_obvious_website(name: str) -> bool:
    """Probe business-name.com; drop lead if the page actually mentions the name."""
    slug = norm(name)
    if not 4 <= len(slug) <= 40:
        return False
    try:
        req = urllib.request.Request(
            f"https://{slug}.com",
            headers={"User-Agent": "Mozilla/5.0 (Macintosh) dmv-client-engine/2.0"})
        with urllib.request.urlopen(req, timeout=6) as r:
            body = r.read(60000).decode("utf-8", "ignore")
        return slug in re.sub(r"[^a-z0-9]", "", body.lower())
    except Exception:
        return False


def download_area(area: str, bbox: str, dest: Path) -> None:
    print(f"[{area}] downloading Overture places for bbox {bbox} …", flush=True)
    subprocess.run(
        [sys.executable, "-m", "overturemaps", "download",
         f"--bbox={bbox}", "-f", "geojsonseq", "--type=place", "-o", str(dest)],
        check=True)


def parse_leads(path: Path):
    """Yield (category_key, lead) for qualifying places."""
    seen = set()
    with open(path) as f:
        for line in f:
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            try:
                feat = json.loads(line)
            except json.JSONDecodeError:
                continue
            p = feat.get("properties", {})
            if p.get("websites"):
                continue                      # has a website — not a lead
            if p.get("brand"):
                continue                      # chain
            if (p.get("confidence") or 0) < MIN_CONFIDENCE:
                continue
            if p.get("operating_status") not in (None, "open"):
                continue
            phones = p.get("phones") or []
            emails = p.get("emails") or []
            socials = p.get("socials") or []
            if not phones and not emails:
                continue                      # need a direct contact channel
            name = (p.get("names") or {}).get("primary") or ""
            if not name:
                continue
            cat = (p.get("categories") or {}).get("primary") or ""
            matched = next((k for k, (_, rx) in CAT_RULES.items() if rx.search(cat)), None)
            if not matched:
                continue
            addr = ""
            if p.get("addresses"):
                a = p["addresses"][0]
                addr = " ".join(x for x in [a.get("freeform"), a.get("locality")] if x)
            key = (norm(name), addr[:20])
            if key in seen:
                continue
            seen.add(key)
            coords = (feat.get("geometry") or {}).get("coordinates") or [None, None]
            yield matched, {
                "id": (feat.get("id") or p.get("id") or norm(name))[:40],
                "name": name,
                "cuisine": cat.replace("_", " "),
                "addr": addr,
                "phone": phones[0] if phones else "",
                "email": emails[0] if emails else "",
                "social": socials[0] if socials else "",
                "conf": round(p.get("confidence") or 0, 2),
                "lat": coords[1], "lon": coords[0],
                "verified": 1,
            }


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    failures = 0
    for area, bbox in BBOX.items():
        with tempfile.NamedTemporaryFile(suffix=".geojsonseq", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            download_area(area, bbox, tmp_path)
            buckets = {k: [] for k in CAT_RULES}
            for cat_key, lead in parse_leads(tmp_path):
                buckets[cat_key].append(lead)
            for cat_key, leads in buckets.items():
                leads.sort(key=lambda l: (-bool(l["phone"]), -l["conf"]))
                leads = leads[: MAX_PER_COMBO * 2]
                # final belt-and-suspenders: drop leads whose obvious .com exists
                with ThreadPoolExecutor(max_workers=8) as ex:
                    checks = list(ex.map(lambda l: has_obvious_website(l["name"]), leads))
                dropped = sum(checks)
                leads = [l for l, has in zip(leads, checks) if not has][:MAX_PER_COMBO]
                out = DATA_DIR / f"leads-{area}-{cat_key}.json"
                out.write_text(json.dumps(
                    {"updated": datetime.now(timezone.utc).isoformat(), "leads": leads}))
                print(f"[{area}] {cat_key}: {len(leads)} leads (domain-probe dropped {dropped})", flush=True)
        except Exception as e:  # keep previous snapshot for this area on failure
            failures += 1
            print(f"[{area}] FAILED: {e} — keeping previous snapshots", flush=True)
        finally:
            tmp_path.unlink(missing_ok=True)
    (DATA_DIR / "manifest.json").write_text(
        json.dumps({"updated": datetime.now(timezone.utc).isoformat(), "source": "overture"}))
    print("Done." + (f" ({failures} area(s) failed)" if failures else " All areas refreshed."))
    sys.exit(1 if failures == len(BBOX) else 0)


if __name__ == "__main__":
    main()
