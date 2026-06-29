/* Stage 1 · Design — Studio
 * The SME's guided front door: Function → Process → Role → Objective → Patterns →
 * Action Blocks. Picking an objective surfaces the matching patterns (with their
 * DAGs); selecting patterns assembles the union of action blocks; configuring those
 * blocks (technology + auto/HITL mode) hands off to Stage 2 (Discover & Fit).
 *
 * Patterns are the unit of variation handling and dynamic action-block sequencing;
 * the happy path (originalDAG) is the straight-through spine recorded for agentivisation.
 */
(function () {
  "use strict";
  var PRIO = window.PIQ.meta.priorityLegend;

  // step machine
  var STEPS = ["Function", "Process", "Role", "Objective", "Patterns", "Configure"];
  var state = { step: 0 };

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function C() { return window.PIQ.composition; }

  /* resume at the furthest resolved step when re-entering the Studio */
  function resumeStep() {
    var c = C();
    if (c.patternIds.length) return 5;
    if (c.objId) return 4;
    if (c.roleId) return 3;
    if (c.procId) return 2;
    if (c.fnId) return 1;
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
    var body = el("div", "st-body");
    root.appendChild(body);
    drawStep(body);
  }

  function intro() {
    return el("div", "st-intro",
      '<div><div class="kv">Stage 1 · Design — Missions → Actions</div>' +
      '<h2>Compose a process to transform</h2>' +
      '<p class="st-lede">Pick the mission top-down, choose the behavioural patterns that handle its variations, ' +
      'and configure the action blocks. The accelerator is function-agnostic — start anywhere.</p></div>' +
      '<button class="btn ghost sm" id="stReset">Start over</button>');
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
    return [!!c.fnId, !!c.procId, !!c.roleId, !!c.objId, c.patternIds.length > 0,
            Object.keys(c.blocks).length > 0][i];
  }
  function chosen(i) {
    var c = C(), f = window.PIQ.fn();
    var label = "";
    if (i === 0 && f) label = f.name;
    else if (i === 1 && f && c.procId) label = (proc() || {}).name;
    else if (i === 2 && c.roleId) label = (role() || {}).name;
    else if (i === 3 && c.objId) label = (window.PIQ.objective() || {}).name;
    else if (i === 4 && c.patternIds.length) label = c.patternIds.length + " selected";
    else if (i === 5 && Object.keys(c.blocks).length) label = Object.keys(c.blocks).length + " configured";
    return label ? '<small class="st-chose">' + esc(label) + '</small>' : "";
  }

  function proc() { var f = window.PIQ.fn(); return f && f.processes.filter(function (p) { return p.id === C().procId; })[0]; }
  function role() { var p = proc(); return p && p.roles.filter(function (r) { return r.id === C().roleId; })[0]; }

  function redraw() { draw(document.querySelector(".studio")); }

  /* ---------------- steps ---------------- */
  function drawStep(body) {
    [stepFunction, stepProcess, stepRole, stepObjective, stepPatterns, stepConfigure][state.step](body);
    var rb = document.getElementById("stReset");
    if (rb) rb.onclick = function () { window.PIQ.resetComposition(); state.step = 0; redraw(); };
  }

  function pickGrid(items, build, onPick) {
    var g = el("div", "pickgrid");
    items.forEach(function (it) {
      var card = el("div", "pickcard", build(it));
      card.onclick = function () { onPick(it); };
      g.appendChild(card);
    });
    return g;
  }

  function stepFunction(body) {
    body.appendChild(el("div", "st-q", "Which <b>function</b> are you transforming?"));
    var grid = pickGrid(window.PIQ.tax.functions, function (f) {
      var on = C().fnId === f.id;
      return '<div class="pc-ico" style="--ac:' + f.accent + '">' + f.icon + '</div>' +
        '<div class="pc-main"><div class="pc-t">' + esc(f.name) +
        ' <span class="pc-tag">' + esc(f.short) + '</span></div>' +
        '<div class="pc-d">' + esc(f.tagline) + '</div></div>' +
        '<div class="pc-meta"><span class="pc-n">' + f.patternCount + '</span> patterns ' +
        '<span class="statusbadge ' + f.status + '">' + (f.status === "live" ? "Fully built" : "Sample") + '</span></div>' +
        (on ? '<div class="pc-on">✓</div>' : '');
    }, function (f) {
      var c = C();
      if (c.fnId !== f.id) { c.fnId = f.id; c.procId = c.roleId = c.objId = null; c.patternIds = []; c.blocks = {}; }
      // auto-advance; if function has a single process, pre-select it
      if (f.processes.length === 1) c.procId = f.processes[0].id;
      state.step = f.processes.length === 1 ? 2 : 1;
      redraw();
    });
    body.appendChild(grid);
  }

  function stepProcess(body) {
    var f = window.PIQ.fn(); if (!f) { state.step = 0; return redraw(); }
    body.appendChild(el("div", "st-q", "Which <b>process</b> inside " + esc(f.name) + "?"));
    body.appendChild(pickGrid(f.processes, function (p) {
      var on = C().procId === p.id;
      return '<div class="pc-main"><div class="pc-t">' + esc(p.name) + '</div>' +
        '<div class="pc-d">' + esc(p.desc) + '</div></div>' +
        '<div class="pc-meta">' + p.roles.length + ' roles</div>' + (on ? '<div class="pc-on">✓</div>' : '');
    }, function (p) {
      var c = C(); if (c.procId !== p.id) { c.procId = p.id; c.roleId = c.objId = null; c.patternIds = []; c.blocks = {}; }
      state.step = 2; redraw();
    }));
  }

  function stepRole(body) {
    var p = proc(); if (!p) { state.step = 1; return redraw(); }
    body.appendChild(el("div", "st-q", "Whose <b>role</b> are we augmenting?"));
    body.appendChild(pickGrid(p.roles, function (r) {
      var on = C().roleId === r.id;
      var objs = r.objectives.map(function (o) { return o.name; }).join(" · ");
      return '<div class="pc-main"><div class="pc-t">' + esc(r.name) + '</div>' +
        '<div class="pc-d">' + esc(objs) + '</div></div>' +
        '<div class="pc-meta">' + r.objectives.length + ' objectives</div>' + (on ? '<div class="pc-on">✓</div>' : '');
    }, function (r) {
      var c = C(); if (c.roleId !== r.id) { c.roleId = r.id; c.objId = null; c.patternIds = []; c.blocks = {}; }
      state.step = 3; redraw();
    }));
  }

  function stepObjective(body) {
    var r = role(); if (!r) { state.step = 2; return redraw(); }
    body.appendChild(el("div", "st-q", "What <b>objective</b> should the agents pursue?"));
    body.appendChild(pickGrid(r.objectives, function (o) {
      var on = C().objId === o.id;
      return '<div class="pc-main"><div class="pc-t">' + esc(o.name) + '</div>' +
        '<div class="pc-d">Measured by <b>' + esc(o.kpi) + '</b></div></div>' +
        '<div class="pc-meta"><span class="pc-n">' + o.patternCount + '</span> patterns</div>' +
        (on ? '<div class="pc-on">✓</div>' : '');
    }, function (o) {
      var c = C();
      if (c.objId !== o.id) { c.objId = o.id; c.patternIds = o.patternIds.slice(); c.blocks = {}; }  // pre-select all
      state.step = 4; redraw();
    }));
  }

  function stepPatterns(body) {
    var o = window.PIQ.objective(); if (!o) { state.step = 3; return redraw(); }
    var c = C();
    var pats = o.patternIds.map(window.PIQ.pattern).filter(Boolean);
    body.appendChild(el("div", "st-q",
      "Select the <b>patterns</b> to deploy for “" + esc(o.name) + "”" +
      '<button class="linkbtn" id="stAll">' + (c.patternIds.length === pats.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "Each pattern encodes the analyst's judgement: a happy path (straight-through) plus a branching DAG that handles the variations. Pick the ones that match how your experts actually work."));

    var grid = el("div", "patgrid");
    pats.forEach(function (p) {
      var sel = c.patternIds.indexOf(p.id) >= 0;
      var branches = (p.branchingDAG || []).length;
      var gates = (p.hitlGates || []).length;
      var flow = (p.originalDAG || []).slice(0, 4).map(function (s) { return '<span class="mini-b">' + esc(window.PIQ.prettify(s)) + '</span>'; }).join('<i>→</i>');
      var card = el("div", "patcard" + (sel ? " sel" : ""),
        '<div class="pat-top"><span class="pat-prio" style="background:' + PRIO[p.priority] + '"></span>' +
        '<div class="pat-n">' + esc(p.name) + (p.sample ? ' <span class="statusbadge sample">sample</span>' : '') + '</div>' +
        '<div class="pat-check">' + (sel ? "✓" : "") + '</div></div>' +
        '<div class="pat-mm">“' + esc(trim(p.mentalModel, 150)) + '”</div>' +
        '<div class="pat-flow"><span class="flab">Happy path</span>' + flow + (p.originalDAG.length > 4 ? '<i>→</i><span class="mini-b more">+' + (p.originalDAG.length - 4) + '</span>' : '') + '</div>' +
        '<div class="pat-foot"><span>' + branches + ' variation branches</span>' +
        '<span>' + (gates ? '🔒 ' + gates + ' HITL gate' + (gates > 1 ? "s" : "") : 'no gates') + '</span></div>');
      card.onclick = function () {
        var i = c.patternIds.indexOf(p.id);
        if (i >= 0) c.patternIds.splice(i, 1); else c.patternIds.push(p.id);
        c.blocks = {};   // selection changed → reconfigure
        redraw();
      };
      grid.appendChild(card);
    });
    body.appendChild(grid);
    body.appendChild(nextBar(c.patternIds.length + " pattern" + (c.patternIds.length !== 1 ? "s" : "") + " selected",
      c.patternIds.length ? "Configure action blocks →" : "", function () { state.step = 5; redraw(); }));

    var all = document.getElementById("stAll");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.patternIds = c.patternIds.length === pats.length ? [] : pats.map(function (p) { return p.id; });
      c.blocks = {}; redraw();
    };
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
    if (!c.patternIds.length) { state.step = 4; return redraw(); }
    var blocks = window.PIQ.collectBlocks(c.patternIds);
    // seed config for any unconfigured block
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
      "These are the atomic actions your selected patterns sequence. Happy-path blocks are straight-through candidates; " +
      "variation blocks fire only when a pattern's branch matches. Set the technology and execution mode for each."));

    body.appendChild(blockGroup("Happy path — straight-through spine", "happy", happy, c));
    body.appendChild(blockGroup("Variation handling — fires on pattern match", "vary", vary, c));

    var nConf = Object.keys(c.blocks).filter(function (k) { return c.blocks[k].configured; }).length;
    body.appendChild(nextBar(nConf + " / " + blocks.length + " blocks configured",
      "Send to Discover & Fit →", function () {
        // mark all touched; commit and advance stage
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
    // wiring
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
