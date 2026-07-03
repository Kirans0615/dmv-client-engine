// Mockup request proxy — holds the GitHub token server-side (env GITHUB_MOCKUP_TOKEN)
// so the public dashboard never ships credentials.
// POST  -> uploads assets + files the mockup issue, returns {issue}
// GET ?issue=N -> polls the issue for Claude's completion comment

const REPO = "Kirans0615/dmv-client-engine";
const ALLOWED_ORIGINS = [
  "https://kirans0615.github.io",
  "http://localhost:8471", // local testing
];

async function gh(path, opts = {}) {
  const r = await fetch("https://api.github.com" + path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_MOCKUP_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "dmv-client-engine-proxy",
      ...(opts.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${body.message || path}`);
  return body;
}

const clip = (s, n) => String(s || "").slice(0, n);

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: "origin not allowed" });

  try {
    if (req.method === "GET") {
      const issue = parseInt(req.query.issue, 10);
      if (!issue) return res.status(400).json({ error: "issue required" });
      const comments = await gh(`/repos/${REPO}/issues/${issue}/comments`);
      const done = comments.find((c) => c.body && c.body.includes("✅ Mockup live:"));
      const failed = comments.find((c) => c.body && c.body.includes("❌ Mockup failed"));
      if (done) {
        const m = done.body.match(/https:\/\/[^\s)]+/);
        return res.json({ status: "done", url: m ? m[0] : null, message: done.body.slice(0, 300) });
      }
      if (failed) return res.json({ status: "failed", message: failed.body.slice(0, 300) });
      return res.json({ status: "working" });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      const name = clip(b.name, 120), type = clip(b.type, 120);
      if (!name || !type) return res.status(400).json({ error: "name and type required" });
      const assets = Array.isArray(b.assets) ? b.assets.slice(0, 4) : [];
      const reqId = "req-" + Date.now();
      const assetPaths = [];
      for (const a of assets) {
        const fname = String(a.name || "").replace(/[^a-z0-9.]/gi, "").slice(0, 40);
        const content = String(a.b64 || "");
        if (!fname || !content || content.length > 3_000_000) continue; // ~2MB file cap
        const path = `mockup-requests/${reqId}/${fname}`;
        await gh(`/repos/${REPO}/contents/${path}`, {
          method: "PUT",
          body: JSON.stringify({ message: "Mockup request asset", content }),
        });
        assetPaths.push(path);
      }
      const body = [
        `Business: ${name} — ${type}${b.loc ? `, in ${clip(b.loc, 120)}` : ""}`,
        b.contact ? `Contact to show on the site: ${clip(b.contact, 200)}` : "No contact info provided — use tasteful placeholders.",
        b.desc ? `About them: ${clip(b.desc, 2000)}` : "",
        b.features ? `Requested features: ${clip(b.features, 1000)}` : "No specific features requested — choose the right ones for this business.",
        b.style ? `Style hints: ${clip(b.style, 300)}` : "",
        assetPaths.length
          ? `Assets folder: mockup-requests/${reqId}/ (${assetPaths.length} file(s); logo.png is the logo if present)`
          : "No images provided.",
        b.stock === false ? "Stock imagery: no — design without stock photos." : "Stock imagery: yes — source real photos (and a hero video if available).",
      ].filter(Boolean).join("\n");
      const issue = await gh(`/repos/${REPO}/issues`, {
        method: "POST",
        body: JSON.stringify({ title: `Mockup: ${name}`, body, labels: ["mockup"] }),
      });
      return res.json({ issue: issue.number });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
