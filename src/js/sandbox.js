/* sandbox.js — Sandbox / Demo mode.
 *
 * A risk-free exploration environment and a sales-demo tool. Activated by
 * ?demo=true / ?sandbox=true / ?demo=sales, by the "Try Demo" pill in the topbar,
 * or by Ctrl+Shift+D (sandbox) / Ctrl+Shift+S (sales) / Ctrl+Shift+R (reset).
 *
 * State isolation: PIQ.composition is swapped for a Proxy over a throwaway demo
 * composition, and persistComposition() is neutered. Every module reads the
 * composition live through its own C() accessor, so the swap is invisible to them
 * and nothing they write can reach localStorage or the user's real design.
 *
 * Exposes window.PIQ.sandbox = {
 *   activate(opts) exit() reset() active()
 *   narrate(key) toast(msg) guard(fn, name)
 *   showPatternDetail(id)
 *   composition()            the live demo composition
 *   DEMO                     the demo composition seed
 * }
 */
(function () {
  "use strict";
  var PIQ = window.PIQ;

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ---- the pre-loaded O2C scenario -------------------------------------
     Deck Unified Hierarchy: Theme → Objective → Mission → Capability → Pattern.
     Every id below is checked against taxonomy.json at activation — see verify().
     Working Capital's "Accelerate cash collection" objective carries the four O2C
     collection missions; the 13 pattern ids are the headline slice across them.  */
  var DEMO = {
    themeId: "working-capital",                                   // Cash Conversion Cycle 58 -> 38 days
    objectiveIds: ["obj-wc-collect"],                            // Accelerate cash collection
    missionIds: ["m-o2c-o-dso", "m-o2c-o-arops", "m-o2c-o-match", "m-o2c-o-cashapp"],
    capabilityIds: [
      "cap-o2c-o-dso-1", "cap-o2c-o-dso-2", "cap-o2c-o-dso-3",
      "cap-o2c-o-arops-1", "cap-o2c-o-arops-2",
      "cap-o2c-o-match-1", "cap-o2c-o-match-2",
      "cap-o2c-o-cashapp-1", "cap-o2c-o-cashapp-2",
    ],
    patternIds: [1, 2, 3, 7, 10, 14, 17, 19, 22, 25, 27, 29, 31],
    blocks: {},                                                   // seeded from the patterns below
    dag: {},
    live: false,
    fnFilter: null,
  };

  var TALKING_POINTS = {
    personas: [
      "We start with WHO, not WHAT. Most tools ask “what process?” — we ask “who is accountable?”",
      "Eleven personas, each with their own cadence. The controller sees a weekly portfolio; the collector sees a daily action queue.",
      "Every persona's patterns were designed with SMEs — they encode real mental models, not generic rules.",
    ],
    guided: [
      "This is two hours of work with an SME, not two months of consulting.",
      "Notice the patterns have NAMES. “#1 · The 29th-Day Tactic” means the analyst and the system share one mental model.",
      "The action blocks are assembled automatically. Each one carries an executor binding — Agent, Workflow, Script or Human Task.",
      "WRITE blocks pause for human approval by default. We don't automate the decision — we accelerate it.",
    ],
    pattern: [
      "This mental model was encoded by a domain expert — it is how a twenty-year collections veteran thinks.",
      "The process flow is not a diagram — each action block calls a real API.",
      "The branches are the variations. The human picks the branch; the system runs it.",
    ],
  };

  var COMPARE = [
    ["Starting point", "Event log", "CFO themes"],
    ["Intelligence unit", "Unnamed deviation", "Named cognitive pattern"],
    ["Data requirement", "Clean event log", "Source documents"],
    ["Time to value", "6+ months", "2-hour SME session"],
    ["Action model", "Recommendations", "Executable action chains"],
    ["Human oversight", "Optional", "HITL gates on WRITE blocks"],
  ];

  var TICKER = ["DSO −8 days", "Dispute resolution −60%", "Auto-match +25pp",
                "Credit losses −35%", "Close cycle −6 days"];

  var NARRATIONS = {
    welcome: {
      title: "Welcome to ProcessIQ",
      body: "You are looking at an Order-to-Cash accelerator pre-loaded with real collection " +
            "patterns. Click anything — nothing you do here changes real data.",
    },
    "persona-selected": {
      title: "Personas own the missions",
      body: "A persona is not a job title on a slide. It owns objectives, each objective owns " +
            "patterns, and each pattern owns an executable chain of action blocks.",
    },
    "pattern-drilldown": {
      title: "A pattern has a name",
      body: "This is not a “late payment alert”. It is a named adversarial behaviour with a " +
            "mental model, a happy path and the branches reality actually takes.",
    },
    "theme-selected": {
      title: "Themes are the CFO's frame",
      body: "Themes span functions. Working Capital connects O2C collections to P2P payment " +
            "timing and Supply Chain inventory. ProcessIQ starts at this altitude.",
    },
    "design-complete": {
      title: "Design complete",
      body: "One theme → one function → four personas → thirteen patterns → the action blocks " +
            "underneath. In a real engagement this is a two-hour SME session.",
    },
  };

  /* ---- state ----------------------------------------------------------- */

  var on = false, sales = false;
  var realComposition = null, realPersist = null;
  var seen = {};                       // narration keys already shown

  function active() { return !!on; }

  // The demo composition seed is only useful if the taxonomy still contains every id
  // in it. A renamed role would otherwise silently produce an empty demo.
  function verify(c) {
    var tax = PIQ.tax || {}, bad = [];
    var th = (tax.themes || []).filter(function (t) { return t.id === c.themeId; })[0];
    if (!th) return bad.concat("theme:" + c.themeId);
    var objIds = {}, misIds = {}, capIds = {};
    (th.objectives || []).forEach(function (o) {
      objIds[o.id] = 1;
      (o.missions || []).forEach(function (m) {
        misIds[m.id] = 1;
        (m.capabilities || []).forEach(function (cp) { capIds[cp.id] = 1; });
      });
    });
    (c.objectiveIds || []).forEach(function (o) { if (!objIds[o]) bad.push("objective:" + o); });
    (c.missionIds || []).forEach(function (m) { if (!misIds[m]) bad.push("mission:" + m); });
    (c.capabilityIds || []).forEach(function (cp) { if (!capIds[cp]) bad.push("capability:" + cp); });
    (c.patternIds || []).forEach(function (p) { if (!PIQ.pattern(p)) bad.push("pattern:#" + p); });
    return bad;
  }

  function seedComposition() {
    var c = JSON.parse(JSON.stringify(DEMO));
    // action blocks come from the selected patterns, exactly as the Studio would build them
    var blocks = PIQ.collectBlocks(c.patternIds) || [];
    blocks.forEach(function (b) {
      var fit = PIQ.fitment(b);
      c.blocks[b.key] = { mode: fit.mode, tech: "LLM Agent", configured: true };
    });
    return c;
  }

  /* ---- activation ------------------------------------------------------ */

  function activate(opts) {
    if (on) { if (opts && opts.salesMode && !sales) setSales(true); return; }
    opts = opts || {};

    var seed = seedComposition();
    var bad = verify(seed);
    if (bad.length && window.console) {
      console.warn("[sandbox] demo scenario references ids the taxonomy no longer has: " +
        bad.join(", ") + " — the demo will render, but incompletely.");
    }

    realComposition = PIQ.composition;
    realPersist = PIQ.persistComposition;
    on = true;
    PIQ.sandboxMode = true;
    PIQ._sandboxComposition = seed;

    // Modules read the composition live via their own C() -> window.PIQ.composition,
    // so swapping the object here redirects every read and write in the app.
    PIQ.composition = new Proxy(seed, {
      set: function (target, prop, value) {
        target[prop] = value;
        (PIQ._sandboxChangeListeners || []).forEach(function (fn) {
          try { fn(prop, value); } catch (e) {}
        });
        return true;
      },
    });
    PIQ.persistComposition = guard(realPersist, "Saving");

    document.body.classList.add("sandbox-on");
    banner();
    addViews();
    if (opts.salesMode) setSales(true);
    PIQ.refreshNav();
    PIQ.go(opts.entry || "sbpersonas");
    setTimeout(function () { narrate("welcome"); }, 350);
  }

  function exit() {
    if (!on) return;
    on = false; sales = false;
    PIQ.sandboxMode = false;
    PIQ.composition = realComposition;
    PIQ.persistComposition = realPersist;
    PIQ._sandboxComposition = null;
    seen = {};

    document.body.classList.remove("sandbox-on", "sandbox-sales");
    ["sbBanner", "sbNarr", "sbTalk", "sbTicker", "sbCompare", "sbPat"].forEach(function (id) {
      var n = document.getElementById(id);
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
    removeViews();
    PIQ.refreshNav();
    PIQ.go("studio");
  }

  function reset() {
    if (!on) return;
    if (!window.confirm("Reset demo to starting state? This won't affect real data.")) return;
    var seed = seedComposition();
    Object.keys(seed).forEach(function (k) { PIQ.composition[k] = seed[k]; });
    seen = {};
    PIQ.refreshNav();
    PIQ.go("sbpersonas");
    toast("Demo reset to starting state");
  }

  /* ---- write guard ----------------------------------------------------- */

  function guard(fn, name) {
    return function () {
      if (on) { toast((name || "That") + " is view-only in demo mode"); return; }
      return fn.apply(this, arguments);
    };
  }

  /* ---- the two sandbox-only sub-views ---------------------------------- */

  function designStage() {
    return (PIQ.STAGES || []).filter(function (s) { return s.id === "design"; })[0];
  }
  function addViews() {
    var d = designStage(); if (!d) return;
    if (!d.sub.some(function (s) { return s.id === "sbpersonas"; })) {
      d.sub.push({ id: "sbpersonas", label: "Personas" });
      d.sub.push({ id: "sbguided", label: "Guided Demo" });
    }
  }
  function removeViews() {
    var d = designStage(); if (!d) return;
    d.sub = d.sub.filter(function (s) { return s.id !== "sbpersonas" && s.id !== "sbguided"; });
  }

  /* ---- chrome: banner, toast, narration -------------------------------- */

  function banner() {
    if (document.getElementById("sbBanner")) return;
    var b = el("div", "sb-banner", "");
    b.id = "sbBanner";
    b.innerHTML =
      '<span class="sb-b-tag">◐ Sandbox mode</span>' +
      '<span class="sb-b-txt">Explore freely. Nothing you do here affects real data.</span>' +
      '<span class="sb-b-sp"></span>' +
      '<button class="sb-b-btn" data-sb="sales">vs Celonis</button>' +
      '<button class="sb-b-btn" data-sb="reset">Reset demo</button>' +
      '<button class="sb-b-btn exit" data-sb="exit">Exit demo</button>';
    document.body.appendChild(b);
    b.addEventListener("click", function (e) {
      var t = e.target.closest("[data-sb]"); if (!t) return;
      if (t.dataset.sb === "exit") exit();
      else if (t.dataset.sb === "reset") reset();
      else if (t.dataset.sb === "sales") compare();
    });
  }

  function toast(msg) {
    var t = document.querySelector(".sb-toast");
    if (!t) { t = el("div", "sb-toast"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove("show"); }, 2100);
  }

  // Narration fires once per key per demo run — a demo that repeats itself is noise.
  function narrate(key, force) {
    var n = NARRATIONS[key];
    if (!on || !n || (seen[key] && !force)) return;
    seen[key] = true;
    var old = document.getElementById("sbNarr");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var d = el("div", "sb-narr");
    d.id = "sbNarr";
    d.innerHTML =
      '<div class="sb-n-bar"></div>' +
      '<div class="sb-n-b"><h4>' + esc(n.title) + '</h4><p>' + esc(n.body) + '</p>' +
      '<button class="sb-n-x">Got it</button></div>';
    document.body.appendChild(d);
    d.querySelector(".sb-n-x").onclick = function () {
      d.classList.remove("in");
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 200);
    };
    requestAnimationFrame(function () { d.classList.add("in"); });
  }

  /* ---- sales mode: talking points, comparison, KPI ticker -------------- */

  function setSales(v) {
    sales = v;
    document.body.classList.toggle("sandbox-sales", v);
    if (!v) return;
    talkPanel();
    ticker();
  }

  function talkPanel() {
    if (document.getElementById("sbTalk")) return;
    var p = el("aside", "sb-talk");
    p.id = "sbTalk";
    document.body.appendChild(p);
    renderTalk();
    // the panel follows the view — the shell replaces #view on every navigation
    var host = document.getElementById("view");
    if (host && window.MutationObserver) {
      new MutationObserver(function () { renderTalk(); }).observe(host, { childList: true });
    }
  }

  function renderTalk() {
    var p = document.getElementById("sbTalk"); if (!p) return;
    var key = PIQ.active === "sbpersonas" ? "personas"
      : PIQ.active === "sbguided" ? "guided"
      : PIQ.active === "patternstudio" ? "pattern" : "personas";
    var pts = TALKING_POINTS[key] || [];
    var open = p.classList.contains("open");
    p.innerHTML =
      '<button class="sb-talk-t">' + (open ? "›" : "‹") + '<span>Talking points</span></button>' +
      '<div class="sb-talk-b"><h4>' + esc(key === "guided" ? "Design Studio"
        : key === "pattern" ? "Pattern detail" : "Persona gallery") + '</h4><ul>' +
      pts.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      '</ul></div>';
    p.querySelector(".sb-talk-t").onclick = function () {
      p.classList.toggle("open"); renderTalk();
    };
  }

  function ticker() {
    if (document.getElementById("sbTicker")) return;
    var t = el("div", "sb-ticker");
    t.id = "sbTicker";
    t.innerHTML = '<span class="sb-tk-l">Projected impact</span>' +
      TICKER.map(function (k) { return '<span class="sb-tk">' + esc(k) + '</span>'; }).join("");
    document.body.appendChild(t);
  }

  function compare() {
    var old = document.getElementById("sbCompare");
    if (old) { close(old); return; }
    var d = el("div", "sb-cmp");
    d.id = "sbCompare";
    d.innerHTML =
      '<div class="sb-cmp-p">' +
        '<div class="sb-cmp-h"><h3>Where ProcessIQ differs</h3><button class="sb-cmp-x">✕</button></div>' +
        '<table class="sb-cmp-t"><thead><tr><th>Dimension</th><th>Process mining</th>' +
        '<th class="us">ProcessIQ</th></tr></thead><tbody>' +
        COMPARE.map(function (r) {
          return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) +
            '</td><td class="us">' + esc(r[2]) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>";
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add("in"); });
    d.querySelector(".sb-cmp-x").onclick = function () { close(d); };
    d.onclick = function (e) { if (e.target === d) close(d); };
    document.addEventListener("keydown", onEsc);
    function onEsc(e) { if (e.key === "Escape") { e.preventDefault(); close(d); } }
    function close(n) {
      n.classList.remove("in");
      document.removeEventListener("keydown", onEsc);
      setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 200);
    }
  }

  /* ---- pattern slide-over (shared by both sandbox views) ---------------- */

  function showPatternDetail(id) {
    var p = PIQ.pattern(id);
    if (!p) { toast("Pattern #" + id + " is not in the library"); return; }
    var old = document.getElementById("sbPat");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var flow = (p.originalDAG || []).map(function (s) {
      return '<span class="sb-p-step">' + esc(String(s).split("(")[0].replace(/_/g, " ")) + "</span>";
    }).join('<span class="sb-p-arr">→</span>');

    var branches = (p.branchingDAG || []).map(function (b) {
      var acts = (b.actions || []).map(function (a) {
        return '<code>' + esc(String(a).split("(")[0]) + "</code>";
      }).join(" ");
      return '<div class="sb-p-br' + (b.tier === "escalation" ? " esc" : "") + '">' +
        '<div class="sb-p-cond">' + esc(b.condition || b.cond || "") + "</div>" +
        '<div class="sb-p-acts">' + acts + "</div>" +
        (b.hitl ? '<div class="sb-p-hitl">🔒 HITL gate: ' + esc(b.hitl) + "</div>" : "") +
        "</div>";
    }).join("");

    var d = el("div", "sb-pat");
    d.id = "sbPat";
    d.innerHTML =
      '<div class="sb-pat-p">' +
        '<div class="sb-pat-h">' +
          '<span class="sb-pat-n">#' + p.id + "</span>" +
          "<h3>" + esc(p.name) + "</h3>" +
          '<button class="sb-pat-x">✕</button>' +
        "</div>" +
        '<div class="sb-pat-tags">' +
          '<span class="sb-tag pri-' + esc(String(p.priority).toLowerCase()) + '">' +
            esc(p.priority) + " priority</span>" +
          '<span class="sb-tag cat">' + esc(p.category) + "</span>" +
        "</div>" +
        '<div class="sb-pat-mm">“' + esc(p.mentalModel) + '”' +
          '<span class="who">— the analyst\'s mental model</span></div>' +
        '<div class="sb-pat-s"><h5>Process flow <i>the happy path</i></h5>' +
          '<div class="sb-p-flow">' + flow + "</div></div>" +
        (branches ? '<div class="sb-pat-s"><h5>Branches <i>what reality actually does</i></h5>' +
          branches + "</div>" : "") +
        ((p.hitlGates || []).length ? '<div class="sb-pat-gate">🔒 HITL gates: ' +
          p.hitlGates.map(esc).join(" · ") + "</div>" : "") +
      "</div>";
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add("in"); });
    d.querySelector(".sb-pat-x").onclick = function () { close(); };
    d.onclick = function (e) { if (e.target === d) close(); };
    function close() {
      d.classList.remove("in");
      document.removeEventListener("keydown", onEsc);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 220);
    }
    function onEsc(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
    document.addEventListener("keydown", onEsc);
    // the slide-over IS the drilldown; a concurrent narration would just overlap it
  }

  /* ---- wiring ---------------------------------------------------------- */

  PIQ.sandbox = {
    activate: activate, exit: exit, reset: reset, active: active,
    narrate: narrate, toast: toast, guard: guard,
    showPatternDetail: showPatternDetail,
    composition: function () { return PIQ.composition; },
    DEMO: DEMO, TALKING_POINTS: TALKING_POINTS,
  };

  var boot = PIQ.boot;
  PIQ.boot = function () {
    boot();

    var btn = document.getElementById("tryDemo");
    if (btn) btn.onclick = function () { on ? exit() : activate(); };

    document.addEventListener("keydown", function (e) {
      if (!e.ctrlKey || !e.shiftKey) return;
      var k = (e.key || "").toLowerCase();
      if (k === "d") { e.preventDefault(); on ? exit() : activate(); }
      else if (k === "s") { e.preventDefault(); activate({ salesMode: true }); }
      else if (k === "r") { e.preventDefault(); reset(); }
    });

    var p = new URLSearchParams(window.location.search);
    var demo = p.get("demo"), sb = p.get("sandbox");
    if (demo === "sales") activate({ salesMode: true });
    else if (demo === "true" || sb === "true") activate();
  };
})();
