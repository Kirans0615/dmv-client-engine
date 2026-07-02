# DMV Client Engine

A two-sided client acquisition system for a DMV-area web designer:

| File | Audience | What it does |
|------|----------|--------------|
| `index.html` | **Clients** (public) | Marketing site with the demo-first offer: "see your website before you pay a dollar." Free-draft request form, pricing, GovCon niche, local SEO markup. |
| `dashboard.html` | **You** (private — `noindex`, don't link to it) | Lead engine pulling **live data**: DC businesses licensed in the last N days + DMV businesses with no website on record. Pipeline tracker, outreach generator, CSV export. |
| `config.js` | You | Name, brand, email, pricing, Formspree ID — edit once, both pages update. |

## Mockup Studio (dashboard tab)

Generates a client-ready website mockup with Claude and publishes it to GitHub Pages in one click — the engine behind the demo-first outreach strategy. Enter a brief (name, type, description, requested features), optionally a logo + up to 3 photos (Claude matches the logo's palette and uses the photos in the design), and it streams back a complete single-file site built to a baked-in design system (distinctive typography, accessible contrast, scroll animations, mobile-first, conversion-focused sections chosen per business type). Preview in-tab, then Publish creates the repo, pushes `index.html` + assets, enables Pages, waits for the build, and files the mockup under Completed Sites.

One-time setup in the tab's "Keys & model" panel: an Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) and a fine-grained GitHub token with Administration + Contents + Pages read/write. Keys live only in your browser's localStorage. Default model is Claude Opus 4.8; Fable 5 (with automatic Opus fallback on refusals) and Sonnet 5 are selectable. A full generation costs roughly $0.50–$2 in API usage depending on model and length.

## Data sources (all free, no API keys)

- **New DC businesses** — official DLCP Basic Business License feed
  (`maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/DCRA/FeatureServer/0`, via opendata.dc.gov, CC-BY 4.0, refreshed daily). Filters to Active/Open/Pending licenses by initial issue date; rentals/housing licenses hidden by default.
- **No-website businesses** — compiled from **Overture Maps places** (`scripts/fetch_leads.py`), the open dataset aggregating Meta/Facebook and Microsoft business listings. A lead is kept only if it has **no website anywhere in that data**, has a **phone or email**, is not a chain, is high-confidence (≥0.7) and open, and its obvious domain (`business-name.com`) was probed and serves nothing about it. The dashboard reads the pre-compiled snapshots in `data/leads-*.json`; a GitHub Action re-compiles them every Monday (`pip install overturemaps && python3 scripts/fetch_leads.py` to refresh manually). Live OpenStreetMap is only a fallback for local-file use and is unverified. Still click **Check** before outreach — no dataset is perfect.
- **Virginia & Maryland new registrations** — no free API; the *More Sources* tab links the official search portals (VA SCC CIS, MD Business Express) with a 5-minute weekly routine.

Pipeline data is stored in the browser's `localStorage`. Export CSV weekly as backup — clearing browser data wipes the pipeline.

## Zero setup required

Both pages work by double-clicking them — no server, no accounts, no build step:

- **Dashboard:** open `dashboard.html` in your browser and pull leads immediately.
- **Marketing site:** open `index.html` to preview. The contact form works out of the box: it opens the visitor's email app pre-filled to you.

Optional upgrades, whenever you feel like it (all in `config.js`):
- Add your phone / portfolio / Calendly links.
- Swap the mailto form for a real one: free form at [formspree.io](https://formspree.io), paste the ID into `formspreeId`.
- Deploy `index.html` + `config.js` to GitHub Pages / Vercel and put a real `.com` on it — that's when the marketing site starts earning inbound leads. `dashboard.html` can stay local (it's `noindex` either way; the pipeline lives in whichever browser you use).

## The weekly playbook (~3 hours total)

**Monday (30 min) — pull leads.**
Dashboard → *New DC Licenses* (last 14 days, hide rentals) and *No-Website Businesses* (rotate area + category weekly). 🔎-check ~15 candidates, set the best 5–8 to any status to save them to the pipeline. Then 5 min each on the VA SCC and MD Business Express portals (*More Sources* tab).

**Tue–Wed (90 min) — build demos.**
One-page homepage mockup per lead, hosted at a preview URL. This is the differentiator: nobody else does this because it's "too much work" — with AI assistance it's ~15 minutes per demo.

**Thursday (30 min) — send.**
Open ✉ Outreach on each lead, paste the demo link over `[DEMO LINK]`, send email or SMS. For the 2 best leads, walk in with the demo on your phone (script included). Mark everyone *Contacted*.

**Friday (30 min) — follow up + network.**
Pipeline tab flags anyone contacted 5+ days ago with no reply — send the one-line follow-up ("Any thoughts on the design? Happy to tweak it."). One networking event or referral-partner coffee per week (accountants, insurance brokers, SBDC advisors, chamber events).

**Math:** 6 demos/week ≈ 25/month. At a conservative 10% close rate on demo-first outreach, that's 2–3 new clients/month; at $149/mo care plans, ~20 clients ≈ $36k/yr recurring by year one.

## Deploy (GitHub Pages)

```bash
cd ~/dmv-client-engine
gh repo create dmv-client-engine --private --source=. --push
# then enable Pages on main branch in repo settings, or deploy to Vercel:
# vercel --prod
```
