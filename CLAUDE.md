# CLAUDE.md — Process Transformation Accelerator

A **function-agnostic** process-transformation accelerator. A business SME drives a
three-stage journey — **Design → Discover & Fit → Run & Govern** — to compose, agentivise,
and operate a process. Order-to-Cash (AR Collections, 31 patterns) is fully built; P2P, R2R,
HR Onboarding and Supply Chain ship as samples that prove the framework generalises.

Mirrors the FinTran/CloseIQ build pattern: edit sources in `src/`, run the Python build,
serve `public/`. (The single-file output is still `public/processiq.html`.)

## Two surfaces (top-level IA)

The landing page offers exactly **two tiles**. Each opens the same single-page app with
`?persona=<id>`; `PIQ.persona` picks what the sidebar renders.

**Both surfaces navigate from the same vertical left sidebar** (`#sidebar`, `.sb-*` classes).
The old horizontal `#modnav` stage tabs and the `#subbar` second row are **gone** (`#subbar`
survives as a hidden stub only so a stale lookup can't null-ref). Every sidebar opens with a
**← Home** button back to the landing page. Below 900px the sidebar collapses to a ~56px
icon-only rail.

**The app is light-theme only.** There is no theme toggle, no `body.dark` class, and no dark
CSS — `setTheme`/`restoreTheme`/`persistTheme` and every `body.dark` rule have been deleted.
The **"Why" link and the Provocation entry point are also removed**: `provocation.js` still
ships in the bundle but is unreachable — no sidebar entry, no link.

### The palette — cool neutral, one system

Every colour in the app resolves to a **token in `:root`** or to a step on one of seven shared
ramps (gray · orange · amber · green · red · blue · violet). There are no hand-mixed one-off
tints left; a stray hex is a bug. The chrome (topbar + sidebar) is near-black `--brand:#111219`,
the canvas is `--bg:#f5f6f8`, and **Tiger orange `--accent:#f47a1e` is the only brand colour**,
reserved for the accent rail, the logo mark and selected state. Status is always
`--med` green / `--high` amber / `--crit` red — never improvised.

The topbar is a fixed **52px** row; `--topbar-h` drives the sticky sidebar, the Command Centre
tab bar and every full-height pane. Change it in one place.

**Type is DM Sans + JetBrains Mono, base64-embedded** into the single-file output by
`font_css()` in `build.py` (reading `src/fonts/*.woff2`). There is deliberately **no Google
Fonts `<link>`** — the accelerator must render correctly from `file://` with no network. Adding
a font means dropping a woff2 in `src/fonts/` and appending to `FONT_FACES`.

Per-function accents (`build_taxonomy.py`) are a **categorical** set — ten distinct hues, one
per function, O2C taking Tiger orange. They must stay distinguishable side by side, so check
for collisions when adding a function.

There are **no numbered stage badges** anywhere in the nav — order is carried by the stacking.

### 1 · Transformation Builder (`?persona=builder`, the default)

Compose the process end-to-end. The sidebar stacks four collapsible stage groups, each with
its sub-views. The breadcrumb sits at the top of the working area (`#workcrumb`), not in the
nav. A status dot per stage (`PIQ.stageStatus` → `todo` / `wip` / `done`) is read off the
composition.

1. **Design** — Studio wizard (Theme→Function→Process→Role→Objective→Patterns→Action-block
   config) + **Pattern Studio**. Output: a `PIQ.composition`.
2. **Discover & Fit** — Agent Fitment (per-block verdict + happy-path agentivisation + to-be
   flow) + Discovery Engine.
3. **Build** — Build Engine (assembles configured blocks into validated agent chains).
4. **Run & Govern** — Live Operations (STP on the happy path; variations matched to patterns
   → DAG approval) + Cognitive Cockpit + Governance + ROI.

### 2 · Command Centre (`?persona=command`)

The consumption surface — the inverse of the Builder: outcomes first, patterns underneath.
It is **not a generic dashboard builder**. It is a projection of the **CFO Mission-Capability
Taxonomy**, which is the routing table for the whole surface:

| | |
|---|---|
| **8 L1 objectives** (A–H) | Total shareholder return · ROIC · Free cash flow · Cost of capital · Shareholder value · Tax · Finance function excellence · Risk & compliance |
| **21 L2 sub-objectives** | decompose each objective |
| **60 missions** (M1–M60) | the atomic units of accountability — each owned by one persona, at one cadence |
| **77 capabilities** (CAP-1…77) | the reusable widgets that power missions; many are shared (CAP-61 "Function cost benchmarking" serves 6 missions across 6 personas) |
| **11 personas** | CFO + 10 function roles, grouped into 4 areas |

Two derivations do all the work, and **the shell never guesses either**:

- **cadence → tab.** Daily/Weekly → Pulse · Fortnightly/Monthly → Intelligence · Ad hoc →
  Scenarios · Quarterly/Annual → Trajectory. A persona with no mission at a cadence has **no
  such tab** — Tax has no Daily/Weekly mission, so Tax has no Pulse tab and opens on
  Intelligence. `activeTabs` is computed in the generator.
- **capability → cross-reference.** `usedByMissions` / `usedByPersonas` are computed, never
  authored, so the Customize overlay can say "also used by Treasury, FP&A".

The sidebar has two states, driven by `PIQ.cc = { persona, tab, custom }` (owned by the shell;
`cfo.js` reads it and renders):

1. **Roster** — CFO first (badge = all 60 missions), then the 10 function personas grouped by
   Planning & Analysis / Treasury & Tax / Operations & Controls / Stakeholders & Strategy, each
   with a mission-count badge. Every persona is fully functional — no "coming soon" stubs.
2. **Inside a persona** — ⤺ Switch role, the persona's headline, its lenses (each badged with a
   mission count, empty ones omitted), and ⚙ Customize.

