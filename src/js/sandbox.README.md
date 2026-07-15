# Sandbox / Demo mode

A read-only exploration environment and a sales-demo tool for the Transformation
Builder. Pre-loads a complete Order-to-Cash composition, lets a user click freely
without touching their real design, and adds a sales layer (talking points,
competitive comparison, KPI ticker).

## Files

| File | Purpose |
|---|---|
| `sandbox.js` | Engine: activation, state isolation, write guard, banner, narration, sales chrome, the pattern slide-over. Registers `window.PIQ.sandbox`. |
| `sandbox-personas.js` | The Personas gallery (sub-view `sbpersonas`). |
| `sandbox-design.js` | The guided 7-step Design demo (sub-view `sbguided`). |
| `../css/sandbox.css` | All sandbox styles (`sb-` / `sp-` / `sd-` prefixes). |

All four are inlined by `scripts/build.py` — the three JS files load **after** every
other module (the engine wraps `PIQ.boot`, and the two views register into
`PIQ.modules`); `sandbox.css` is concatenated after `app.css`.

## Activation

- `?demo=true` or `?sandbox=true` — sandbox
- `?demo=sales` — sandbox + sales layer
- **Try Demo** pill in the topbar (toggles)
- `Ctrl+Shift+D` sandbox · `Ctrl+Shift+S` sales · `Ctrl+Shift+R` reset

## State isolation — how it actually works

Modules never hold a reference to the composition; they read it live through their own
`C() → window.PIQ.composition`. On activation the engine:

1. stashes the real `PIQ.composition` and `PIQ.persistComposition`,
2. swaps in a **Proxy over a throwaway demo composition**, so every read and write in
   the app now hits the demo copy, and
3. neuters `persistComposition` with `guard()`, so nothing can reach
   `localStorage["piq.composition.v1"]`.

Exit restores both references and navigates back to the Studio. The user's real design
is provably untouched — the browser test asserts the persisted composition still reads
`REAL` after a full demo run.

## Everything is derived, nothing is faked

The demo composition (`DEMO` in `sandbox.js`) and the persona roster
(`sandbox-personas.js`) reference **real taxonomy ids** and are validated at activation
by `verify()`; a renamed role or re-pointed objective logs a `console.warn` naming the
exact id rather than rendering a silent lie. The action blocks are built by the real
`PIQ.collectBlocks()`, the pattern cards by the real 101-pattern library, the KPI panel
from the theme's real `compoundKPI`.

Two things the source spec asked for do not exist in this codebase and were adapted:

- **No `judgment type` badge** (OPT/DIA/TIM/ADV/EXC) — patterns have no such field. The
  cards show the real axes instead: `priority` (Critical/High/Medium/Low) and `category`.
- **Four demo role ids in the spec were wrong** (`o2c-credit-risk`, `o2c-cash-app`,
  `o2c-strategic-acct`, and objective `o2c-o-insolvency`). The real ids are
  `o2c-credit`, `o2c-cashapp`, `o2c-kam`, `o2c-o-risk` — used throughout.

## Adding to the demo

- **A talking-point set / narration:** add to `TALKING_POINTS` / `NARRATIONS` in
  `sandbox.js`, keyed by view.
- **A persona's prose:** add to `PROSE` in `sandbox-personas.js`, keyed by the real role
  id. Structure (objectives, KPIs, pattern ids) is derived — only prose is authored.
- **A guided step:** the seven steps are fixed to the Studio flow; edit `NARR` and the
  matching `st*()` renderer in `sandbox-design.js`.

## Note on the real Studio

"Explore freely" hands the user to the untouched Studio (`PIQ.go("studio")`). No patch
was made to `studio.js` — it is on the do-not-modify list, and it is already safe under
sandbox because the composition swap and the persistence guard are global.
