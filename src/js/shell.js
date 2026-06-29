/* Process Transformation Accelerator — Platform Shell
 * Owns shared state (window.PIQ), the two-level journey router (3 stages × sub-views),
 * the SME "composition" being designed, the global ERP toggle, and cross-pattern
 * helpers (resolve a pattern by id; collect the action blocks of a selection).
 *
 * The three stages mirror the Tiger BPT pipeline:
 *   1 Design          — Missions → Actions (Studio wizard + Pattern Library)
 *   2 Discover & Fit  — process discovery & agent fitment + happy-path agentivisation
 *   3 Run & Govern    — STP on the happy path; variations matched to patterns, routed
 *                       for DAG approval; monitoring + ROI.
 */
(function () {
  "use strict";

  window.PIQ = {
    erp: "sap",
    patterns: window.PROCESSIQ_PATTERNS.patterns,
    meta: window.PROCESSIQ_PATTERNS.meta,
    tax: window.PROCESSIQ_TAXONOMY,
    book: window.PROCESSIQ_PORTFOLIO,
    E: window.ProcessIQEngine,
    modules: {},     // registered by each module file
    active: null,    // current sub-view id
    _erpListeners: [],
    // the process an SME is composing — threaded through all three stages
    composition: {
      fnId: null, procId: null, roleId: null, objId: null,
      patternIds: [],     // selected patterns
      blocks: {},         // blockKey -> { mode:'auto'|'hitl', tech:string, configured:bool }
      live: false,        // promoted to Run & Govern
    },
  };

  /* ---- journey map: 3 stages, each with sub-views ---------------------- */
  var STAGES = [
    { id: "design", n: 1, label: "Design", tag: "Missions → Actions", sub: [
        { id: "studio", label: "Studio" },
        { id: "library", label: "Pattern Library" } ] },
    { id: "fit", n: 2, label: "Discover & Fit", tag: "Discovery & Agent Fitment", sub: [
        { id: "fitment", label: "Agent Fitment" },
        { id: "discovery", label: "Discovery Engine" } ] },
    { id: "run", n: 3, label: "Run & Govern", tag: "Agentic Workflow", sub: [
        { id: "runtime", label: "Live Operations" },
        { id: "cockpit", label: "Cognitive Cockpit" },
        { id: "governance", label: "Governance" },
        { id: "roi", label: "ROI & Attribution" } ] },
  ];
  PIQ.STAGES = STAGES;

  function stageOf(viewId) {
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i].sub.some(function (s) { return s.id === viewId; })) return STAGES[i];
    }
    return null;
  }

  /* ---- shared domain helpers ------------------------------------------- */
  PIQ.onErp = function (fn) { PIQ._erpListeners.push(fn); };

  // resolve a pattern id against the real library first, then sample stubs
  PIQ.pattern = function (id) {
    var p = PIQ.patterns.filter(function (x) { return x.id === id; })[0];
    if (p) return p;
    var s = PIQ.tax.stubPatterns[String(id)];
    return s || null;
  };

  PIQ.selectedPatterns = function () {
    return PIQ.composition.patternIds.map(PIQ.pattern).filter(Boolean);
  };

  PIQ.fn = function () {
    return (PIQ.tax.functions || []).filter(function (f) { return f.id === PIQ.composition.fnId; })[0] || null;
  };
  PIQ.objective = function () {
    var f = PIQ.fn(); var c = PIQ.composition; if (!f) return null;
    var p = f.processes.filter(function (x) { return x.id === c.procId; })[0]; if (!p) return null;
    var r = p.roles.filter(function (x) { return x.id === c.roleId; })[0]; if (!r) return null;
    return r.objectives.filter(function (x) { return x.id === c.objId; })[0] || null;
  };

  // Decompose selected patterns into unique configurable action blocks.
  // Happy-path blocks (originalDAG) are straight-through candidates; variation
  // blocks (branchingDAG actions) carry the HITL flag of their branch.
  PIQ.collectBlocks = function (patternIds) {
    var map = {};   // key -> block
    function touch(token, patId, source, hitl) {
      (token || "").split(" + ").forEach(function (raw) {
        var key = raw.trim(); if (!key) return;
        var b = map[key];
        if (!b) { b = map[key] = { key: key, label: prettify(key), patterns: [], source: source, hitl: !!hitl }; }
        if (b.patterns.indexOf(patId) < 0) b.patterns.push(patId);
        if (source === "happy") b.source = "happy";   // happy wins for labelling STP
        if (hitl) b.hitl = true;
      });
    }
    (patternIds || []).forEach(function (id) {
      var p = PIQ.pattern(id); if (!p) return;
      (p.originalDAG || []).forEach(function (s) { touch(s, id, "happy", false); });
      (p.branchingDAG || []).forEach(function (br) {
        (br.actions || []).forEach(function (a) { touch(a, id, "variation", !!br.hitl); });
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  };

  function prettify(token) {
    return token.replace(/\(/g, " (").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  }
  PIQ.prettify = prettify;

  // deterministic agent-fitment verdict for an action block (used by fitment + runtime)
  PIQ.fitment = function (block) {
    var t = block.key.toLowerCase();
    var human = /legal|cfo|vp|approv|hold|credit_review|write.?off|conditional/.test(t);
    var assisted = block.hitl || /escalate|notify|alert|review|route|propose|request/.test(t);
    if (human) return { tier: "Human-led", score: 0.55, mode: "hitl" };
    if (assisted) return { tier: "Assisted", score: 0.78, mode: "hitl" };
    return { tier: "Full-auto", score: 0.94, mode: "auto" };
  };

  PIQ.resetComposition = function () {
    PIQ.composition = { fnId: null, procId: null, roleId: null, objId: null,
      patternIds: [], blocks: {}, live: false };
  };

  /* ---- router ---------------------------------------------------------- */
  function renderNav() {
    var nav = document.getElementById("modnav");
    var stage = stageOf(PIQ.active);
    nav.innerHTML = "";
    STAGES.forEach(function (st, i) {
      var b = document.createElement("button");
      b.className = "stagetab" + (stage && stage.id === st.id ? " on" : "");
      b.innerHTML = '<span class="stnum">' + st.n + '</span>' +
        '<span class="stlbl">' + st.label + '<small>' + st.tag + '</small></span>';
      b.onclick = function () { go(st.sub[0].id); };
      nav.appendChild(b);
      if (i < STAGES.length - 1) {
        var a = document.createElement("span"); a.className = "stage-arrow"; a.textContent = "→";
        nav.appendChild(a);
      }
    });
  }

  function renderSub() {
    var bar = document.getElementById("subbar");
    var stage = stageOf(PIQ.active);
    if (!stage) { bar.innerHTML = ""; bar.classList.remove("on"); return; }
    bar.classList.add("on");
    var tabs = stage.sub.map(function (s) {
      return '<button class="subtab' + (PIQ.active === s.id ? " on" : "") + '" data-v="' + s.id + '">' + s.label + '</button>';
    }).join("");
    bar.innerHTML = '<div class="subtabs">' + tabs + '</div>' +
      '<div class="crumb">' + crumb() + '</div>';
    bar.querySelectorAll(".subtab").forEach(function (t) {
      t.onclick = function () { go(t.dataset.v); };
    });
  }

  function crumb() {
    var c = PIQ.composition, f = PIQ.fn();
    if (!f) return '<span class="cr-empty">No process selected — start in Studio</span>';
    var parts = [f.name];
    var obj = PIQ.objective();
    if (obj) parts.push(obj.name);
    var n = c.patternIds.length;
    var s = parts.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('<i>›</i>');
    if (n) s += '<i>›</i><span class="cr-count">' + n + ' pattern' + (n > 1 ? "s" : "") + '</span>';
    if (c.live) s += '<span class="cr-live">● LIVE</span>';
    return s;
  }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function go(id) {
    PIQ.active = id;
    renderNav();
    renderSub();
    var view = document.getElementById("view");
    view.innerHTML = "";
    var mod = PIQ.modules[id];
    if (mod && mod.render) { mod.render(view); }
    else { view.appendChild(stubCard(id)); }
    window.scrollTo(0, 0);
  }
  PIQ.go = go;

  function stubCard(id) {
    var d = document.createElement("div");
    d.className = "modstub";
    d.innerHTML = '<div class="modstub-card"><h2>' + esc(id) + '</h2>' +
      '<p>This view is not yet wired.</p></div>';
    return d;
  }

  /* ---- global ERP toggle ----------------------------------------------- */
  document.getElementById("erpToggle").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    PIQ.erp = b.dataset.erp;
    this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
    PIQ._erpListeners.forEach(function (fn) { try { fn(PIQ.erp); } catch (e) {} });
  });

  /* "Why" link → the narrative front door */
  var why = document.getElementById("whyLink");
  if (why) why.onclick = function (e) { e.preventDefault(); go("provocation"); };

  /* boot */
  document.getElementById("varStat").textContent = PIQ.E._money(PIQ.book.meta.valueAtRisk);
  document.getElementById("dateStat").textContent = PIQ.book.meta.asOfDate;

  // Open on the Studio — the SME's front door into the journey.
  PIQ.boot = function () { go("studio"); };
})();