### The persona dashboard — two zones

`#view` renders every persona (and the CFO) as a **two-zone canvas**:

**Above the fold — the strategic command strip.** Four stacked components, no scrolling needed:

1. **Hero banner** — persona name, narrative headline, mission + capability counts, "as of".
2. **KPI scorecard** — 5–6 stat tiles. The **first is always mission health** (`X/Y on track`),
   the **last is always the automation ratio** (`X/Y agent covered`); the middle 2–4 are the
   persona's headline KPIs, **auto-derived** by walking their own missions Pulse-first and taking
   the first distinct capabilities' `metric`. Nothing is hardcoded per persona. The CFO instead
   gets the enterprise tiles (TSR / FCF conversion / cost of capital / working capital).
3. **Health heatmap** — one coloured block per mission, rows = lenses (rows = **objectives A–H**
   for the CFO, 60 blocks in total). Clicking a block switches to that lens and **smooth-scrolls
   to the mission card**, flashing it. Beside it, a 12-week "% missions on track" sparkline.
4. **Attention strip** — amber, and **only rendered when something is flagged**; names the top 3
   missions (with owning persona, on the CFO) and a "View all →" jump.

**Below the fold — mission detail.** A **sticky tab bar** (lenses + mission-count badges) pins
under the topbar on scroll. Mission cards carry: status dot, id + name, cadence badge, objective
breadcrumb (`Obj D · Market Risk`), agent-coverage chip, their embedded capability widgets, an
**action-context row** (`Last action` / `Next action`) and "View in Builder →". Flagged missions
**sort to the top** and get an amber/red left border. Clicking a card header **collapses** it to a
one-line summary for rapid scanning.

The **CFO owns no mission**, so below the fold it renders the roll-up instead: Pulse = the flagged
queue across all 60 missions, most severe first; Intelligence = the 8 objective tiles (A–H) with
health bars, their L2s and drill-through chips; Scenarios = cross-functional shocks (one shock
lands on missions across several personas); Trajectory = the 8-objective scorecard.

