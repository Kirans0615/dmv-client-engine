# DMV Client Engine

A two-sided client acquisition system for a DMV-area web designer:

| File | Audience | What it does |
|------|----------|--------------|
| `index.html` | **Clients** (public) | Marketing site with the demo-first offer: "see your website before you pay a dollar." Free-draft request form, pricing, GovCon niche, local SEO markup. |
| `dashboard.html` | **You** (private — `noindex`, don't link to it) | Lead engine pulling **live data**: DC businesses licensed in the last N days + DMV businesses with no website on record. Pipeline tracker, outreach generator, CSV export. |
| `config.js` | You | Name, brand, email, pricing, Formspree ID — edit once, both pages update. |

## Data sources (all free, no API keys)

- **New DC businesses** — official DLCP Basic Business License feed
  (`maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/DCRA/FeatureServer/0`, via opendata.dc.gov, CC-BY 4.0, refreshed daily). Filters to Active/Open/Pending licenses by initial issue date; rentals/housing licenses hidden by default.
- **No-website businesses** — OpenStreetMap: named businesses in DMV bounding boxes with no `website`/`contact:website` tag. The dashboard loads these from **pre-fetched snapshots in `data/`** (instant, immune to Overpass rate-limiting); a GitHub Action (`.github/workflows/refresh-leads.yml`) re-fetches them every Monday morning, and you can refresh manually anytime with `node scripts/fetch-osm.js` or the workflow's "Run workflow" button. Live Overpass is only used as a fallback when no snapshot is available (e.g. opened as a local file). OSM data is incomplete, so **always click 🔎 Check before outreach** — the ones with a phone number and no site anywhere on Google are your strongest leads.
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
