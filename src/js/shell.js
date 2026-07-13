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
      themeId: null,      // business theme (spans functions) — optional top-level lens
      fnId: null, procId: null,
      roleIds: [],        // all personas participating in the chosen process
      objIds: [],         // objectives in scope (across the selected personas)
      patternIds: [],     // selected patterns
      blocks: {},         // blockKey -> { mode:'auto'|'hitl', tech:string, configured:bool }
      dag: {},            // patternId -> { steps:[{k:string,on:bool}] } happy-path customisation
      live: false,        // promoted to Run & Govern
    },
  };

  /* ---- journey map: 4 builder stages, each with sub-views ----------------
     Rendered as a vertical sidebar inside the Transformation Builder. No stage
     numbers anywhere — the order is carried by the stacking, not by a badge. */
  var STAGES = [
    { id: "design", label: "Design", tag: "Missions → Actions", sub: [
        { id: "studio", label: "Studio" },
        { id: "patternstudio", label: "Pattern Studio" } ] },
    { id: "fit", label: "Discover & Fit", tag: "Discovery & Fit", sub: [
        { id: "discovery", label: "Discovery Engine" },
        { id: "fitment", label: "Agent Fitment" } ] },
    { id: "build", label: "Build", tag: "Implementation Studio", sub: [
        { id: "build", label: "Implementation Studio" } ] },
    { id: "run", label: "Run & Govern", tag: "Agentic Workflow", sub: [
        { id: "runtime", label: "Live Operations" },
        { id: "cockpit", label: "Cognitive Cockpit" },
        { id: "governance", label: "Governance" },
        { id: "roi", label: "ROI & Attribution" } ] },
  ];
  PIQ.STAGES = STAGES;

  /* ---- the two surfaces -------------------------------------------------
     builder — compose, fit, assemble and run the process (stages + sub-views)
     command — consume the outcomes (persona picker → curated dashboard)
     Both navigate from the same vertical left sidebar. Passed as ?persona=<id>
     from the landing page; builder is the default.                          */
  var PERSONAS = {
    builder: { label: "Transformation Builder", stages: ["design", "fit", "build", "run"], entry: "studio" },
    command: { label: "Command Centre",         stages: ["cfo"],                           entry: "cc" },
  };
  PIQ.PERSONAS = PERSONAS;
  PIQ.persona = "builder";

  // Command Centre nav state — owned by the shell (the sidebar drives it), read by cfo.js
  PIQ.cc = { persona: null, tab: "pulse", custom: false };
  function readPersona() {
    try { var m = /[?&]persona=([a-z]+)/i.exec(window.location.search); return m ? m[1].toLowerCase() : null; }
    catch (e) { return null; }
  }

  /* stage completion, read off the composition — drives the sidebar status dots */
  PIQ.stageStatus = function (stageId) {
    var c = PIQ.composition;
    if (stageId === "design") return c.patternIds.length ? "done" : (c.fnId ? "wip" : "todo");
    if (stageId === "fit") {
      if (!c.patternIds.length) return "todo";
      return Object.keys(c.blocks || {}).length ? "done" : "wip";
    }
    if (stageId === "build") return c.live ? "done" : (c.patternIds.length ? "wip" : "todo");
    if (stageId === "run") return c.live ? "done" : "todo";
    return "todo";
  };

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

  // the business theme (optional top-level lens) currently in scope
  PIQ.theme = function () {
    return (PIQ.tax.themes || []).filter(function (t) { return t.id === PIQ.composition.themeId; })[0] || null;
  };
  // functions a theme spans (resolved objects); all functions if no theme selected
  PIQ.themeFunctions = function () {
    var t = PIQ.theme(), all = PIQ.tax.functions || [];
    if (!t) return all;
    var ids = t.functionIds || [];
    var some = all.filter(function (f) { return ids.indexOf(f.id) >= 0; });
    return some.length ? some : all;
  };

  // pull the referenced pattern ids ("#27") out of a compound pattern's triggers
  PIQ.compoundConstituents = function (cp) {
    var seen = {}, out = [];
    (cp.triggers || []).forEach(function (t) {
      (String(t).match(/#(\d+)/g) || []).forEach(function (m) {
        var id = +m.slice(1); if (!seen[id]) { seen[id] = 1; out.push(id); }
      });
    });
    return out;
  };
  // cross-process compound patterns applicable to the current composition:
  // the selected theme's, or (if none) every theme touching the chosen function.
  PIQ.compoundPatterns = function () {
    var c = PIQ.composition, out = [];
    (PIQ.tax.themes || []).forEach(function (t) {
      if (c.themeId) { if (t.id !== c.themeId) return; }
      else if (c.fnId && (t.functionIds || []).indexOf(c.fnId) < 0) return;
      else if (!c.fnId && !c.themeId) return;
      (t.crossProcessPatterns || []).forEach(function (cp) {
        out.push({ theme: t, cp: cp, constituents: PIQ.compoundConstituents(cp) });
      });
    });
    return out;
  };

  PIQ.fn = function () {
    return (PIQ.tax.functions || []).filter(function (f) { return f.id === PIQ.composition.fnId; })[0] || null;
  };
  PIQ.proc = function () {
    var f = PIQ.fn(); var c = PIQ.composition; if (!f) return null;
    return f.processes.filter(function (x) { return x.id === c.procId; })[0] || null;
  };
  // personas (roles) currently in scope
  PIQ.roles = function () {
    var p = PIQ.proc(); var c = PIQ.composition; if (!p) return [];
    return p.roles.filter(function (r) { return c.roleIds.indexOf(r.id) >= 0; });
  };
  // objectives in scope, across every selected persona
  PIQ.objectives = function () {
    var p = PIQ.proc(); var c = PIQ.composition; if (!p) return [];
    var out = [];
    p.roles.forEach(function (r) {
      if (c.roleIds.indexOf(r.id) < 0) return;
      (r.objectives || []).forEach(function (o) { if (c.objIds.indexOf(o.id) >= 0) out.push(o); });
    });
    return out;
  };
  // first in-scope objective — kept for compact single-line labels
  PIQ.objective = function () { return PIQ.objectives()[0] || null; };
  // union of every pattern id across the in-scope objectives
  PIQ.objectivePatternIds = function () {
    var seen = {}, out = [];
    PIQ.objectives().forEach(function (o) {
      (o.patternIds || []).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
    });
    return out;
  };

  // ---- happy-path DAG customisation (per-composition, per-pattern) ----------
  // The editable step list: seeds from originalDAG, then persists reorder + on/off.
  PIQ.dagSteps = function (id) {
    var ov = (PIQ.composition.dag || {})[id];
    if (ov && ov.steps) return ov.steps;
    var p = PIQ.pattern(id);
    return ((p && p.originalDAG) || []).map(function (k) { return { k: k, on: true }; });
  };
  // resolved happy path the rest of the app runs on: enabled steps in user order.
  PIQ.happyDAG = function (id) {
    var ov = (PIQ.composition.dag || {})[id];
    if (ov && ov.steps) return ov.steps.filter(function (s) { return s.on; }).map(function (s) { return s.k; });
    var p = PIQ.pattern(id);
    return (p && p.originalDAG) ? p.originalDAG.slice() : [];
  };
  PIQ.dagCustomised = function (id) {
    var ov = (PIQ.composition.dag || {})[id];
    return !!(ov && ov.steps);
  };
  PIQ.resetDag = function (id) { if (PIQ.composition.dag) delete PIQ.composition.dag[id]; };

  // repository of every distinct action block across the whole library (real +
  // sample patterns, happy-path + variation actions) — for adding to a DAG.
  PIQ.actionRepository = function () {
    if (PIQ._actionRepo) return PIQ._actionRepo;
    var set = {};
    function add(tok) { (tok || "").split(" + ").forEach(function (raw) { var k = raw.trim(); if (k) set[k] = 1; }); }
    var stubs = PIQ.tax && PIQ.tax.stubPatterns ? PIQ.tax.stubPatterns : {};
    var all = (PIQ.patterns || []).concat(Object.keys(stubs).map(function (id) { return stubs[id]; }));
    all.forEach(function (p) {
      (p.originalDAG || []).forEach(add);
      (p.branchingDAG || []).forEach(function (b) { (b.actions || []).forEach(add); });
    });
    PIQ._actionRepo = Object.keys(set).sort();
    return PIQ._actionRepo;
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
      PIQ.happyDAG(id).forEach(function (s) { touch(s, id, "happy", false); });
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
    PIQ.composition = { themeId: null, fnId: null, procId: null, roleIds: [], objIds: [],
      patternIds: [], blocks: {}, dag: {}, live: false };
    PIQ.persistComposition();
  };

  /* ---- composition persistence (survives reloads) ----------------------
     The app is light-theme only — there is no theme mode to persist.        */
  var STORE_KEY = "piq.composition.v1";
  PIQ.persistComposition = function () {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(PIQ.composition)); } catch (e) {}
  };
  PIQ.restoreComposition = function () {
    try {
      var raw = localStorage.getItem(STORE_KEY); if (!raw) return;
      var saved = JSON.parse(raw); if (!saved || typeof saved !== "object") return;
      // only restore if the saved function still exists in the taxonomy
      if (saved.fnId && !(PIQ.tax.functions || []).some(function (f) { return f.id === saved.fnId; })) return;
      PIQ.composition = {
        themeId: saved.themeId || null,
        fnId: saved.fnId || null, procId: saved.procId || null,
        roleIds: Array.isArray(saved.roleIds) ? saved.roleIds : [],
        objIds: Array.isArray(saved.objIds) ? saved.objIds : [],
        patternIds: Array.isArray(saved.patternIds) ? saved.patternIds : [],
        blocks: saved.blocks && typeof saved.blocks === "object" ? saved.blocks : {},
        dag: saved.dag && typeof saved.dag === "object" ? saved.dag : {},
        live: !!saved.live,
      };
    } catch (e) {}
  };

  /* ---- router ---------------------------------------------------------- */
  // groups the SME has collapsed in the sidebar
  var collapsed = {};
  var STATUS_GLYPH = { todo: "", wip: "", done: "✓" };

  function homeLink() {
    return '<button class="sb-back" data-home="1">← Home</button>';
  }

  /* Builder sidebar: four collapsible stages, each with its sub-views. */
  function builderSidebar(bar) {
    var stage = stageOf(PIQ.active);
    bar.innerHTML = homeLink() + STAGES.map(function (st) {
      var open = !collapsed[st.id];
      var status = PIQ.stageStatus(st.id);
      var items = st.sub.map(function (s) {
        return '<button class="sb-item' + (PIQ.active === s.id ? " on" : "") + '" data-v="' + s.id + '">' +
          '<span class="sb-label">' + esc(s.label) + '</span></button>';
      }).join("");
      return '<div class="sb-group' + (open ? " open" : "") + (stage && stage.id === st.id ? " cur" : "") + '" data-st="' + st.id + '">' +
        '<button class="sb-head" data-head="' + st.id + '">' +
          '<span class="sb-status ' + status + '">' + STATUS_GLYPH[status] + '</span>' +
          '<span class="sb-txt">' + esc(st.label) + '<small>' + esc(st.tag) + '</small></span>' +
          '<span class="sb-caret">' + (open ? "▾" : "▸") + '</span>' +
        '</button>' +
        '<div class="sb-subs">' + items + '</div></div>';
    }).join("");

    bar.querySelectorAll(".sb-head").forEach(function (h) {
      h.onclick = function () {
        var id = h.dataset.head;
        // header of the stage you are standing in = pure expand/collapse; header of
        // another stage opens it *and* walks you to its first sub-view.
        if (stage && stage.id === id) { collapsed[id] = !collapsed[id]; renderSidebar(); return; }
        collapsed[id] = false;
        go(STAGES.filter(function (x) { return x.id === id; })[0].sub[0].id);
      };
    });
    bar.querySelectorAll(".sb-item").forEach(function (t) {
      t.onclick = function () { go(t.dataset.v); };
    });
  }

  /* Command Centre sidebar, two states:
       1 · no persona chosen — the 11-persona roster, CFO first, then grouped by function
       2 · inside a persona  — switch-role + the consumption lenses + customise

     The lenses are cadence buckets, and a persona only gets the tabs it has missions for:
     Tax has no Daily/Weekly mission, so Tax has no Pulse tab at all. `activeTabs` is
     computed in the generator — the shell never guesses. */
  var CC = window.PROCESSIQ_CC || {};
  function ccTabs() { return (CC.meta && CC.meta.tabs) || []; }
  function ccPersonas() { return CC.personas || []; }
  PIQ.ccPersona = function () {
    return ccPersonas().filter(function (p) { return p.id === PIQ.cc.persona; })[0] || null;
  };
  // the tab actually shown: the requested one if the persona has it, else its first
  PIQ.ccTab = function (p) {
    p = p || PIQ.ccPersona();
    if (!p) return "pulse";
    var act = p.activeTabs || [];
    return act.indexOf(PIQ.cc.tab) >= 0 ? PIQ.cc.tab : (act[0] || "pulse");
  };
  function tabMissionCount(p, tabId) {
    return ((p.tabs || {})[tabId] || {}).missions.length;
  }

  function commandSidebar(bar) {
    var cur = PIQ.ccPersona();

    if (!cur) {
      // ---- state 1: the roster ----
      var order = (CC.meta && CC.meta.groupOrder) || [];
      var byGroup = {}, groups = [];
      ccPersonas().forEach(function (p) {
        if (!byGroup[p.group]) { byGroup[p.group] = []; groups.push(p.group); }
        byGroup[p.group].push(p);
      });
      groups.sort(function (a, b) {
        var ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      bar.innerHTML = homeLink() + groups.map(function (g) {
        var items = byGroup[g].map(function (p) {
          return '<button class="sb-item' + (p.isOverview ? " overview" : "") + '" data-p="' + p.id + '">' +
            '<span class="sb-pic">' + p.icon + '</span>' +
            '<span class="sb-label">' + esc(p.label) +
              (p.isOverview ? '<small>all 8 objectives</small>' : '') + '</span>' +
            '<span class="sb-count">' + (p.isOverview ? (CC.meta.counts.missions) : p.missionCount) + '</span>' +
          '</button>';
        }).join("");
        return '<div class="sb-group open">' +
          '<div class="sb-cat">' + esc(g === "top" ? "CFO" : g) + '</div>' +
          '<div class="sb-subs">' + items + '</div></div>';
      }).join("");

      bar.querySelectorAll(".sb-item[data-p]").forEach(function (b) {
        b.onclick = function () {
          PIQ.cc.persona = b.dataset.p; PIQ.cc.custom = false;
          var p = PIQ.ccPersona();
          PIQ.cc.tab = (p.activeTabs || ["pulse"])[0];
          go("cc");
        };
      });
      return;
    }

    // ---- state 2: inside a persona ----
    var active = PIQ.ccTab(cur);
    var lenses = ccTabs().filter(function (t) {
      return (cur.activeTabs || []).indexOf(t.id) >= 0;
    }).map(function (t) {
      var n = cur.isOverview ? 0 : tabMissionCount(cur, t.id);
      return '<button class="sb-item' + (active === t.id ? " on" : "") + '" data-t="' + t.id + '">' +
        '<span class="sb-label">' + esc(t.label) + '<small>' + esc(t.cadences) + '</small></span>' +
        (n ? '<span class="sb-count">' + n + '</span>' : '') + '</button>';
    }).join("");

    bar.innerHTML = homeLink() +
      '<button class="sb-back sb-switch" data-switch="1">⤺ Switch role</button>' +
      '<div class="sb-persona"><span class="sb-pic big">' + cur.icon + '</span>' +
        '<div class="sb-ptxt"><span class="sb-pname">' + esc(cur.label) + '</span>' +
        '<small class="sb-phead">' + esc(cur.headline) + '</small></div></div>' +
      '<div class="sb-group open"><div class="sb-subs">' + lenses + '</div></div>' +
      '<div class="sb-rule"></div>' +
      '<button class="sb-item sb-cx" data-cx="1"><span class="sb-label">⚙ Customize</span></button>';

    bar.querySelectorAll(".sb-item[data-t]").forEach(function (b) {
      b.onclick = function () { PIQ.cc.tab = b.dataset.t; PIQ.cc.custom = false; go("cc"); };
    });
    bar.querySelector(".sb-switch").onclick = function () {
      PIQ.cc.persona = null; PIQ.cc.custom = false; go("cc");
    };
    bar.querySelector(".sb-cx").onclick = function () {
      PIQ.cc.custom = true; go("cc");
    };
  }

  function renderSidebar() {
    var bar = document.getElementById("sidebar");
    if (PIQ.persona === "command") commandSidebar(bar);
    else builderSidebar(bar);
    var home = bar.querySelector(".sb-back[data-home]");
    if (home) home.onclick = function () { window.location.href = "index.html"; };
  }

  // the breadcrumb sits at the top of the working area, above the module —
  // it describes the composition, so it is a Builder concern only.
  function renderCrumb() {
    var el = document.getElementById("workcrumb");
    var show = PIQ.persona === "builder";
    el.style.display = show ? "" : "none";
    el.innerHTML = show ? '<div class="crumb">' + crumb() + '</div>' : "";
  }

  function crumb() {
    var c = PIQ.composition, f = PIQ.fn(), t = PIQ.theme();
    if (!f && !t) return '<span class="cr-empty">No process selected — start in Studio</span>';
    var parts = [];
    if (t) parts.push(t.name);
    if (f) parts.push(f.name);
    var p = PIQ.proc();
    if (p) parts.push(p.name);
    var s = parts.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('<i>›</i>');
    var nr = c.roleIds.length;
    if (nr) s += '<i>›</i><span class="cr-count">' + nr + ' persona' + (nr > 1 ? "s" : "") + '</span>';
    var n = c.patternIds.length;
    if (n) s += '<i>›</i><span class="cr-count">' + n + ' pattern' + (n > 1 ? "s" : "") + '</span>';
    if (c.live) s += '<span class="cr-live">● LIVE</span>';
    return s;
  }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function go(id) {
    PIQ.active = id;
    PIQ.persistComposition();
    renderSidebar();
    renderCrumb();
    var view = document.getElementById("view");
    view.innerHTML = "";
    var mod = PIQ.modules[id];
    if (mod && mod.render) { mod.render(view); }
    else { view.appendChild(stubCard(id)); }
    window.scrollTo(0, 0);
  }
  PIQ.go = go;
  // modules mutate the composition; this re-reads the status dots + breadcrumb
  PIQ.refreshNav = function () { renderSidebar(); renderCrumb(); };
  // cross-surface jump: Command Centre → a Builder view (reloads into the builder)
  PIQ.goBuilder = function (viewId) {
    if ((PERSONAS[PIQ.persona] || {}).nav === "sidebar") return go(viewId);
    PIQ.persistComposition();
    window.location.href = "processiq.html?persona=builder&view=" + encodeURIComponent(viewId);
  };

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

  /* brand → reset the session and return to the landing page */
  var brandEl = document.querySelector(".brand");
  if (brandEl) {
    brandEl.style.cursor = "pointer";
    brandEl.title = "Reset session & return to the landing page";
    brandEl.addEventListener("click", function () {
      PIQ.resetComposition();
      window.location.href = "index.html";
    });
  }

  /* boot */
  document.getElementById("varStat").textContent = PIQ.E._money(PIQ.book.meta.valueAtRisk);
  document.getElementById("dateStat").textContent = PIQ.book.meta.asOfDate;

  // Boot: the landing page hands us one of the two surfaces. ?view= lets the
  // Command Centre deep-link into a specific Builder view.
  PIQ.boot = function () {
    PIQ.restoreComposition();
    var persona = readPersona();
    PIQ.persona = (persona && PERSONAS[persona]) ? persona : "builder";
    var entry = PERSONAS[PIQ.persona].entry;
    try {
      var m = /[?&]view=([a-z]+)/i.exec(window.location.search);
      if (m && PIQ.persona === "builder" && stageOf(m[1])) entry = m[1];
    } catch (e) {}
    go(entry);
  };
})();