Every widget is a *kind* drawn generically from `capability.data.kind` (`series` / `gauge` /
`bars` / `list` / `table` / `heat` / `donut` / `funnel` / `waterfall`) — **a new persona is a
data change, never a UI change.** The Customize overlay browses the full 77-capability catalogue
grouped by objective (so an SME can pull a widget from *any* persona's missions), supports
drag-to-reorder, and persists to `localStorage` under `piq.cc.<personaId>.v1`. Capabilities added
from outside the persona's own missions collect in an "Added widgets" block. An empty layout is
honoured; "Reset to default" restores the taxonomy baseline.

`src/data/cfo.json` (and `build_cfo.py`) is now **unused by the Command Centre** — it is still
built and inlined, but nothing reads `window.PROCESSIQ_CFO`. Safe to delete in a cleanup.

The data model already encodes the mental model: each pattern's `originalDAG` = happy path,
`branchingDAG` = variation branches, `hitlGates` = the approval sought before a branch runs.

## The unified hierarchy (both tiles speak the same vocabulary)

```
THEME (8, A–H)                     shared by both tiles
 └── OBJECTIVE (21, A.1…)          shared by both tiles
      └── MISSION (60, M1–M60)     Command Centre atomic unit
           └── CAPABILITY (77)     the measurement bridge — is the mission on track?
                └── PATTERN (101+)  Transformation Builder atomic unit
                     └── PROCESS FLOW      the happy path
                          └── ACTION BLOCK  a single discrete step
                               └── EXECUTOR  Agent · Workflow · Script · Human Task
```

**L1 is a Theme, L2 is an Objective** — everywhere, in both tiles. There is no "L1 objective"
or "sub-objective" left in the app. Likewise **"DAG" is gone from every pattern detail view**:
it is a *Process Flow* of *Action Blocks*, each with an *Executor*. (The Build Engine, Cockpit
and Governance simulator still say DAG internally — they are on the do-not-modify list and are
not pattern detail views.)

The Builder's five theme slugs are aliases of the canonical A–H ids; `command_centre.json`
carries the dictionary in `themeAliases` (`working-capital → C`, `revenue-leakage → A`, …).

### Cross-tile linkage — the fields that make it one story

| Field | Lives on | Meaning |
|---|---|---|
| `servingMissions` / `servingThemes` | every pattern (`patterns.json`) | what this pattern moves. The **forward** edge — authored once, in `build_patterns.py`, keyed off the pattern's behavioural category |
| `poweredByPatterns` | every mission (`command_centre.json`) | the **inverse**, computed by `build_command_centre.py`. A mission never has to know about patterns |
| `benchmarkTargets` | every capability | `{median, topQuartile, unit}` — the industry band. Pattern Studio's KPI panel is what populates these for real |
| `sourceCompoundKPI` | every capability | links a capability to the Builder's compound KPI, so the same metric is reachable from both sides |

Navigation these fields unlock (all verified):
a **pattern pill** on a mission card opens that pattern in Pattern Studio · **View in Builder →**
filters Pattern Studio to every pattern serving that mission · a CFO **theme tile → View patterns**
filters to that theme · a pattern's **Serving M18 →** chip jumps to that mission card in the
Command Centre (right persona, right lens, scrolled and flashed). The handshake crosses a page
load, so the filter is passed in `localStorage` (`piq.ps.jump.v1` / `piq.cc.jump.v1`).

## Pattern Studio (Design · sub-view `patternstudio`)

The old Pattern Library, renamed and given a second tab. It is now both the catalogue **and**
the workshop where new patterns are mined out of client documents.

- **Library** — the existing filterable master-detail catalogue, unchanged. Counts are
  recomputed from the live `PIQ.patterns` array, so a mined pattern shows up the instant it is
  accepted.
- **Mine** — a **function-agnostic 3-step flow**. Nothing in it is hardcoded to Order-to-Cash;
  an "Other" function falls back to a generic checklist and KPI set.

  1. **Context** — pick a function (10 + Other) and state the objective, or flip the mode toggle
     to **"I have an objective"** and get a **Transformation Blueprint** back (pattern clusters +
     the documents each needs). Then 2–3 clarifying questions — only the ones that actually change
     the checklist (which ERP? what is driving the delay? single- or multi-site?).
  2. **Documents** — a checklist **composed for this context**: the function's categories,
     re-prioritised by the objective's keywords (an inventory objective *promotes* Warehouse &
     Logistics from Enriching to Critical, and says so on the card). Slots are domain-specific
     ("MRP exception messages", not "exception logs"). A coverage meter tracks critical dimensions,
     and a **gap analysis** names each missing document *and what it costs you* — "without these we
     cannot detect **Slow-Moving Inventory Creep**".
  3. **Results** — three panels. **Maturity radar** (5 dimensions, each scored *from the evidence
     actually uploaded* and citing it — a missing RACI is why People & Organization reads 1.6).
     **KPI vs benchmark** (client value, median, top quartile, gap, Q1–Q4 rank, and a "View in
     Command Centre →" per row). **Impact bridge** — the candidates, ranked by *which KPI gap they
     close*, each carrying its `servingMissions` / `servingThemes` chips and an estimated impact.

  Then the 5-stage pipeline (Ingest → Signals → Hypothesis → SME review → Calibration) and the
  SME gate: **Accept / Edit & Accept / Reject / Park**, or **Merge / Keep separate / Discard** when
  a candidate is ≥70% similar to an incumbent. An accepted pattern arrives **already wired into the
  taxonomy** — it carries `servingMissions`, `servingThemes` and per-block executors, and shows a
  MINED badge in the Library.

**There is no live LLM in this build.** The accelerator is on-device and deterministic, and there
is no model endpoint in the bundle, so every step the UI calls "AI" is *derived*, not invented: the
checklist is selected by function and re-prioritised by objective keywords; maturity is scored from
which categories the SME actually uploaded; KPI gaps are read from the benchmark table; candidates
surface only when the corpus carries the evidence their chain depends on, and are ranked by the KPI
gap they close. `buildPrompt()` assembles the real few-shot prompt (6 library patterns in
processFlow/branchingFlow/servingMissions form + the extracted signals) and the UI renders it
verbatim behind "show the prompt" — **the seam to a live model is one function wide: replace the
body of `mine()` and every stage downstream still works.**

Persistence: uploaded documents are in-memory only (clearing on reload, by design). Accepted
patterns and merged incumbents persist to `localStorage` under `piq.mined.v1` — note that a
merge stores the *incumbent* by its existing id, so `restoreMined()` must replace rather than
skip it.

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
| `scripts/build_command_centre.py` | Generates `src/data/command_centre.json` — the **CFO Mission-Capability Taxonomy**: 8 objectives / 21 L2 / 60 missions / 77 capabilities / 11 personas. Derives cadence→tab, `activeTabs`, mission counts, persona headlines, capability cross-references, and synthetic KPI data per widget kind. Asserts the taxonomy is airtight (M1–M60 each in exactly one L2; all 77 capabilities used) |
| `scripts/build_cfo.py` | Generates `src/data/cfo.json` — **now unused** (the Command Centre is taxonomy-driven). Still built and inlined; safe to delete |
| `src/js/engine.js` | Cognitive engine — Sense→Diagnose→Decide→Act, on-device, deterministic |
| `src/js/shell.js` | Platform shell — `window.PIQ` state, the **single `renderSidebar()`** that serves both surfaces (Builder = stages + sub-views; Command Centre = roster / persona lenses), `composition` state, `PIQ.cc` nav state, `PIQ.stageStatus`, `PIQ.goBuilder`, ERP toggle, cross-pattern helpers (`PIQ.pattern`, `PIQ.collectBlocks`, `PIQ.fitment`, `PIQ.go`). No theme logic — light only |
| `src/js/cfo.js` | **Command Centre** — reads `PIQ.cc` (the sidebar drives it), renders the roster → persona dashboard + the generic widget engine + the customise overlay. Registers as the single view `cc` |
| `src/js/studio.js` | **Builder · Design** — Studio wizard (F→P→R→O→Patterns→Action-block config) |
| `src/js/fitment.js` | **Builder · Discover & Fit** — agent-fitment table + happy-path agentivisation + to-be flow |
| `src/js/build.js` | **Builder · Build** — assembles configured blocks into validated agent chains |
| `src/js/runtime.js` | **Builder · Run & Govern** — live STP console; variation→pattern-match→DAG approval, live KPIs |
| `src/js/provocation.js` | The Provocation (scrollytelling intro) — **still bundled but unreachable**; the "Why" entry point was removed. Candidate for deletion |
| `scripts/build_mining.py` | Generates `src/data/mining.json` — the Mine tab's whole domain: 10 functions, per-function document **checklists**, **clarifiers**, **KPI benchmark sets**, the 5 **maturity dimensions** + evidence rules, objective **blueprints**, and the pool of 11 minable candidates (full pattern structure in processFlow/branchingFlow/executor form + `requires` / `evidence` / `confidence` / `similarTo` / `closesKpi` / `servingMissions` / `servingThemes`). Asserts every candidate's evidence resolves against its own function's checklist |
| `src/js/library.js` | **Pattern Studio** (registers as `patternstudio`) — the Library catalogue **and** the Mine tab: upload accordion, 5-stage pipeline, candidate review, accept/merge into the live library |
| `src/js/cockpit.js` | Cognitive Cockpit UI render logic — Run & Govern sub-view |
| `src/js/governance.js` | Action & Governance (trust modes + Saga simulator) — Run & Govern sub-view |
| `src/js/discovery.js` | Discovery Engine (math→text→LLM pipeline) — Discover & Fit sub-view |
| `src/js/roi.js` | ROI & Attribution — Run & Govern sub-view |
| `src/css/app.css` | **Cool-neutral light theme** — tokens in `:root`, every colour on a shared ramp (sidebar `.sb-*` + Command Centre styles appended at the end; every `body.dark` / `.theme-toggle` / `.whylink` / horizontal-nav rule has been stripped) |
| `src/fonts/*.woff2` | DM Sans + JetBrains Mono (latin + latin-ext subsets). Base64-inlined at build time; **not** fetched from a CDN |
| `src/html/cockpit_body.html` | Platform shell markup (topbar + `#sidebar` + `#workcrumb` + `#view`; no `#modnav`, no `#themeToggle`, no `#whyLink`) |
| `src/apps/index.html` | Platform landing page — the two tiles |
| `scripts/build.py` | Regenerates data + assembles everything → `public/processiq.html` |

## Status

**The two-tile architecture is live, light-theme only, with a shared vertical sidebar.** Boots
into the Transformation Builder (Studio) by default; `?persona=command` opens the Command
Centre. The build inlines the shell + engine + all modules + seven data files **and the fonts**
into one self-contained `public/processiq.html` (~2.17 MB). Fitment verdicts, the runtime
simulator and Pattern Studio's mining pipeline are all deterministic; nothing invents data.

The **cool-neutral visual refresh is applied across both surfaces** (see "The palette" above).
It was a pure re-skin: the DOM every view renders is byte-for-byte identical to the previous
build, so no behaviour changed.

Known gaps / next increments:
- **Capability KPI data is synthetic and shape-driven**, generated per widget kind rather than
  modelled per capability. Real client data would be wired in `build_command_centre.py`'s
  `cap_data()` — the taxonomy, routing and UI need no change.
- `provocation.js` is dead weight in the bundle — remove it in a future cleanup.
- Studio's own body still prints a "STAGE 1 · DESIGN" eyebrow (it is on the do-not-modify list).
- **Pattern Studio's Mine tab has no live model behind it** — see the section above. Wiring a
  real extractor means replacing the body of `mine()` in `library.js` with a call that posts
  `buildPrompt()` and parses the response into the same candidate shape.

## Provenance

Deck: `Beyond_Efficiency_AI_Process_Transformation_v2.pptx` — the three slide columns
(Upstream Missions→Actions / Current core Discovery / Downstream Process→Agentic workflow)
are the three journey stages. Each engine feature (`featureSlug`) maps 1:1 to a Layer-3 AI
Feature in the xlsx. The Discovery Engine is where pattern #32+ get surfaced and SME-approved.
