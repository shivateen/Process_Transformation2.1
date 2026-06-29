# CLAUDE.md — Process Transformation Accelerator

A **function-agnostic** process-transformation accelerator. A business SME drives a
three-stage journey — **Design → Discover & Fit → Run & Govern** — to compose, agentivise,
and operate a process. Order-to-Cash (AR Collections, 31 patterns) is fully built; P2P, R2R,
HR Onboarding and Supply Chain ship as samples that prove the framework generalises.

Mirrors the FinTran/CloseIQ build pattern: edit sources in `src/`, run the Python build,
serve `public/`. (The single-file output is still `public/processiq.html`.)

## The journey (top-level IA)

Two-level nav: 3 **stages** (top) × **sub-views** (second row), driven by `window.PIQ`.

1. **Design** — Studio wizard (Function→Process→Role→Objective→Patterns→Action-block config)
   + Pattern Library. Output: a `PIQ.composition` (selected patterns + configured blocks).
2. **Discover & Fit** — Agent Fitment (per-block verdict + happy-path agentivisation + to-be
   flow) + Discovery Engine.
3. **Run & Govern** — Live Operations (STP on the happy path; variations matched to patterns
   → DAG approval) + Cognitive Cockpit + Governance + ROI.

The data model already encodes the mental model: each pattern's `originalDAG` = happy path,
`branchingDAG` = variation branches, `hitlGates` = the approval sought before a branch runs.

## Build

```
python scripts/build.py
python -m http.server 3000 --directory public
```

Then open http://localhost:3000/ (landing) or http://localhost:3000/processiq.html (accelerator).

`build.py` regenerates the data and inlines CSS + data + engine + UI into a single
self-contained `public/processiq.html`.

## NEVER edit `public/`

Generated. All edits go to `src/` (or the `scripts/` generators).

## Source map

| File | Purpose |
|------|---------|
| `AR_Pattern_Library_v2_Complete.xlsx` | Master pattern library (31 patterns) — source of truth |
| `scripts/build_patterns.py` | Parses the xlsx → `src/data/patterns.json` (branching DAGs, HITL gates) |
| `scripts/build_taxonomy.py` | Generates `src/data/taxonomy.json` — the generic Function→Process→Role→Objective spine. AR mapped to the real 31 patterns; 4 sample functions carry self-contained `stubPatterns` |
| `scripts/build_portfolio.py` | Generates synthetic `src/data/portfolio.json` (invoices + event timelines) |
| `scripts/build_roi.py` | Generates `src/data/roi.json` (KPIs, outcomes, trajectory, attribution) |
| `scripts/build_discovery.py` | Generates `src/data/discovery.json` (anomaly scatter, clusters, candidate) |
| `src/js/engine.js` | Cognitive engine — Sense→Diagnose→Decide→Act, on-device, deterministic |
| `src/js/shell.js` | Platform shell — `window.PIQ` state, **two-level journey router** (3 stages × sub-views), `composition` state, ERP toggle, cross-pattern helpers (`PIQ.pattern`, `PIQ.collectBlocks`, `PIQ.fitment`, `PIQ.go`) |
| `src/js/studio.js` | **Stage 1 · Design** — Studio wizard (F→P→R→O→Patterns→Action-block config) |
| `src/js/fitment.js` | **Stage 2 · Discover & Fit** — agent-fitment table + happy-path agentivisation + to-be flow |
| `src/js/runtime.js` | **Stage 3 · Run & Govern** — live STP console; variation→pattern-match→DAG approval, live KPIs |
| `src/js/provocation.js` | The Provocation (scrollytelling intro; reachable via the topbar "Why" link) |
| `src/js/library.js` | Pattern Library (filterable master-detail) — Design sub-view |
| `src/js/cockpit.js` | Cognitive Cockpit UI render logic — Run & Govern sub-view |
| `src/js/governance.js` | Action & Governance (trust modes + Saga simulator) — Run & Govern sub-view |
| `src/js/discovery.js` | Discovery Engine (math→text→LLM pipeline) — Discover & Fit sub-view |
| `src/js/roi.js` | ROI & Attribution — Run & Govern sub-view |
| `src/css/app.css` | Tiger brand theme (all modules; new journey/Studio/Fit/Runtime styles appended at the end) |
| `src/html/cockpit_body.html` | Platform shell markup (topbar + `#subbar` + `#view`) |
| `src/apps/index.html` | Platform landing page |
| `scripts/build.py` | Regenerates data + assembles everything → `public/processiq.html` |

## Status

**The 3-stage journey is live.** Boots into the Studio (Stage 1). The build inlines the shell
+ engine + studio/fitment/runtime + the six legacy modules + five data files into one
self-contained `public/processiq.html` (~296 KB). Fitment verdicts and the runtime simulator
are deterministic (`PIQ.fitment`); nothing invents data. Optional future work: author full
pattern libraries for the sample functions; a live-Claude diagnosis layer on the cockpit.

## Provenance

Deck: `Beyond_Efficiency_AI_Process_Transformation_v2.pptx` — the three slide columns
(Upstream Missions→Actions / Current core Discovery / Downstream Process→Agentic workflow)
are the three journey stages. Each engine feature (`featureSlug`) maps 1:1 to a Layer-3 AI
Feature in the xlsx. The Discovery Engine is where pattern #32+ get surfaced and SME-approved.
