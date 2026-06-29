# CLAUDE.md — ProcessIQ

AI-driven AR Collections process-transformation accelerator. Mirrors the FinTran/CloseIQ
build pattern: edit sources in `src/`, run the Python build, serve `public/`.

## Build

```
python scripts/build.py
python -m http.server 3000 --directory public
```

Then open http://localhost:3000/ (landing) or http://localhost:3000/processiq.html (cockpit).

`build.py` regenerates the data (`build_patterns.py`, `build_portfolio.py`) and inlines
CSS + data + engine + UI into a single self-contained `public/processiq.html`.

## NEVER edit `public/`

Generated. All edits go to `src/` (or the `scripts/` generators).

## Source map

| File | Purpose |
|------|---------|
| `AR_Pattern_Library_v2_Complete.xlsx` | Master pattern library (31 patterns) — source of truth |
| `scripts/build_patterns.py` | Parses the xlsx → `src/data/patterns.json` (branching DAGs, HITL gates) |
| `scripts/build_portfolio.py` | Generates synthetic `src/data/portfolio.json` (invoices + event timelines) |
| `scripts/build_roi.py` | Generates `src/data/roi.json` (KPIs, outcomes, trajectory, attribution) |
| `scripts/build_discovery.py` | Generates `src/data/discovery.json` (anomaly scatter, clusters, candidate) |
| `src/js/engine.js` | Cognitive engine — Sense→Diagnose→Decide→Act, on-device, deterministic |
| `src/js/shell.js` | Platform shell — `window.PIQ` state, top-nav module router, ERP toggle |
| `src/js/provocation.js` | Module 1 — The Provocation (scrollytelling intro) |
| `src/js/library.js` | Module 2 — Pattern Library (filterable master-detail) |
| `src/js/cockpit.js` | Module 3 — Cognitive Cockpit UI render logic |
| `src/js/governance.js` | Module 4 — Action & Governance (trust modes + Saga simulator) |
| `src/js/discovery.js` | Module 5 — Discovery Engine (math→text→LLM pipeline) |
| `src/js/roi.js` | Module 6 — ROI & Attribution |
| `src/css/app.css` | Tiger brand theme (all modules) |
| `src/html/cockpit_body.html` | Platform shell markup (topbar nav + #view) |
| `src/apps/index.html` | Platform landing page |
| `scripts/build.py` | Regenerates data + assembles everything → `public/processiq.html` |

## Status

**All 6 deck modules are live**, hosted in the shell with a top-nav router (default view:
The Provocation). The build inlines the shell + engine + all six modules + four data files
into one self-contained `public/processiq.html` (~210 KB). Optional future work: a live-Claude
diagnosis layer on the cockpit (the deterministic engine stays the source of truth).

## Provenance

Deck: `Beyond_Efficiency_AI_Process_Transformation_v2.pptx`.
Each engine feature (`featureSlug`) maps 1:1 to a Layer-3 AI Feature in the xlsx.
The deck claims "50+ patterns"; the library currently holds 31 — the Discovery Engine
module is where #32+ get surfaced and SME-approved.
