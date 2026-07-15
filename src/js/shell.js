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
    // the process an SME is composing — threaded through all three stages.
    // Deck Unified Hierarchy: Theme → Objective → Mission → Capability → Pattern.
    composition: {
      themeId: null,       // business theme (Theme, L1)
      objectiveIds: [],    // objectives in scope under the theme (L2)
      missionIds: [],      // persona-owned missions in scope (L3)
      capabilityIds: [],   // KPI-instrument capabilities in scope (L4)
      patternIds: [],      // selected patterns (L5)
      blocks: {},          // blockKey -> { mode:'auto'|'hitl', tech:string, configured:bool }
      dag: {},             // patternId -> { steps:[{k:string,on:bool}] } action-chain customisation
      live: false,         // promoted to Run & Govern
      fnFilter: null,      // function is a cross-cutting FILTER lens, not a hierarchy level
    },
  };

  /* ---- journey map: 4 builder stages, each with sub-views ----------------
     Rendered as a vertical sidebar inside the Transformation Builder. No stage
     numbers anywhere — the order is carried by the stacking, not by a badge. */
  var STAGES = [
    { id: "design", label: "Design", tag: "Missions → Actions", sub: [
        { id: "studio", label: "Transformation Studio" },
        // Pattern Studio is now embedded inside the Transformation Studio's Pattern
        // step; kept here (hidden from the sidebar) so cross-tile deep-links to it
        // and ?view=patternstudio still resolve via stageOf().
        { id: "patternstudio", label: "Pattern Studio", hidden: true } ] },
    { id: "fit", label: "Discover & Fit", tag: "Discovery & Fit", soon: true,
      blurb: "Take the process you composed in Design and pressure-test it against reality: mine the " +
             "event log and client documents for patterns you haven't named yet, then assess every " +
             "action block for how much an agent can safely own.",
      sub: [
        { id: "discovery", label: "Discovery Engine",
          desc: "Mines the event log and source documents (math → text → LLM pipeline) to surface new behavioural patterns beyond the seeded library, ready for SME approval." },
        { id: "fitment", label: "Agent Fitment",
          desc: "Scores every action block for agent fit — Full-auto, Assisted or Human-led — agentivises the happy path, and produces the to-be flow." } ] },
    { id: "build", label: "Build", tag: "Action chains → agents", soon: true,
      blurb: "Turn the configured action chains into running software: bind each action block to an " +
             "executor, wire the guardrails, and promote a validated agent chain to production.",
      sub: [
        { id: "build", label: "Implementation Studio",
          desc: "Assembles the configured action blocks into validated agent chains — tech stack bound, execution mode set, rollback and connectivity checked — then promotes to production." } ] },
    { id: "run", label: "Run & Govern", tag: "Agentic Workflow", soon: true,
      blurb: "Operate the live process: straight-through on the happy path, variations matched to " +
             "patterns and routed for approval, all under continuous oversight and value tracking.",
      sub: [
        { id: "runtime", label: "Live Operations",
          desc: "Straight-through processing on the happy path; variations matched to patterns and routed for approval, with live KPIs." },
        { id: "cockpit", label: "Cognitive Cockpit",
          desc: "The Sense → Diagnose → Decide → Act operating picture across the running agents." },
        { id: "governance", label: "Governance",
          desc: "Trust modes and the Saga simulator — retry → compensate → escalate, with HITL gates on WRITE blocks." },
        { id: "roi", label: "ROI & Attribution",
          desc: "Tracks realised value and attributes it back to the patterns and action blocks that delivered it." } ] },
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
    if (stageId === "design") return c.patternIds.length ? "done" : ((c.themeId || c.objectiveIds.length) ? "wip" : "todo");
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
  // the selected theme's, or (if none) every theme touching the filtered function.
  PIQ.compoundPatterns = function () {
    var c = PIQ.composition, out = [];
    (PIQ.tax.themes || []).forEach(function (t) {
      if (c.themeId) { if (t.id !== c.themeId) return; }
      else if (c.fnFilter && (t.functionIds || []).indexOf(c.fnFilter) < 0) return;
      else if (!c.fnFilter && !c.themeId) return;
      (t.crossProcessPatterns || []).forEach(function (cp) {
        out.push({ theme: t, cp: cp, constituents: PIQ.compoundConstituents(cp) });
      });
    });
    return out;
  };

  /* ---- Unified Hierarchy navigation: Theme → Objective → Mission → Capability → Pattern.
     "*All()" helpers return every child of the current selection (the pool a wizard
     step chooses from); the bare helpers return only the in-scope (selected) items. */

  // function is a cross-cutting FILTER now, not a hierarchy level
  PIQ.fn = function () {
    var id = PIQ.composition.fnFilter;
    if (!id) return null;
    return (PIQ.tax.functions || []).filter(function (f) { return f.id === id; })[0] || null;
  };

  // every objective under the selected theme (L2 pool)
  PIQ.themeObjectives = function () {
    var t = PIQ.theme();
    return (t && t.objectives) ? t.objectives : [];
  };
  // objectives in scope (selected)
  PIQ.objectives = function () {
    var c = PIQ.composition;
    return PIQ.themeObjectives().filter(function (o) { return c.objectiveIds.indexOf(o.id) >= 0; });
  };
  PIQ.objective = function () { return PIQ.objectives()[0] || null; };

  // distinct missions under the in-scope objectives (L3 pool), function-filtered
  PIQ.objectiveMissions = function () {
    var seen = {}, out = [], fnf = PIQ.composition.fnFilter;
    PIQ.objectives().forEach(function (o) {
      (o.missions || []).forEach(function (m) {
        if (seen[m.id]) return;
        if (fnf && m.functionId !== fnf) return;
        seen[m.id] = 1; out.push(m);
      });
    });
    return out;
  };
  // missions in scope (selected)
  PIQ.missions = function () {
    var c = PIQ.composition;
    return PIQ.objectiveMissions().filter(function (m) { return c.missionIds.indexOf(m.id) >= 0; });
  };

  // distinct capabilities under the in-scope missions (L4 pool)
  PIQ.missionCapabilities = function () {
    var seen = {}, out = [];
    PIQ.missions().forEach(function (m) {
      (m.capabilities || []).forEach(function (cap) {
        if (seen[cap.id]) return; seen[cap.id] = 1; out.push(cap);
      });
    });
    return out;
  };
  // capabilities in scope (selected)
  PIQ.capabilities = function () {
    var c = PIQ.composition;
    return PIQ.missionCapabilities().filter(function (cap) { return c.capabilityIds.indexOf(cap.id) >= 0; });
  };

  // personas (roles) in scope — derived from the selected missions, grouped by persona
  PIQ.roles = function () {
    var byName = {}, out = [];
    PIQ.missions().forEach(function (m) {
      var r = byName[m.persona];
      if (!r) { r = byName[m.persona] = { id: "persona-" + m.persona, name: m.persona, missions: [], functionIds: [] }; out.push(r); }
      r.missions.push(m);
      if (r.functionIds.indexOf(m.functionId) < 0) r.functionIds.push(m.functionId);
    });
    return out;
  };

  // union of every pattern id across the in-scope CAPABILITIES (falls back to the
  // in-scope missions' capabilities when no capability has been explicitly selected)
  PIQ.objectivePatternIds = function () {
    var caps = PIQ.capabilities();
    if (!caps.length) caps = PIQ.missionCapabilities();
    var seen = {}, out = [];
    caps.forEach(function (cap) {
      (cap.patternIds || []).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
    });
    return out;
  };

  // the action chains of the currently selected patterns (deck L6)
  PIQ.actionChains = function () {
    return PIQ.selectedPatterns().map(function (p) {
      return { pattern: p, chain: p.actionChain || { id: "ac-" + p.id, name: p.name, steps: (p.originalDAG || []) } };
    });
  };

  // ---- action-chain customisation (per-composition, per-pattern) ----------
  // Canonical source is pattern.actionChain.steps (deck rename); originalDAG is a
  // retained back-compat alias. The editable step list seeds from the chain, then
  // persists reorder + on/off.
  function chainSteps(p) {
    if (!p) return [];
    if (p.actionChain && p.actionChain.steps) return p.actionChain.steps;
    return p.originalDAG || [];
  }
  PIQ.chainSteps = chainSteps;
  PIQ.dagSteps = function (id) {
    var ov = (PIQ.composition.dag || {})[id];
    if (ov && ov.steps) return ov.steps;
    return chainSteps(PIQ.pattern(id)).map(function (k) { return { k: k, on: true }; });
  };
  // resolved happy path the rest of the app runs on: enabled steps in user order.
  PIQ.happyDAG = function (id) {
    var ov = (PIQ.composition.dag || {})[id];
    if (ov && ov.steps) return ov.steps.filter(function (s) { return s.on; }).map(function (s) { return s.k; });
    return chainSteps(PIQ.pattern(id)).slice();
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
      chainSteps(p).forEach(add);
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
    PIQ.composition = { themeId: null, objectiveIds: [], missionIds: [], capabilityIds: [],
      patternIds: [], blocks: {}, dag: {}, live: false, fnFilter: null };
    PIQ.persistComposition();
  };

  /* ---- composition persistence (survives reloads) ----------------------
     The app is light-theme only — there is no theme mode to persist.
     Key bumped to v2 for the Unified-Hierarchy composition shape.           */
  var STORE_KEY = "piq.composition.v2";
  PIQ.persistComposition = function () {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(PIQ.composition)); } catch (e) {}
  };
  PIQ.restoreComposition = function () {
    try {
      var raw = localStorage.getItem(STORE_KEY); if (!raw) return;
      var saved = JSON.parse(raw); if (!saved || typeof saved !== "object") return;
      // only restore if the saved theme still exists in the taxonomy
      if (saved.themeId && !(PIQ.tax.themes || []).some(function (t) { return t.id === saved.themeId; })) return;
      PIQ.composition = {
        themeId: saved.themeId || null,
        objectiveIds: Array.isArray(saved.objectiveIds) ? saved.objectiveIds : [],
        missionIds: Array.isArray(saved.missionIds) ? saved.missionIds : [],
        capabilityIds: Array.isArray(saved.capabilityIds) ? saved.capabilityIds : [],
        patternIds: Array.isArray(saved.patternIds) ? saved.patternIds : [],
        blocks: saved.blocks && typeof saved.blocks === "object" ? saved.blocks : {},
        dag: saved.dag && typeof saved.dag === "object" ? saved.dag : {},
        live: !!saved.live,
        fnFilter: saved.fnFilter || null,
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

  /* Builder sidebar: four stacked stages, each with its sub-views. Stages flagged
     `soon` render a "Coming soon" pill and are non-navigable (Design-only for now). */
  function builderSidebar(bar) {
    var stage = stageOf(PIQ.active);
    bar.innerHTML = homeLink() + STAGES.map(function (st) {
      var open = !collapsed[st.id];
      var status = PIQ.stageStatus(st.id);
      var items = st.sub.filter(function (s) { return !s.hidden; }).map(function (s) {
        return '<button class="sb-item' + (PIQ.active === s.id ? " on" : "") + '" data-v="' + s.id + '">' +
          '<span class="sb-label">' + esc(s.label) + '</span></button>';
      }).join("");
      // soon stages stay clickable (they open a "coming soon" overview) but swap the
      // caret for a pill and carry a dimmed `soon` class.
      var tail = st.soon ? '<span class="sb-soon">Coming soon</span>'
                         : '<span class="sb-caret">' + (open ? "▾" : "▸") + '</span>';
      return '<div class="sb-group' + (open ? " open" : "") + (st.soon ? " soon" : "") +
          (stage && stage.id === st.id ? " cur" : "") + '" data-st="' + st.id + '">' +
        '<button class="sb-head" data-head="' + st.id + '">' +
          '<span class="sb-status ' + status + '">' + STATUS_GLYPH[status] + '</span>' +
          '<span class="sb-txt">' + esc(st.label) + '<small>' + esc(st.tag) + '</small></span>' +
          tail +
        '</button>' +
        '<div class="sb-subs">' + items + '</div></div>';
    }).join("");

    bar.querySelectorAll(".sb-head[data-head]").forEach(function (h) {
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
    var c = PIQ.composition, t = PIQ.theme();
    if (!t) return '<span class="cr-empty">No theme selected — start in Studio</span>';
    var parts = [t.name];
    var objs = PIQ.objectives();
    if (objs.length === 1) parts.push(objs[0].name);
    else if (objs.length > 1) parts.push(objs.length + " objectives");
    var missions = PIQ.missions();
    if (missions.length === 1) parts.push(missions[0].name);
    else if (missions.length > 1) parts.push(missions.length + " missions");
    var s = parts.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('<i>›</i>');
    var nc = PIQ.capabilities().length;
    if (nc) s += '<i>›</i><span class="cr-count">' + nc + ' capabilit' + (nc > 1 ? "ies" : "y") + '</span>';
    var n = c.patternIds.length;
    if (n) s += '<i>›</i><span class="cr-count">' + n + ' pattern' + (n > 1 ? "s" : "") + '</span>';
    if (c.live) s += '<span class="cr-live">● LIVE</span>';
    return s;
  }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function go(id) {
    // stages flagged `soon` are not yet available — show a "coming soon" panel
    // (also catches the Studio hand-off that would otherwise jump into Discover & Fit)
    var st = PIQ.persona === "builder" ? stageOf(id) : null;
    if (st && st.soon) {
      PIQ.active = id;
      PIQ.persistComposition();
      renderSidebar();
      renderCrumb();
      var v = document.getElementById("view");
      v.innerHTML = "";
      v.appendChild(soonCard(st));
      window.scrollTo(0, 0);
      return;
    }
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

  function soonCard(st) {
    var subs = (st.sub || []).map(function (s) {
      return '<div class="soon-sub">' +
        '<div class="soon-sub-h"><span class="soon-sub-n">' + esc(s.label) + '</span>' +
          '<span class="soon-tag">Coming soon</span></div>' +
        (s.desc ? '<p class="soon-sub-d">' + esc(s.desc) + '</p>' : '') +
      '</div>';
    }).join("");
    var d = document.createElement("div");
    d.className = "soon-view";
    d.innerHTML = '<div class="soon-card">' +
      '<div class="soon-head">' +
        '<div><div class="soon-eyebrow">' + esc(st.tag) + '</div>' +
        '<h2>' + esc(st.label) + '</h2></div>' +
        '<div class="soon-badge">Coming soon</div></div>' +
      (st.blurb ? '<p class="soon-lede">' + esc(st.blurb) + '</p>' : '') +
      '<div class="soon-subs-h">What ships in this stage</div>' +
      '<div class="soon-subs">' + subs + '</div>' +
      '<div class="soon-foot"><span class="muted">Your composition is saved and will flow through here when this stage ships.</span>' +
        '<button class="btn go sm" id="soonBack">← Back to Design</button></div>' +
    '</div>';
    var b = d.querySelector("#soonBack");
    if (b) b.onclick = function () { go("studio"); };
    return d;
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
