/* Stage 1 · Design — Studio
 * The SME's guided front door, aligned to the deck's Unified Hierarchy:
 *   Theme → Objective → Mission → Capability → Pattern → ActionChain → Configure.
 * Choosing a theme pulls in its objectives (and, by default, every mission,
 * capability and pattern underneath) so the SME can then narrow scope. The
 * in-scope capabilities surface the union of matching patterns; selecting
 * patterns exposes their action chains; configuring the action blocks hands off
 * to Stage 2 (Discover & Fit).
 *
 * A Mission is persona-owned; a Capability is a reusable KPI instrument; a
 * Pattern's actionChain is the straight-through spine recorded for agentivisation.
 * Function is a cross-cutting FILTER (composition.fnFilter), not a hierarchy level.
 */
(function () {
  "use strict";
  var PRIO = window.PIQ.meta.priorityLegend;

  var STEPS = ["Theme", "Objective", "Mission", "Capability", "Pattern", "ActionChain", "Configure"];
  var state = { step: 0 };

  // lucide-style theme icon names → emoji (no icon library is inlined)
  var THEME_ICONS = { "trending-up": "📈", "shield-alert": "🚨", "clock": "⏱️",
    "shield-check": "🛡️", "eye": "👁️", "award": "🏆", "recycle": "♻️", "banknote": "💰" };
  function themeIcon(name) { return THEME_ICONS[name] || "◆"; }

  // Friendly short labels for function tags (readable CFO-facing names).
  var FN_SHORT = { o2c: "O2C", p2p: "P2P", r2r: "R2R", sc: "SC", tcm: "Treasury",
    icc: "GRC", fpa: "FP&A", tax: "Tax", tne: "T&E", h2r: "HR" };
  function fnShort(id) { return FN_SHORT[id] || (fnById(id) ? fnById(id).short : id); }

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function C() { return window.PIQ.composition; }
  function theme() { return window.PIQ.theme(); }
  function fnById(id) { return (window.PIQ.tax.functions || []).filter(function (f) { return f.id === id; })[0]; }

  /* resume at the furthest resolved step when re-entering the Studio */
  function resumeStep() {
    var c = C();
    if (Object.keys(c.blocks).length) return 6;
    if (c.patternIds.length) return 5;
    if (c.capabilityIds.length) return 4;
    if (c.missionIds.length) return 3;
    if (c.objectiveIds.length) return 2;
    if (c.themeId) return 1;
    return 0;
  }

  function render(view) {
    state.step = resumeStep();
    view.innerHTML = '<div class="studio"></div>';
    draw(view.querySelector(".studio"));
  }

  function draw(root) {
    root.innerHTML = "";
    root.appendChild(intro());
    root.appendChild(rail());
    var wrap = el("div", "st-work");
    var body = el("div", "st-body");
    wrap.appendChild(body);
    var sum = summaryCard();
    if (sum) wrap.appendChild(sum);
    root.appendChild(wrap);
    drawStep(body);
    if (window.PIQ.persistComposition) window.PIQ.persistComposition();
  }

  /* Composition workspace — the always-on recap of every selection so far. */
  function summaryCard() {
    var c = C(), t = theme();
    if (!t) return null;
    var objs = window.PIQ.objectives();
    var missions = window.PIQ.missions();
    var caps = window.PIQ.capabilities();
    var pats = window.PIQ.selectedPatterns();

    var rows = [["Theme", t.name]].filter(function (x) { return x[1]; }).map(function (x) {
      return '<div class="sum-row"><span class="sum-k">' + x[0] + '</span>' +
        '<span class="sum-v">' + esc(x[1]) + '</span></div>';
    }).join("");
    if (c.fnFilter) {
      rows += '<div class="sum-row"><span class="sum-k">Function filter</span>' +
        '<span class="sum-v">' + esc(fnShort(c.fnFilter)) + '</span></div>';
    }

    rows += chipRow("Objectives", objs.map(function (o) { return o.name; }));
    rows += chipRow("Missions", missions.map(function (m) { return m.name; }));
    rows += chipRow("Capabilities", caps.map(function (cp) { return cp.name; }));

    var patBlock = "";
    if (pats.length) {
      var chips = pats.map(function (pt) {
        return '<span class="sum-chip">' + esc(pt.name) + (pt.sample ? ' <i>sample</i>' : '') + '</span>';
      }).join("");
      patBlock = '<div class="sum-row col"><span class="sum-k">Patterns <b>' + pats.length + '</b></span>' +
        '<div class="sum-chips">' + chips + '</div></div>';
    }

    var blockRow = "";
    var keys = Object.keys(c.blocks);
    if (keys.length) {
      var nConf = keys.filter(function (k) { return c.blocks[k].configured; }).length;
      blockRow = '<div class="sum-row"><span class="sum-k">Action blocks</span>' +
        '<span class="sum-v">' + nConf + ' / ' + keys.length + ' configured</span></div>';
    }

    return el("div", "st-summary",
      '<div class="sum-h"><span>Composition workspace</span>' +
      (c.live ? '<span class="cr-live">● LIVE</span>' : '') + '</div>' +
      rows + patBlock + blockRow);
  }

  function chipRow(label, names) {
    if (!names.length) return "";
    var chips = names.map(function (n) { return '<span class="sum-chip">' + esc(n) + '</span>'; }).join("");
    return '<div class="sum-row col"><span class="sum-k">' + label + ' <b>' + names.length + '</b></span>' +
      '<div class="sum-chips">' + chips + '</div></div>';
  }

  /* Intro — lede + a function FILTER (studio-owned, not the global topbar) + reset. */
  function intro() {
    var c = C(), t = theme();
    var fnIds = t ? (t.functionIds || []) : (window.PIQ.tax.functions || []).map(function (f) { return f.id; });
    var opts = '<option value="">All functions</option>' + fnIds.map(function (id) {
      return '<option value="' + id + '"' + (c.fnFilter === id ? " selected" : "") + '>' + esc(fnById(id) ? fnById(id).name : id) + '</option>';
    }).join("");
    return el("div", "st-intro",
      '<div><div class="kv">Stage 1 · Design — Theme → Objective → Mission → Capability → Pattern</div>' +
      '<h2>Compose a process to transform</h2>' +
      '<p class="st-lede">Pick the theme top-down, choose the missions and the capabilities that measure them, ' +
      'select the behavioural patterns, then compose and configure their action chains.</p></div>' +
      '<div class="st-intro-ctl">' +
        '<label class="st-fnfilter">Function <select id="stFnFilter">' + opts + '</select></label>' +
        '<button class="btn ghost sm" id="stReset">Start over</button></div>');
  }

  function rail() {
    var done = resumeStep();
    var r = el("div", "st-rail");
    r.innerHTML = STEPS.map(function (s, i) {
      var cls = i === state.step ? "on" : (i < done || isResolved(i) ? "done" : "");
      var reachable = i <= done;
      return '<button class="st-step ' + cls + '" data-i="' + i + '"' + (reachable ? "" : " disabled") + '>' +
        '<span class="st-dot">' + (isResolved(i) && i !== state.step ? "✓" : (i + 1)) + '</span>' +
        '<span class="st-name">' + s + '</span>' + chosen(i) + '</button>';
    }).join('<span class="st-sep"></span>');
    r.querySelectorAll(".st-step").forEach(function (b) {
      if (b.hasAttribute("disabled")) return;
      b.onclick = function () { state.step = +b.dataset.i; redraw(); };
    });
    return r;
  }

  function isResolved(i) {
    var c = C();
    return [!!c.themeId, c.objectiveIds.length > 0, c.missionIds.length > 0, c.capabilityIds.length > 0,
            c.patternIds.length > 0, c.patternIds.length > 0, Object.keys(c.blocks).length > 0][i];
  }
  function chosen(i) {
    var c = C(), t = theme();
    var label = "";
    if (i === 0 && t) label = t.name;
    else if (i === 1 && c.objectiveIds.length) label = c.objectiveIds.length + " objective" + (c.objectiveIds.length > 1 ? "s" : "");
    else if (i === 2 && c.missionIds.length) label = c.missionIds.length + " mission" + (c.missionIds.length > 1 ? "s" : "");
    else if (i === 3 && c.capabilityIds.length) label = c.capabilityIds.length + " capabilit" + (c.capabilityIds.length > 1 ? "ies" : "y");
    else if (i === 4 && c.patternIds.length) label = c.patternIds.length + " selected";
    else if (i === 5 && c.patternIds.length) label = c.patternIds.length + " chain" + (c.patternIds.length > 1 ? "s" : "");
    else if (i === 6 && Object.keys(c.blocks).length) label = Object.keys(c.blocks).length + " configured";
    return label ? '<small class="st-chose">' + esc(label) + '</small>' : "";
  }

  /* ---- scope re-derivation (each level defaults its descendants to "all in scope") ---- */
  function syncMissions() { C().missionIds = window.PIQ.objectiveMissions().map(function (m) { return m.id; }); syncCaps(); }
  function syncCaps() { C().capabilityIds = window.PIQ.missionCapabilities().map(function (cp) { return cp.id; }); syncPatterns(); }
  function syncPatterns() { C().patternIds = window.PIQ.objectivePatternIds(); C().blocks = {}; }

  function redraw() { draw(document.querySelector(".studio")); }

  /* ---------------- steps ---------------- */
  function drawStep(body) {
    if (state.step > 0) body.appendChild(backBtn());
    [stepTheme, stepObjective, stepMission, stepCapability, stepPattern, stepActionChain, stepConfigure][state.step](body);
    var rb = document.getElementById("stReset");
    if (rb) rb.onclick = function () { window.PIQ.resetComposition(); state.step = 0; redraw(); };
    var ff = document.getElementById("stFnFilter");
    if (ff) ff.onchange = function () {
      C().fnFilter = ff.value || null;
      syncMissions();   // re-derive the mission pool under the new filter
      redraw();
    };
  }

  function backBtn() {
    var b = el("button", "btn ghost sm st-back", "← Back to " + STEPS[state.step - 1]);
    b.onclick = function () { state.step = Math.max(0, state.step - 1); redraw(); };
    return b;
  }

  function pickGrid(items, build, onPick, isSel) {
    var g = el("div", "pickgrid");
    items.forEach(function (it) {
      var card = el("div", "pickcard" + (isSel && isSel(it) ? " sel" : ""), build(it));
      card.onclick = function () { onPick(it); };
      g.appendChild(card);
    });
    return g;
  }

  /* Step 0 · Theme — the CFO-level outcome (L1). Spans functions, carries a
     compound KPI; choosing one pulls its whole objective→mission→pattern subtree
     into scope by default. */
  function stepTheme(body) {
    var c = C();
    var themes = window.PIQ.tax.themes || [];
    body.appendChild(el("div", "st-q", "Which <b>business theme</b> are you driving?"));
    body.appendChild(el("p", "st-hint",
      "Themes are the outcomes a CFO steers by — they span multiple functions and roll up to a compound KPI. " +
      "Picking one brings its objectives, missions, capabilities and patterns into scope; you narrow from there."));
    var grid = pickGrid(themes, function (t) {
      var on = c.themeId === t.id;
      var k = t.compoundKPI || {};
      var fns = (t.functionIds || []).map(fnShort).join(" · ");
      var nObj = (t.objectives || []).length;
      return '<div class="pc-ico" style="--ac:' + t.accent + '">' + themeIcon(t.icon) + '</div>' +
        '<div class="pc-main"><div class="pc-t">' + esc(t.name) +
          (t.strategic ? ' <span class="pc-tag">strategic</span>' : '') + '</div>' +
        '<div class="pc-d">' + esc(t.tagline) + '</div></div>' +
        '<div class="pc-kpi"><span class="pck-n">' + esc(k.name) + '</span>' +
          '<span class="pck-v">' + esc(k.current) + ' <i>→</i> <b>' + esc(k.target) + '</b> ' + esc(k.unit) + '</span></div>' +
        '<div class="pc-meta"><span class="pc-n">' + nObj + '</span> objectives · spans <b>' + esc(fns) + '</b></div>' +
        (on ? '<div class="pc-on">✓</div>' : '');
    }, function (t) {
      if (c.themeId !== t.id) {
        c.themeId = t.id;
        c.fnFilter = null;
        c.objectiveIds = (t.objectives || []).map(function (o) { return o.id; });  // all objectives in scope by default
        syncMissions();
      }
      state.step = 1;
      redraw();
    }, function (t) { return c.themeId === t.id; });
    body.appendChild(grid);
  }

  /* Step 1 · Objective (L2) — multi-select objectives under the theme. */
  function stepObjective(body) {
    var c = C(), t = theme();
    if (!t) { state.step = 0; return redraw(); }
    var objs = window.PIQ.themeObjectives();
    body.appendChild(el("div", "st-q",
      "Which <b>objectives</b> under “" + esc(t.name) + "”?" +
      '<button class="linkbtn" id="stAllO">' + (c.objectiveIds.length === objs.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "Objectives decompose the theme. Each names the KPI it moves, the missions that pursue it, and the functions it touches."));
    body.appendChild(pickGrid(objs, function (o) {
      var on = c.objectiveIds.indexOf(o.id) >= 0;
      var fns = (o.functionIds || []).map(fnShort).join(" · ");
      return '<div class="pc-main"><div class="pc-t">' + esc(o.name) + '</div>' +
        '<div class="pc-d">Measured by <b>' + esc(o.kpi) + '</b></div></div>' +
        '<div class="pc-meta"><span class="pc-n">' + o.missionCount + '</span> missions · <span class="pc-tag">' + esc(fns) + '</span></div>' +
        (on ? '<div class="pc-on">✓</div>' : '');
    }, function (o) { toggleObjective(o); redraw(); },
       function (o) { return c.objectiveIds.indexOf(o.id) >= 0; }));

    var nm = window.PIQ.objectiveMissions().length;
    body.appendChild(nextBar(c.objectiveIds.length + " objective" + (c.objectiveIds.length !== 1 ? "s" : "") + " · " + nm + " mission" + (nm !== 1 ? "s" : ""),
      c.objectiveIds.length ? "Choose missions →" : "", function () { state.step = 2; redraw(); }));
    var all = document.getElementById("stAllO");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.objectiveIds = c.objectiveIds.length === objs.length ? [] : objs.map(function (o) { return o.id; });
      syncMissions(); redraw();
    };
  }
  function toggleObjective(o) {
    var c = C(), i = c.objectiveIds.indexOf(o.id);
    if (i >= 0) c.objectiveIds.splice(i, 1); else c.objectiveIds.push(o.id);
    syncMissions();
  }

  /* Step 2 · Mission (L3) — persona-owned; multi-select, all in scope by default. */
  function stepMission(body) {
    var c = C();
    var pool = window.PIQ.objectiveMissions();
    if (!pool.length) { state.step = 1; return redraw(); }
    body.appendChild(el("div", "st-q",
      "Which <b>missions</b> should the agents run?" +
      '<button class="linkbtn" id="stAllM">' + (c.missionIds.length === pool.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "A mission is a unit of accountability owned by one persona. All are in scope by default; each carries the capabilities that tell you whether it is working."));
    body.appendChild(pickGrid(pool, function (m) {
      var on = c.missionIds.indexOf(m.id) >= 0;
      return '<div class="pc-main"><div class="pc-t">' + esc(m.name) + '</div>' +
        '<div class="pc-d">Owned by <b>' + esc(m.persona) + '</b> · measured by ' + esc(m.kpi) + '</div></div>' +
        '<div class="pc-meta"><span class="pc-n">' + m.capabilityCount + '</span> capabilities · <span class="pc-tag">' + esc(fnShort(m.functionId)) + '</span></div>' +
        (on ? '<div class="pc-on">✓</div>' : '');
    }, function (m) { toggleMission(m); redraw(); },
       function (m) { return c.missionIds.indexOf(m.id) >= 0; }));

    body.appendChild(nextBar(c.missionIds.length + " mission" + (c.missionIds.length !== 1 ? "s" : "") + " in scope",
      c.missionIds.length ? "Choose capabilities →" : "", function () { state.step = 3; redraw(); }));
    var all = document.getElementById("stAllM");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.missionIds = c.missionIds.length === pool.length ? [] : pool.map(function (m) { return m.id; });
      syncCaps(); redraw();
    };

    if (c.missionIds.length) {
      body.appendChild(hierarchy());
      body.appendChild(swimlane());
    }
  }
  function toggleMission(m) {
    var c = C(), i = c.missionIds.indexOf(m.id);
    if (i >= 0) c.missionIds.splice(i, 1); else c.missionIds.push(m.id);
    syncCaps();
  }

  /* Step 3 · Capability (L4) — reusable KPI instruments; multi-select, all default. */
  function stepCapability(body) {
    var c = C();
    var pool = window.PIQ.missionCapabilities();
    if (!pool.length) { state.step = 2; return redraw(); }
    body.appendChild(el("div", "st-q",
      "Which <b>capabilities</b> measure the missions?" +
      '<button class="linkbtn" id="stAllC">' + (c.capabilityIds.length === pool.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "A capability is a reusable KPI instrument — it is the measurement bridge that tells you whether a mission is on track. Each is powered by the patterns beneath it."));
    body.appendChild(pickGrid(pool, function (cp) {
      var on = c.capabilityIds.indexOf(cp.id) >= 0;
      return '<div class="pc-main"><div class="pc-t">' + esc(cp.name) + '</div>' +
        '<div class="pc-d">' + esc(cp.kpiName) + '</div></div>' +
        '<div class="pc-kpi"><span class="pck-v">' + esc(cp.current) + ' <i>→</i> <b>' + esc(cp.target) + '</b> ' + esc(cp.unit) + '</span></div>' +
        '<div class="pc-meta"><span class="pc-n">' + cp.patternCount + '</span> patterns</div>' +
        (on ? '<div class="pc-on">✓</div>' : '');
    }, function (cp) { toggleCapability(cp); redraw(); },
       function (cp) { return c.capabilityIds.indexOf(cp.id) >= 0; }));

    var np = window.PIQ.objectivePatternIds().length;
    body.appendChild(nextBar(c.capabilityIds.length + " capabilit" + (c.capabilityIds.length !== 1 ? "ies" : "y") + " · " + np + " pattern" + (np !== 1 ? "s" : ""),
      c.capabilityIds.length ? "Review patterns →" : "", function () { state.step = 4; redraw(); }));
    var all = document.getElementById("stAllC");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.capabilityIds = c.capabilityIds.length === pool.length ? [] : pool.map(function (cp) { return cp.id; });
      syncPatterns(); redraw();
    };
  }
  function toggleCapability(cp) {
    var c = C(), i = c.capabilityIds.indexOf(cp.id);
    if (i >= 0) c.capabilityIds.splice(i, 1); else c.capabilityIds.push(cp.id);
    syncPatterns();
  }

  /* Step 4 · Pattern (L5) — the behavioural units of variation handling.
     Two sub-tabs: the in-scope candidate patterns, and the embedded Pattern Studio
     (the full Library catalogue + the Mine workshop). */
  function stepPattern(body) {
    var c = C();
    var ids = window.PIQ.objectivePatternIds(); if (!ids.length) { state.step = 3; return redraw(); }
    var pats = ids.map(window.PIQ.pattern).filter(Boolean);
    var tab = state.patTab || "scope";

    var tabs = el("div", "st-subtabs",
      '<button class="st-subtab' + (tab === "scope" ? " on" : "") + '" data-pt="scope">' +
        'Candidate patterns <span class="st-subn">' + ids.length + '</span></button>' +
      '<button class="st-subtab' + (tab === "studio" ? " on" : "") + '" data-pt="studio">' +
        'Pattern Studio <small>Library &amp; Mine</small></button>');
    tabs.querySelectorAll(".st-subtab").forEach(function (b) {
      b.onclick = function () { state.patTab = b.dataset.pt; redraw(); };
    });
    body.appendChild(tabs);

    var advance = function () {
      body.appendChild(nextBar(c.patternIds.length + " pattern" + (c.patternIds.length !== 1 ? "s" : "") + " selected",
        c.patternIds.length ? "Compose action chains →" : "", function () { state.step = 5; redraw(); }));
    };

    if (tab === "studio") {
      body.appendChild(el("p", "st-hint",
        "The full Pattern Studio — browse the behavioural playbook or mine new patterns from client " +
        "documents. Accepted patterns join the library and appear as candidates whenever they serve your capabilities."));
      var host = el("div", "st-psembed");
      body.appendChild(host);
      var mod = window.PIQ.modules.patternstudio;
      if (mod && mod.render) mod.render(host);
      else host.innerHTML = '<p class="st-hint">Pattern Studio is unavailable.</p>';
      advance();
      return;
    }

    body.appendChild(el("div", "st-q",
      "Select the <b>patterns</b> to deploy" +
      '<button class="linkbtn" id="stAll">' + (c.patternIds.length === pats.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "Each pattern encodes the analyst's judgement: an action chain (straight-through) plus branching flows that handle the variations. " +
      "Tick the circle to add a pattern; click the card to open its detail and customise its action chain."));

    var grid = el("div", "patgrid");
    pats.forEach(function (p) {
      var sel = c.patternIds.indexOf(p.id) >= 0;
      var branches = (p.branchingDAG || []).length;
      var gates = (p.hitlGates || []).length;
      var happy = window.PIQ.happyDAG(p.id);
      var custom = window.PIQ.dagCustomised(p.id);
      var flow = happy.slice(0, 4).map(function (s) { return '<span class="mini-b">' + esc(window.PIQ.prettify(s)) + '</span>'; }).join('<i>→</i>');
      var card = el("div", "patcard" + (sel ? " sel" : ""),
        '<div class="pat-top"><span class="pat-prio" style="background:' + PRIO[p.priority] + '"></span>' +
        '<div class="pat-n">' + esc(p.name) + (p.sample ? ' <span class="statusbadge sample">sample</span>' : '') +
          (custom ? ' <span class="dagbadge">✎ chain edited</span>' : '') + '</div>' +
        '<button class="pat-check' + (sel ? " on" : "") + '" title="' + (sel ? "Remove from composition" : "Add to composition") + '">' + (sel ? "✓" : "+") + '</button></div>' +
        '<div class="pat-mm">“' + esc(trim(p.mentalModel, 150)) + '”</div>' +
        '<div class="pat-flow"><span class="flab">Action chain</span>' + (flow || '<span class="muted">no steps</span>') +
          (happy.length > 4 ? '<i>→</i><span class="mini-b more">+' + (happy.length - 4) + '</span>' : '') + '</div>' +
        '<div class="pat-foot"><span>' + branches + ' variation branches · ' +
          (gates ? '🔒 ' + gates + ' gate' + (gates > 1 ? "s" : "") : 'no gates') + '</span>' +
        '<span class="pat-cue">✎ details &amp; chain</span></div>');
      card.onclick = function () { openPatternDetail(p); };
      card.querySelector(".pat-check").onclick = function (e) {
        e.stopPropagation();
        var i = c.patternIds.indexOf(p.id);
        if (i >= 0) c.patternIds.splice(i, 1); else c.patternIds.push(p.id);
        c.blocks = {};   // selection changed → reconfigure
        redraw();
      };
      grid.appendChild(card);
    });
    body.appendChild(grid);
    body.appendChild(nextBar(c.patternIds.length + " pattern" + (c.patternIds.length !== 1 ? "s" : "") + " selected",
      c.patternIds.length ? "Compose action chains →" : "", function () { state.step = 5; redraw(); }));

    var all = document.getElementById("stAll");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.patternIds = c.patternIds.length === pats.length ? [] : pats.map(function (p) { return p.id; });
      c.blocks = {}; redraw();
    };
  }

  /* Step 5 · ActionChain (L6) — compose the action blocks of each selected pattern.
     The per-pattern reorder / enable-disable editor, promoted to a primary view. */
  function stepActionChain(body) {
    var c = C();
    if (!c.patternIds.length) { state.step = 4; return redraw(); }
    body.appendChild(el("div", "st-q", "Compose the <b>action chains</b>"));
    body.appendChild(el("p", "st-hint",
      "Each pattern's action chain is its straight-through spine — an ordered sequence of action blocks. " +
      "Reorder or disable blocks here; edits flow to Fitment, the Build engine and Runtime."));

    var wrap = el("div", "aclist");
    window.PIQ.selectedPatterns().forEach(function (p) { wrap.appendChild(chainCard(p)); });
    body.appendChild(wrap);

    body.appendChild(nextBar(c.patternIds.length + " action chain" + (c.patternIds.length !== 1 ? "s" : "") + " composed",
      "Configure action blocks →", function () { state.step = 6; redraw(); }));
  }

  // one editable action-chain card (used by the ActionChain step)
  function chainCard(p) {
    var card = el("div", "accard");
    renderChainCard(card, p);
    return card;
  }
  function renderChainCard(card, p) {
    var steps = window.PIQ.dagSteps(p.id);
    var onCount = steps.filter(function (s) { return s.on; }).length;
    var custom = window.PIQ.dagCustomised(p.id);
    var rows = steps.map(function (s, i) {
      var rm = s.added ? '<button class="dstep-rm" data-rm="' + i + '" title="Remove block">✕</button>' : '';
      var tag = s.added ? ' <span class="dstep-added">added</span>' : '';
      return '<div class="dstep' + (s.on ? "" : " off") + (s.added ? " added" : "") + '">' +
        '<div class="dstep-ord">' +
          '<button data-mv="-1" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + '>↑</button>' +
          '<button data-mv="1" data-i="' + i + '"' + (i === steps.length - 1 ? " disabled" : "") + '>↓</button></div>' +
        '<span class="dstep-n">' + (i + 1) + '</span>' +
        '<div class="dstep-k mono">' + esc(window.PIQ.prettify(s.k)) + tag + '</div>' +
        '<button class="dstep-tog' + (s.on ? " on" : "") + '" data-tog="' + i + '">' + (s.on ? "On" : "Off") + '</button>' + rm +
      '</div>';
    }).join("");
    var prev = window.PIQ.happyDAG(p.id).map(function (s) {
      return '<span class="mini-b">' + esc(window.PIQ.prettify(s)) + '</span>'; }).join('<i>→</i>')
      || '<span class="muted">no blocks enabled</span>';

    card.innerHTML =
      '<div class="accard-h"><span class="pat-prio" style="background:' + PRIO[p.priority] + '"></span>' +
        '<div class="accard-n">' + esc(p.name) + (p.sample ? ' <span class="statusbadge sample">sample</span>' : '') +
          (custom ? ' <span class="dagbadge">✎ edited</span>' : '') + '</div>' +
        (custom ? '<button class="linkbtn" data-reset="1">reset</button>' : '') +
        '<button class="linkbtn" data-detail="1">open detail</button></div>' +
      '<div class="dsteps">' + rows + '</div>' +
      '<div class="dprev"><span class="flab">Resulting sequence <b>' + onCount + '/' + steps.length + '</b></span>' + prev + '</div>';

    card.querySelectorAll("[data-mv]").forEach(function (b) {
      b.onclick = function () {
        var d = ensureDag(p.id), i = +b.dataset.i, j = i + (+b.dataset.mv);
        if (j < 0 || j >= d.steps.length) return;
        var tmp = d.steps[i]; d.steps[i] = d.steps[j]; d.steps[j] = tmp;
        afterDagEdit(); renderChainCard(card, p);
      };
    });
    card.querySelectorAll("[data-tog]").forEach(function (b) {
      b.onclick = function () {
        var d = ensureDag(p.id); d.steps[+b.dataset.tog].on = !d.steps[+b.dataset.tog].on;
        afterDagEdit(); renderChainCard(card, p);
      };
    });
    card.querySelectorAll("[data-rm]").forEach(function (b) {
      b.onclick = function () {
        var d = ensureDag(p.id); d.steps.splice(+b.dataset.rm, 1);
        afterDagEdit(); renderChainCard(card, p);
      };
    });
    var rst = card.querySelector("[data-reset]");
    if (rst) rst.onclick = function () { window.PIQ.resetDag(p.id); afterDagEdit(); renderChainCard(card, p); };
    var det = card.querySelector("[data-detail]");
    if (det) det.onclick = function () { openPatternDetail(p); };
  }

  /* ---- Process map: swimlanes by MISSION across the cognitive spine ----
     One lane per in-scope mission; columns are Sense → Diagnose → Decide → Act.
     The mission's persona is shown as the row label. */
  var SWL_PHASES = [
    { name: "Sense", sub: "observe" }, { name: "Diagnose", sub: "analyse" },
    { name: "Decide", sub: "route" }, { name: "Act", sub: "execute" }
  ];
  var SWL_COLORS = ["#8b5cf6", "#2563eb", "#059669", "#d97706", "#dc2626", "#0891b2", "#db2777"];

  function phaseOf(key) {
    var t = " " + key.toLowerCase() + " ";
    if (/read|pull|scan|monitor|track|fingerprint|ingest|watch|extract|checklist|cross_ref|parse|measure|_history/.test(t)) return 0;
    if (/classif|score|detect|diagnos|match|decompose|test|determin|identif|assess|compar|comput|reconcile|trace|estimat|verif|evaluat|check|isolat|project|analyz|split|quantif|aggregat|overlay|_variance|age_/.test(t)) return 1;
    if (/decide|route|propose|assign|tier|flag|prioriti|bundle|recommend|escalat/.test(t)) return 2;
    return 3;
  }

  // the pattern ids a single mission contributes (union across its capabilities)
  function missionPatternIds(m) {
    var out = [], seen = {};
    (m.capabilities || []).forEach(function (cp) {
      (cp.patternIds || []).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
    });
    return out;
  }

  function shortBlock(label) {
    var s = String(label).split("(")[0].trim();
    return s.length > 24 ? s.slice(0, 23) + "…" : s;
  }

  var SWL_CAP = 5;

  function swimlane() {
    var missions = window.PIQ.missions();
    var wrap = el("div", "swl-wrap");
    if (!missions.length) return wrap;
    var mode = state.swlMode || "happy";

    var head = el("div", "swl-head");
    head.appendChild(el("div", "st-subq",
      "Process map <small>swimlanes by mission · Sense → Diagnose → Decide → Act · presence across the flow</small>"));
    var toggle = el("div", "swl-toggle",
      '<button class="swl-mode' + (mode === "happy" ? " on" : "") + '" data-m="happy">Happy path</button>' +
      '<button class="swl-mode' + (mode === "all" ? " on" : "") + '" data-m="all">All actions</button>');
    toggle.querySelectorAll(".swl-mode").forEach(function (b) {
      b.onclick = function () { state.swlMode = b.dataset.m; redraw(); };
    });
    head.appendChild(toggle);
    wrap.appendChild(head);

    var grid = el("div", "swl");
    grid.appendChild(el("div", "swl-corner", "Mission / Persona"));
    SWL_PHASES.forEach(function (ph, idx) {
      grid.appendChild(el("div", "swl-phase p" + idx,
        '<span class="swl-pn">' + ph.name + '</span><span class="swl-ps">' + ph.sub + '</span>' +
        (idx < 3 ? '<i class="swl-arr">→</i>' : '')));
    });

    missions.forEach(function (m, ri) {
      var blocks = window.PIQ.collectBlocks(missionPatternIds(m));
      if (mode === "happy") blocks = blocks.filter(function (b) { return b.source === "happy"; });
      var buckets = [[], [], [], []], seen = {};
      blocks.forEach(function (b) {
        var ph = phaseOf(b.key), k = ph + "|" + b.label;
        if (seen[k]) return; seen[k] = 1;
        buckets[ph].push(b);
      });
      var present = buckets.filter(function (x) { return x.length; }).length;
      var rc = SWL_COLORS[ri % SWL_COLORS.length];

      var roleEl = el("div", "swl-role",
        '<span class="swl-dot" style="background:' + rc + '"></span>' +
        '<span class="swl-rt"><b>' + esc(m.name) + '</b>' +
        '<small>' + esc(m.persona) + ' · ' + present + ' of 4 stages</small></span>');
      roleEl.style.setProperty("--rc", rc);
      grid.appendChild(roleEl);

      buckets.forEach(function (cell, idx) {
        var cc = el("div", "swl-cell p" + idx + (cell.length ? "" : " empty"));
        cc.style.setProperty("--rc", rc);
        if (!cell.length) { cc.innerHTML = '<span class="swl-none">—</span>'; grid.appendChild(cc); return; }
        cell.forEach(function (b, bi) {
          var fit = window.PIQ.fitment(b);
          var chip = el("span", "swl-chip f-" + fit.mode + (bi >= SWL_CAP ? " swl-hide" : ""),
            esc(shortBlock(b.label)));
          chip.title = b.label + " — " + fit.tier + " · used by " + b.patterns.length +
            " pattern" + (b.patterns.length !== 1 ? "s" : "");
          cc.appendChild(chip);
        });
        if (cell.length > SWL_CAP) {
          var more = el("button", "swl-more", "+" + (cell.length - SWL_CAP) + " more");
          more.onclick = function () {
            cc.querySelectorAll(".swl-hide").forEach(function (x) { x.classList.remove("swl-hide"); });
            more.remove();
          };
          cc.appendChild(more);
        }
        grid.appendChild(cc);
      });
    });
    wrap.appendChild(grid);

    wrap.appendChild(el("div", "swl-legend",
      '<span class="swl-lg"><i class="lg-auto"></i>Straight-through</span>' +
      '<span class="swl-lg"><i class="lg-hitl"></i>Approval-gated</span>' +
      '<span class="swl-lgn">' +
      (mode === "happy" ? "Happy-path spine — the straight-through flow. Switch to All actions for exception handling."
                        : "All action blocks incl. variation handling. Hover a chip for detail.") +
      '</span>'));
    return wrap;
  }

  /* Unified-Hierarchy tree: Theme(L1) › Objective(L2) › Mission(L3) › Capability(L4) › Pattern(L5). */
  function hierarchy() {
    var t = theme();
    var wrap = el("div", "phier-wrap");
    if (!t) return wrap;
    wrap.appendChild(el("div", "st-subq", "Unified hierarchy <small>L1 → L5 · the composition in scope</small>"));
    var tree = el("div", "phier");
    tree.appendChild(node(1, t.name, themeIcon(t.icon)));
    var l2 = el("div", "ph-children");
    window.PIQ.objectives().forEach(function (o) {
      var ob = el("div", "ph-branch");
      ob.appendChild(node(2, o.name, null, o.kpi));
      var l3 = el("div", "ph-children");
      (o.missions || []).forEach(function (m) {
        if (C().missionIds.indexOf(m.id) < 0) return;
        var mb = el("div", "ph-branch");
        mb.appendChild(node(3, m.name, null, m.persona));
        var l4 = el("div", "ph-children");
        (m.capabilities || []).forEach(function (cp) {
          if (C().capabilityIds.length && C().capabilityIds.indexOf(cp.id) < 0) return;
          l4.appendChild(node(4, cp.name, null, cp.patternCount + " patterns"));
        });
        mb.appendChild(l4);
        l3.appendChild(mb);
      });
      ob.appendChild(l3);
      l2.appendChild(ob);
    });
    tree.appendChild(l2);
    wrap.appendChild(tree);
    return wrap;
  }

  function node(lvl, name, icon, sub) {
    return el("div", "ph-node l" + lvl,
      '<span class="ph-lvl">L' + lvl + '</span>' +
      (icon ? '<span class="ph-ico">' + icon + '</span>' : '') +
      '<span class="ph-nm">' + esc(name) + '</span>' +
      (sub ? '<small class="ph-sub">' + esc(sub) + '</small>' : ''));
  }

  /* ---- Pattern detail + action-chain editor (opened from a pattern card) ---- */
  function layer(n, title, desc, extra) {
    return '<div class="dlayer"><div class="lh"><span class="ln">' + n + '</span>' + title + '</div>' +
      '<div class="ld">' + desc + '</div>' + (extra || "") + '</div>';
  }
  function pdlgEsc(e) { if (e.key === "Escape") closePatternDetail(); }
  function closePatternDetail() {
    var b = document.querySelector(".pdlg-back");
    if (b) { b.remove(); document.removeEventListener("keydown", pdlgEsc); redraw(); }
  }
  function openPatternDetail(p) {
    closePatternDetail();
    var back = el("div", "pdlg-back");
    var dlg = el("div", "pdlg");
    back.appendChild(dlg);
    back.addEventListener("mousedown", function (e) { if (e.target === back) closePatternDetail(); });
    document.addEventListener("keydown", pdlgEsc);
    document.body.appendChild(back);
    renderPatternDetail(dlg, p);
  }
  function ensureDag(id) {
    var c = C(); if (!c.dag) c.dag = {};
    if (!c.dag[id]) c.dag[id] = { steps: window.PIQ.dagSteps(id).map(function (s) { return { k: s.k, on: s.on }; }) };
    return c.dag[id];
  }
  function afterDagEdit() { C().blocks = {}; if (window.PIQ.persistComposition) window.PIQ.persistComposition(); }

  function renderPatternDetail(dlg, p) {
    var c = C();
    var sel = c.patternIds.indexOf(p.id) >= 0;
    var custom = window.PIQ.dagCustomised(p.id);
    var steps = window.PIQ.dagSteps(p.id);
    var onCount = steps.filter(function (s) { return s.on; }).length;

    var rows = steps.map(function (s, i) {
      var tag = s.added ? ' <span class="dstep-added">added</span>' : '';
      var rm = s.added ? '<button class="dstep-rm" data-rm="' + i + '" title="Remove block">✕</button>' : '';
      return '<div class="dstep' + (s.on ? "" : " off") + (s.added ? " added" : "") + '">' +
        '<div class="dstep-ord">' +
          '<button data-mv="-1" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + '>↑</button>' +
          '<button data-mv="1" data-i="' + i + '"' + (i === steps.length - 1 ? " disabled" : "") + '>↓</button></div>' +
        '<span class="dstep-n">' + (i + 1) + '</span>' +
        '<div class="dstep-k mono">' + esc(window.PIQ.prettify(s.k)) + tag + '</div>' +
        '<button class="dstep-tog' + (s.on ? " on" : "") + '" data-tog="' + i + '">' + (s.on ? "On" : "Off") + '</button>' + rm +
      '</div>';
    }).join("");

    var prev = window.PIQ.happyDAG(p.id).map(function (s) {
      return '<span class="mini-b">' + esc(window.PIQ.prettify(s)) + '</span>'; }).join('<i>→</i>')
      || '<span class="muted">no steps enabled</span>';

    var branches = (p.branchingDAG || []).map(function (b) {
      var verbs = (b.actions || []).map(function (a) { return '<span class="verb">' + esc(a) + '</span>'; }).join("");
      var hitl = b.hitl ? '<div class="b-hitl">🔒 HITL: ' + esc(b.hitl) + '</div>' : "";
      return '<div class="branch t-' + b.tier + '"><div class="b-cond mono">' + esc(b.condition) + '</div>' +
        '<div class="b-acts">' + verbs + '</div>' + hitl + '</div>';
    }).join("");

    dlg.innerHTML =
      '<div class="pdlg-head"><div class="pnum lg" style="background:' + PRIO[p.priority] + '">' + p.id + '</div>' +
      '<div class="pdlg-ht"><h2>' + esc(p.name) + (p.sample ? ' <span class="statusbadge sample">sample</span>' : '') + '</h2>' +
      '<div class="pdlg-cat">' + esc(p.category) + '</div></div>' +
      '<span class="badge" style="background:' + PRIO[p.priority] + '">' + p.priority + '</span>' +
      '<span class="badge ghost mono">' + esc(p.layer3_feature) + '</span>' +
      '<button class="pdlg-x" id="pdlgClose" title="Close">✕</button></div>' +

      '<div class="pdlg-body">' +
      '<div class="mental">“' + esc(p.mentalModel) + '”<span class="who">— the analyst\'s mental model</span></div>' +
      '<div class="d-grid">' +
        layer("1", "Logical Mapping", esc(p.layer1_logicalMapping), "") +
        layer("2", "Event Series", esc(p.layer2_eventSeries), "") +
        layer("3", "AI Feature", '<b>' + esc(p.layer3_feature) + '</b> — pre-calculated trigger', "") +
      '</div>' +

      '<div class="dedit"><div class="dedit-h"><h4>Action Chain ' +
        '<span class="muted">reorder & enable/disable action blocks — flows to Fitment &amp; Runtime</span></h4>' +
        (custom ? '<button class="linkbtn" id="dagReset">reset to default</button>' : '') + '</div>' +
        '<div class="dsteps">' + rows + '</div>' +
        '<div class="dadd"><input id="dagAddInput" class="dadd-in" autocomplete="off" ' +
          'placeholder="+ Add an action block — search the repository or type your own…"/>' +
          '<div class="dadd-list" id="dagAddList"></div></div>' +
        '<div class="dprev"><span class="flab">Resulting sequence <b>' + onCount + '/' + steps.length + '</b></span>' + prev + '</div>' +
      '</div>' +

      '<div class="d-sec"><h4>Branching Flow <span class="muted">variation branches · action blocks · read-only</span></h4>' +
        '<div class="branches">' + (branches || '<span class="muted">none</span>') + '</div></div>' +
      (p.hitlGates && p.hitlGates.length ? '<div class="gatebar">🔒 HITL gates: ' + p.hitlGates.map(esc).join(" · ") + '</div>' : '') +
      '</div>' +

      '<div class="pdlg-foot"><span class="muted">' + (custom ? "✎ Action chain customised for this composition" : "Default action chain") + '</span>' +
        '<div class="pdlg-actions">' +
        '<button class="btn ' + (sel ? "ghost" : "go") + ' sm" id="pdlgSel">' + (sel ? "Remove from composition" : "Add to composition") + '</button>' +
        '<button class="btn ghost sm" id="pdlgDone">Done</button></div></div>';

    dlg.querySelector("#pdlgClose").onclick = closePatternDetail;
    dlg.querySelector("#pdlgDone").onclick = closePatternDetail;
    dlg.querySelector("#pdlgSel").onclick = function () {
      var i = c.patternIds.indexOf(p.id);
      if (i >= 0) c.patternIds.splice(i, 1); else c.patternIds.push(p.id);
      c.blocks = {};
      if (window.PIQ.persistComposition) window.PIQ.persistComposition();
      renderPatternDetail(dlg, p);
    };
    var rst = dlg.querySelector("#dagReset");
    if (rst) rst.onclick = function () { window.PIQ.resetDag(p.id); afterDagEdit(); renderPatternDetail(dlg, p); };
    dlg.querySelectorAll("[data-mv]").forEach(function (b) {
      b.onclick = function () {
        var d = ensureDag(p.id), i = +b.dataset.i, j = i + (+b.dataset.mv);
        if (j < 0 || j >= d.steps.length) return;
        var t = d.steps[i]; d.steps[i] = d.steps[j]; d.steps[j] = t;
        afterDagEdit(); renderPatternDetail(dlg, p);
      };
    });
    dlg.querySelectorAll("[data-tog]").forEach(function (b) {
      b.onclick = function () {
        var d = ensureDag(p.id); d.steps[+b.dataset.tog].on = !d.steps[+b.dataset.tog].on;
        afterDagEdit(); renderPatternDetail(dlg, p);
      };
    });
    dlg.querySelectorAll("[data-rm]").forEach(function (b) {
      b.onclick = function () {
        var d = ensureDag(p.id); d.steps.splice(+b.dataset.rm, 1);
        afterDagEdit(); renderPatternDetail(dlg, p);
      };
    });
    var addIn = dlg.querySelector("#dagAddInput");
    if (addIn) {
      addIn.oninput = function () { fillAddList(dlg, p); };
      addIn.onkeydown = function (e) {
        if (e.key === "Enter") {
          var v = addIn.value.trim();
          if (v) { addBlock(p.id, v.replace(/\s+/g, "_")); renderPatternDetail(dlg, p); focusAdd(dlg); }
        }
      };
    }
    fillAddList(dlg, p);
  }

  function focusAdd(dlg) { var i = dlg.querySelector("#dagAddInput"); if (i) i.focus(); }
  function addBlock(id, key) {
    key = (key || "").trim(); if (!key) return;
    ensureDag(id).steps.push({ k: key, on: true, added: true });
    afterDagEdit();
  }
  function fillAddList(dlg, p) {
    var inp = dlg.querySelector("#dagAddInput"), list = dlg.querySelector("#dagAddList");
    if (!inp || !list) return;
    var typed = inp.value.trim(), q = typed.toLowerCase();
    var have = {}; window.PIQ.dagSteps(p.id).forEach(function (s) { have[s.k] = 1; });
    var repo = window.PIQ.actionRepository().filter(function (k) {
      return !have[k] && (!q || k.toLowerCase().indexOf(q) >= 0);
    });
    var html = repo.slice(0, 8).map(function (k) {
      return '<button class="dadd-opt" data-add="' + esc(k) + '">' + esc(window.PIQ.prettify(k)) + '</button>';
    }).join("");
    if (typed && repo.indexOf(typed.replace(/\s+/g, "_")) < 0) {
      html += '<button class="dadd-opt custom" data-add="' + esc(typed.replace(/\s+/g, "_")) + '">+ Add custom “' + esc(typed) + '”</button>';
    }
    list.innerHTML = html || '<span class="dadd-none">No matching blocks — type a name to add your own.</span>';
    list.querySelectorAll("[data-add]").forEach(function (b) {
      b.onclick = function () { addBlock(p.id, b.dataset.add); renderPatternDetail(dlg, p); focusAdd(dlg); };
    });
  }

  /* ---- the configurator: the heart of the hand-off to Stage 2 ---- */
  var TECHS = ["LLM Agent", "Email / SMTP", "SAP BAPI/RFC", "Oracle REST", "RPA Bot", "Workflow / BPM", "Webhook / API", "Data Query"];
  function defaultTech(block) {
    var t = block.key.toLowerCase();
    if (/email|smtp|notify|alert|comms/.test(t)) return "Email / SMTP";
    if (/sap|bsid|update_sap|dunning|toggle/.test(t)) return "SAP BAPI/RFC";
    if (/oracle|fusion/.test(t)) return "Oracle REST";
    if (/generate|narrative|propose|classif|estimate|assess/.test(t)) return "LLM Agent";
    if (/escalate|route|approv|review|case/.test(t)) return "Workflow / BPM";
    if (/post|clear|match|reconcile|raise|schedule/.test(t)) return "RPA Bot";
    if (/pull|read|scan|compute|track|fingerprint/.test(t)) return "Data Query";
    return "LLM Agent";
  }

  function stepConfigure(body) {
    var c = C();
    if (!c.patternIds.length) { state.step = 5; return redraw(); }
    var blocks = window.PIQ.collectBlocks(c.patternIds);
    blocks.forEach(function (b) {
      if (!c.blocks[b.key]) {
        var fit = window.PIQ.fitment(b);
        c.blocks[b.key] = { mode: fit.mode, tech: defaultTech(b), configured: false };
      }
    });

    var happy = blocks.filter(function (b) { return b.source === "happy"; });
    var vary = blocks.filter(function (b) { return b.source !== "happy"; });
    body.appendChild(el("div", "st-q", "Configure the <b>action blocks</b>"));
    body.appendChild(el("p", "st-hint",
      "These are the atomic actions your action chains sequence. Happy-path blocks are straight-through candidates; " +
      "variation blocks fire only when a pattern's branch matches. Set the technology and execution mode for each."));

    body.appendChild(blockGroup("Action chain — straight-through spine", "happy", happy, c));
    body.appendChild(blockGroup("Variation handling — fires on pattern match", "vary", vary, c));

    var nConf = Object.keys(c.blocks).filter(function (k) { return c.blocks[k].configured; }).length;
    body.appendChild(nextBar(nConf + " / " + blocks.length + " blocks configured",
      "Send to Discover & Fit →", function () {
        blocks.forEach(function (b) { c.blocks[b.key].configured = true; });
        window.PIQ.go("fitment");
      }));
  }

  function blockGroup(title, kind, blocks, c) {
    var g = el("div", "blkgroup k-" + kind);
    if (!blocks.length) return g;
    g.appendChild(el("div", "blk-h", title + ' <span class="blk-c">' + blocks.length + '</span>'));
    var list = el("div", "blklist");
    blocks.forEach(function (b) {
      var cfg = c.blocks[b.key];
      var fit = window.PIQ.fitment(b);
      var row = el("div", "blk" + (cfg.configured ? " done" : ""));
      var techOpts = TECHS.map(function (t) { return '<option' + (t === cfg.tech ? " selected" : "") + '>' + t + '</option>'; }).join("");
      row.innerHTML =
        '<div class="blk-tag k-' + kind + '"></div>' +
        '<div class="blk-main"><div class="blk-name">' + esc(b.label) + '</div>' +
        '<div class="blk-key mono">' + esc(b.key) + '</div>' +
        '<div class="blk-sub">used by ' + b.patterns.length + ' pattern' + (b.patterns.length > 1 ? "s" : "") + (b.hitl ? ' · <span class="blk-hitl">needs approval</span>' : '') + '</div></div>' +
        '<div class="blk-fit"><span class="fitchip f-' + fit.mode + '">' + fit.tier + '</span></div>' +
        '<select class="blk-tech" data-k="' + esc(b.key) + '">' + techOpts + '</select>' +
        '<div class="blk-mode" data-k="' + esc(b.key) + '">' +
          '<button class="mode' + (cfg.mode === "auto" ? " on" : "") + '" data-m="auto">Auto</button>' +
          '<button class="mode' + (cfg.mode === "hitl" ? " on" : "") + '" data-m="hitl">Approval</button></div>';
      list.appendChild(row);
    });
    g.appendChild(list);
    g.querySelectorAll(".blk-tech").forEach(function (s) {
      s.onchange = function () { c.blocks[s.dataset.k].tech = s.value; c.blocks[s.dataset.k].configured = true; markDone(s); };
    });
    g.querySelectorAll(".blk-mode").forEach(function (m) {
      m.onclick = function (e) {
        var b = e.target.closest("[data-m]"); if (!b) return;
        c.blocks[m.dataset.k].mode = b.dataset.m; c.blocks[m.dataset.k].configured = true;
        m.querySelectorAll(".mode").forEach(function (x) { x.classList.toggle("on", x === b); });
        markDone(m);
      };
    });
    return g;
  }
  function markDone(node) { var row = node.closest(".blk"); if (row) row.classList.add("done"); }

  function nextBar(label, cta, onNext) {
    var bar = el("div", "st-next");
    bar.innerHTML = '<span class="nx-label">' + esc(label) + '</span>' +
      (cta ? '<button class="btn go" id="stNext">' + esc(cta) + '</button>' : '');
    var b = bar.querySelector("#stNext"); if (b) b.onclick = onNext;
    return bar;
  }

  function trim(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  window.PIQ.modules.studio = { render: render };
})();
