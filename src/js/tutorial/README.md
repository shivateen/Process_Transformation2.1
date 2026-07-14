# Tutorial system

On-screen guided tours: a spotlight overlay, a branded tooltip, pulsing hotspots, a
help menu, `localStorage` persistence and analytics events.

## Why not react-joyride

There is no React here, no bundler and no `node_modules` at runtime. The app builds
into a **single self-contained `public/processiq.html`** that must render from
`file://` with **no network** (that is why the fonts are base64-inlined rather than
linked from a CDN). An npm dependency cannot be inlined into that, so the spotlight /
tooltip driver is implemented directly in `tutorial.js` — about 300 lines, same
feature set, no dependency.

## Files

| File | Purpose |
|---|---|
| `tutorial.js` | The engine. Registers `window.PIQ.tutorial`, owns state, paints the spotlight + tooltip, manages hotspots and the help menu. |
| `tours.js` | The three tour definitions and the hotspot placements. Nothing else needs to change to add a tour. |

Both are inlined by `scripts/build.py` **after** every other module — the engine wraps
`PIQ.boot`, and `tours.js` needs `PIQ.tutorial` to already exist.

## Adding a tour

Add one `T.register({...})` block to `tours.js`. There is no type union to update and
no provider to touch; the help menu and the tour registry are both built from whatever
is registered.

```js
T.register({
  id: "my-tour",                       // also the localStorage completion key
  title: "My tour",
  menuLabel: "Replay my tour",         // optional; shown in the help menu
  autoStart: function () {             // optional; polled after every shell render
    return PIQ.active === "roi" && document.querySelector(".roi-grid");
  },
  steps: [
    {
      target: '[data-tutorial="roi-bridge"]',   // omit for a centred overlay step
      title: "The bridge",
      body: "Where the value came from.",       // string, or a function returning one
      placement: "auto",                        // auto | up | down | left | right | center
      spotlightPadding: 6,
      before: function () { /* make the target exist */ },
    },
  ],
});
```

### Targets

Use a `data-tutorial="..."` attribute rather than a class or an id — classes get
restyled and ids get renamed, but a `data-tutorial` hook is obviously load-bearing to
the next person who reads the markup. Add the attribute in the view that renders the
element (`cfo.js`, `library.js`, …).

Currently placed: `cc-heatmap`, `cc-heatmap-row` (+ `data-row`), `cc-scorecard`,
`cc-attention`, `cc-tabbar`, `cc-mission`, `cc-patterns`, `ps-tabs`, `ps-stepper`,
`ps-context`, `help`.

**A missing target is not fatal.** The engine waits ~1.8s for it, then logs
`console.warn` and skips to the next step. That is deliberate: `.cc-attention` only
exists when a mission is actually flagged.

### `before()` must be idempotent

This is the one real rule.

A tour **survives a page load** — the Command Centre and the Builder are separate page
loads (`PIQ.goBuilder` navigates for real), and the golden-path tour crosses between
them. `{activeTour, currentStepIndex}` is persisted, and the tour resumes on boot.

So a step's `before()` can run twice: once before the navigation, and once when the
tour resumes. The engine protects you in the common case — **if a step's `target` is
already on screen, `before()` is not called at all** — but a centred step has no target
to check, so its `before()` must guard itself:

```js
before: function () {
  if (PIQ.persona !== "command") {          // guard: only navigate if we are not there
    window.location.href = "processiq.html?persona=command";
  }
}
```

Prefer driving the app by **clicking its real DOM** (`b.click()`) over reaching into
module state — the existing handlers then do the work, and the tour cannot drift out of
sync with the app.

## Hotspots

```js
T.registerHotspot({
  id: "hs-my-thing",                   // localStorage dismissal key
  selector: '[data-tutorial="roi-bridge"]',
  tourId: "my-tour",                   // clicking the dot starts this tour
  title: "Show me around",             // tooltip on the dot
});
```

A dot renders only while its tour is uncompleted **and** the dot is undismissed, and it
disappears while any tour is running. It is positioned against the target's live
bounding box and repositioned on scroll, resize and re-render.

## State

`localStorage["processiq_tutorial_state"]`:

```js
{ activeTour, currentStepIndex, completedTours: [], dismissedHotspots: [] }
```

Clear it from the help menu ("Reset all tutorials") or with
`PIQ.tutorial.resetAll()` / `PIQ.tutorial.resetTour(id)` in the console.

## Analytics

No analytics vendor is bundled, so events go out as a DOM `CustomEvent` that a host
page can forward:

```js
window.addEventListener("processiq:analytics", function (e) {
  // e.detail = { event: "tutorial_step_viewed", props: { tourId, stepIndex } }
});
```

Events: `tutorial_started`, `tutorial_completed`, `tutorial_skipped`,
`tutorial_step_viewed`. Reassign `PIQ.tutorial.track` to send them elsewhere.

## Accessibility

Escape skips the tour, `←` / `→` step through it, the tooltip is a labelled
`role="dialog"` and focus lands on **Next** at every step. Below 700px the tooltip
becomes a bottom sheet. The hotspot pulse respects `prefers-reduced-motion`.
