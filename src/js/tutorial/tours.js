/* tours.js — the tour definitions + hotspot placements.
 *
 * Every target below was verified against the DOM the app actually renders, and
 * every claim a step makes was verified against the data the app actually ships.
 * See README.md for the step contract (in particular: before() must be idempotent).
 */
(function () {
  "use strict";
  var PIQ = window.PIQ;
  var T = PIQ.tutorial;

  /* ---- shared before() helpers ----------------------------------------
     Each is a no-op when the app is already where the step needs it. That is what
     lets a tour resume after the page load that these very helpers trigger.      */

  // The Command Centre is a different page load from the Builder (?persona=command).
  function ensureCommandCentre() {
    if (PIQ.persona !== "command") {
      window.location.href = "processiq.html?persona=command";
      return true;                       // navigating; the tour resumes on boot
    }
    return false;
  }

  // The CFO overview is the only view whose heatmap rows are the 8 themes.
  function ensureCFO() {
    if (ensureCommandCentre()) return;
    if (PIQ.cc.persona !== "cc-cfo" || PIQ.active !== "cc") {
      PIQ.cc.persona = "cc-cfo";
      PIQ.cc.custom = false;
      PIQ.go("cc");
    }
  }

  function psTab(which) {
    return function () {
      var b = document.querySelector('.ps-tab[data-t="' + which + '"]');
      if (b && !b.classList.contains("on")) b.click();
    };
  }

  /* ====================================================================== */
  /* Tour A — Command Centre First Look                                      */
  /* ====================================================================== */
  T.register({
    id: "command-centre-intro",
    title: "Command Centre First Look",
    menuLabel: "Replay the Command Centre tour",
    // fires the first time a persona dashboard is on screen (the roster has no heatmap)
    autoStart: function () {
      return PIQ.active === "cc" && PIQ.cc.persona && document.querySelector(".cc-hm");
    },
    steps: [
      {
        title: "Welcome to ProcessIQ",
        body: "This is your <b>Command Centre</b> — a single pane of glass across every " +
              "mission the finance function is accountable for. Outcomes first; the patterns " +
              "that move them sit underneath.",
        placement: "center",
      },
      {
        target: '[data-tutorial="cc-scorecard"]',
        title: "The scorecard",
        body: "The first tile is always <b>mission health</b> and the last is always the " +
              "<b>automation ratio</b> — how much of this role is already agent-covered. " +
              "The tiles between are this persona's own headline KPIs.",
      },
      {
        target: '[data-tutorial="cc-heatmap"] .cc-hm-row:first-child .cc-hm-l',
        title: "One row per lens",
        // the CFO's rows are the 8 themes; a persona's rows are its lenses
        body: function () {
          var cfo = PIQ.cc.persona === "cc-cfo";
          return cfo
            ? "For the CFO, each row is one of the <b>8 themes</b> — from Total shareholder " +
              "return to Risk &amp; compliance. Every mission in the enterprise sits on one of them."
            : "Each row is a <b>lens</b> — a cadence at which this role is accountable. " +
              "Daily and weekly work lands in Pulse; monthly in Intelligence; quarterly in Trajectory.";
        },
        placement: "right",
      },
      {
        target: '[data-tutorial="cc-heatmap"] .cc-hm-b.off-track, [data-tutorial="cc-heatmap"] .cc-hm-b.attention',
        title: "Colour is severity",
        body: "One block per mission. Green is on track, <b>amber needs attention</b>, " +
              "<b>red is off track</b>. Click any block to jump straight to that mission's card.",
        spotlightPadding: 8,
      },
      {
        target: '[data-tutorial="cc-attention"]',
        title: "Nothing goes hunting for you",
        body: "Flagged missions surface here automatically, most severe first. No searching, " +
              "no report building.",
      },
      {
        target: "#sidebar",
        title: "Every role, its own view",
        body: "Eleven personas, each seeing only the missions they own. Treasury watches daily " +
              "cash; Risk &amp; Compliance watches monthly controls. The CFO sees all 60.",
        placement: "right",
        spotlightPadding: 0,
      },
      {
        target: "#ccTabbar",
        title: "Lenses, not tabs",
        body: "A lens is a <b>cadence</b>. A persona with no mission at a cadence simply has no " +
              "such lens — Tax has no daily work, so Tax has no Pulse.",
      },
      {
        target: ".mc",
        title: "From a block to the work",
        body: "The mission card carries its status, its theme, the capabilities that measure it, " +
              "the patterns that power it and the next action due. Two clicks from an amber block " +
              "to the root cause — that's the promise. <b>Click any heatmap block to begin.</b>",
      },
    ],
  });

  /* ====================================================================== */
  /* Tour B — Pattern Studio Walkthrough                                     */
  /* ====================================================================== */
  var toMine = psTab("mine");

  T.register({
    id: "pattern-studio-intro",
    title: "Pattern Studio Walkthrough",
    menuLabel: "Replay the Pattern Studio tour",
    autoStart: function () {
      return PIQ.active === "patternstudio" && document.querySelector(".ps-tabs");
    },
    steps: [
      {
        target: '[data-tutorial="ps-tabs"]',
        title: "Catalogue and workshop",
        body: "<b>Library</b> is the catalogue of every behavioural pattern we hold. " +
              "<b>Mine</b> is where new ones are pulled out of a client's own documents.",
      },
      {
        target: '[data-tutorial="ps-stepper"]',
        before: toMine,
        title: "Three steps, always",
        body: "Mining follows one flow: set the <b>Context</b>, supply the <b>Documents</b>, " +
              "read the <b>Results</b>. It is function-agnostic — Order-to-Cash, P2P, Supply " +
              "Chain and the rest all run the same three steps.",
      },
      {
        target: '[data-tutorial="ps-context"]',
        before: toMine,
        title: "1 · Context",
        body: "Pick the function and state the objective — or flip to <b>“I have an objective”</b> " +
              "and get a transformation blueprint back. Two or three clarifying questions follow, " +
              "and only the ones that actually change the document checklist get asked.",
      },
      {
        target: '.mn-rs[data-step="documents"]',
        before: toMine,
        title: "2 · Documents",
        body: "The checklist is <b>composed for your context</b>, not a fixed list: an inventory " +
              "objective promotes Warehouse &amp; Logistics to critical, and says so. A coverage " +
              "meter tracks the critical dimensions, and the gap analysis names each missing " +
              "document <i>and what it costs you</i>.",
      },
      {
        target: '.mn-rs[data-step="results"]',
        before: toMine,
        title: "3 · Results",
        body: "Three panels: a <b>maturity radar</b> scored from the evidence you actually " +
              "uploaded, <b>KPI vs benchmark</b> against the industry median and top quartile, " +
              "and an <b>impact bridge</b> ranking each candidate pattern by the KPI gap it closes. " +
              "Then you Accept, Edit, Reject or Park it.",
      },
      {
        target: ".pcard",
        before: psTab("library"),
        title: "What a pattern carries",
        body: "Every pattern holds the analyst's <b>mental model</b> in their own words, its " +
              "<b>happy path</b> as a chain of action blocks, the <b>HITL gate</b> a write action " +
              "must pass, and the <b>missions</b> it serves. Accepted patterns arrive already " +
              "wired into the taxonomy. <b>Pick one to investigate.</b>",
      },
    ],
  });

  /* ====================================================================== */
  /* Tour C — Golden Path: trapped working capital                           */
  /*                                                                        */
  /* Anchored to real shipped data end to end:                              */
  /*   Theme C  Free cash flow  ->  L2 C.1 Working Capital                  */
  /*   M18      Days inventory outstanding at target   (status: off-track)  */
  /*   #83      Serial Credit-Hold Override  (Critical, 2 HITL gates)       */
  /* ====================================================================== */
  T.register({
    id: "golden-path-working-capital",
    title: "Golden path — trapped working capital",
    menuLabel: "Take the guided walkthrough",
    steps: [
      {
        before: ensureCFO,
        title: "Let's trace a real exception",
        body: "<b>“Why is our working capital trapped?”</b><br><br>We'll follow that question " +
              "from a red square on the CFO's heatmap all the way down to the action block that " +
              "needs a human signature — without writing a query or building a report.",
        placement: "center",
      },
      {
        target: '[data-tutorial="cc-heatmap-row"][data-row="C"] .cc-hm-l',
        before: ensureCFO,
        title: "Theme C · Free cash flow",
        body: "Working capital sits under <b>Theme C</b>, one of the eight themes the CFO is " +
              "accountable for. Its L2 objective here is <b>C.1 · Working Capital</b>.",
        placement: "right",
      },
      {
        target: '[data-tutorial="cc-heatmap-row"][data-row="C"] .cc-hm-b[data-jump="M18"]',
        before: ensureCFO,
        title: "The red square",
        body: "<b>M18 · Days inventory outstanding at target</b> is <b>off track</b>. It belongs " +
              "to Supply Chain Finance and runs at a weekly cadence. One click investigates it.",
        spotlightPadding: 8,
      },
      {
        target: "#mc-M18",
        // clicking the block routes to the owning persona and scrolls to the card
        before: function () {
          var b = document.querySelector('.cc-hm-b[data-jump="M18"]');
          if (b) b.click();
        },
        title: "The mission, in full",
        body: "The Command Centre routed us to the owner — <b>Supply Chain Finance</b>, Pulse lens " +
              "— and opened the card. It is <b>agent covered</b>, was refreshed by the agent an " +
              "hour ago, and its policy re-test is due in two days.",
      },
      {
        target: "#mc-M18 .mc-pats",
        title: "Ten patterns fired",
        body: "These are the behavioural patterns powering this mission. They are not reports — " +
              "each is an executable chain. Let's open the most severe: <b>#83 Serial Credit-Hold " +
              "Override</b>, the only Critical one in the set.",
      },
      {
        target: ".lib-detail .mental",
        // crosses into the Builder — a real page load. The tour persists and resumes.
        before: function () {
          var b = document.querySelector('#mc-M18 .dq-pat[data-pat="83"]');
          if (b) b.click();
        },
        title: "The analyst's read",
        body: "Pattern Studio opened the pattern. This is the <b>mental model</b> — the judgement " +
              "an experienced analyst applies, captured in their own words. It is what the pattern " +
              "encodes, and why it is not a threshold rule.",
      },
      {
        target: ".lib-detail .flatdag",
        title: "The process flow",
        body: "The happy path, as action blocks:" +
              "<code>Read_Credit_Status_Log → Compute_Override_Rate_Per_User → " +
              "Detect_Threshold_Breach → Escalate_Credit_Risk</code><br>" +
              "Each block carries its own executor — an agent, a workflow, a script or a human task.",
      },
      {
        target: ".lib-detail .branches",
        title: "You choose the branch",
        body: "Reality is not the happy path. Each variation is matched to a branch, and each " +
              "branch names the action blocks it will run. <b>You pick the branch — ProcessIQ " +
              "executes it.</b>",
      },
      {
        target: ".lib-detail .gatebar",
        title: "The gate before the write",
        body: "Write actions stop for a human. Here that is <b>“Collections VP approves rep " +
              "release-right freeze”</b> and <b>“Credit Manager approves override revocation”</b> — " +
              "full context, one click to approve or reject.",
      },
      {
        title: "That's the whole loop",
        body: "From a red square on the CFO's heatmap, to the mission that owns it, to the pattern " +
              "that explains it, to the action block waiting on a signature. <b>No data wrangling, " +
              "no report building.</b>",
        placement: "center",
      },
    ],
  });

  /* ---- hotspots --------------------------------------------------------
     Each renders only while its tour is uncompleted and undismissed. There is no
     Builder "New Pattern" button in this app — patterns are created through Mine →
     Accept — so the Builder hotspot from the spec has no anchor and is not placed. */

  T.registerHotspot({
    id: "hs-cc-cell",
    selector: '[data-tutorial="cc-heatmap"] .cc-hm-b.off-track, [data-tutorial="cc-heatmap"] .cc-hm-b.attention',
    tourId: "command-centre-intro",
    title: "New here? Take the Command Centre tour",
  });
  T.registerHotspot({
    id: "hs-help",
    selector: "#helpBtn",
    tourId: "golden-path-working-capital",
    title: "Take the guided walkthrough",
  });
  T.registerHotspot({
    id: "hs-ps-mine",
    selector: '.ps-tab[data-t="mine"]',
    tourId: "pattern-studio-intro",
    title: "Mine new patterns from documents — show me how",
  });

  /* start the tutorial layer once the shell has booted */
  var boot = PIQ.boot;
  PIQ.boot = function () { boot(); T.init(); };
})();
