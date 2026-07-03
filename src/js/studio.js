/* Stage 1 · Design — Studio
 * The SME's guided front door: Function → Process → Personas → Objectives → Patterns →
 * Action Blocks. Choosing a process pulls in ALL its participating personas (and their
 * objectives) by default — the SME can then narrow scope. The in-scope objectives
 * surface the union of matching patterns; selecting patterns assembles the union of
 * action blocks; configuring those blocks hands off to Stage 2 (Discover & Fit).
 *
 * Patterns are the unit of variation handling and dynamic action-block sequencing;
 * the happy path (originalDAG) is the straight-through spine recorded for agentivisation.
 */
(function () {
  "use strict";
  var PRIO = window.PIQ.meta.priorityLegend;

  // step machine — Theme is an optional top-level lens above Function
  var STEPS = ["Theme", "Function", "Process", "Personas", "Objectives", "Patterns", "Configure"];
  var state = { step: 0 };

  // lucide-style theme icon names → emoji (no icon library is inlined)
  var THEME_ICONS = { "trending-up": "📈", "shield-alert": "🚨", "clock": "⏱️",
    "shield-check": "🛡️", "eye": "👁️" };
  function themeIcon(name) { return THEME_ICONS[name] || "◆"; }

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function C() { return window.PIQ.composition; }
  function theme() { return window.PIQ.theme(); }
  function fnById(id) { return (window.PIQ.tax.functions || []).filter(function (f) { return f.id === id; })[0]; }

  /* resume at the furthest resolved step when re-entering the Studio */
  function resumeStep() {
    var c = C();
    if (c.patternIds.length) return 6;
    if (c.objIds.length) return 5;
    if (c.roleIds.length) return 4;
    if (c.procId) return 3;
    if (c.fnId) return 2;
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

  /* Composition workspace — the always-on recap of every selection so far.
     Answers "what have I picked?" without leaving the current step. */
  function summaryCard() {
    var c = C(), f = window.PIQ.fn();
    if (!f && !theme()) return null;
    var p = proc();
    var roles = window.PIQ.roles();
    var objs = window.PIQ.objectives();
    var pats = window.PIQ.selectedPatterns();
    var t = theme();

    var rows = [
      ["Theme", t && t.name],
      ["Function", f && f.name],
      ["Process", p && p.name]
    ].filter(function (x) { return x[1]; }).map(function (x) {
      return '<div class="sum-row"><span class="sum-k">' + x[0] + '</span>' +
        '<span class="sum-v">' + esc(x[1]) + '</span></div>';
    }).join("");

    rows += chipRow("Personas", roles.map(function (r) { return r.name; }));
    rows += chipRow("Objectives", objs.map(function (o) { return o.name; }));

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

    var card = el("div", "st-summary",
      '<div class="sum-h"><span>Composition workspace</span>' +
      (c.live ? '<span class="cr-live">● LIVE</span>' : '') + '</div>' +
      rows + patBlock + blockRow);
    return card;
  }

  function chipRow(label, names) {
    if (!names.length) return "";
    var chips = names.map(function (n) { return '<span class="sum-chip">' + esc(n) + '</span>'; }).join("");
    return '<div class="sum-row col"><span class="sum-k">' + label + ' <b>' + names.length + '</b></span>' +
      '<div class="sum-chips">' + chips + '</div></div>';
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
    return [!!c.themeId, !!c.fnId, !!c.procId, c.roleIds.length > 0, c.objIds.length > 0, c.patternIds.length > 0,
            Object.keys(c.blocks).length > 0][i];
  }
  function chosen(i) {
    var c = C(), f = window.PIQ.fn(), t = theme();
    var label = "";
    if (i === 0 && t) label = t.name;
    else if (i === 1 && f) label = f.name;
    else if (i === 2 && f && c.procId) label = (proc() || {}).name;
    else if (i === 3 && c.roleIds.length) label = c.roleIds.length + " persona" + (c.roleIds.length > 1 ? "s" : "");
    else if (i === 4 && c.objIds.length) label = c.objIds.length + " objective" + (c.objIds.length > 1 ? "s" : "");
    else if (i === 5 && c.patternIds.length) label = c.patternIds.length + " selected";
    else if (i === 6 && Object.keys(c.blocks).length) label = Object.keys(c.blocks).length + " configured";
    return label ? '<small class="st-chose">' + esc(label) + '</small>' : "";
  }

  function proc() { var f = window.PIQ.fn(); return f && f.processes.filter(function (p) { return p.id === C().procId; })[0]; }

  /* re-derive scope when the persona / objective set changes.
     Objectives default to every objective of the in-scope personas; patterns
     default to the union across those objectives. Structural changes reset blocks. */
  function syncObjectives(keepObjSelection) {
    var c = C(), p = proc(); if (!p) return;
    var valid = [];
    p.roles.forEach(function (r) {
      if (c.roleIds.indexOf(r.id) < 0) return;
      (r.objectives || []).forEach(function (o) { valid.push(o.id); });
    });
    if (keepObjSelection) {
      // drop objectives whose persona was removed
      c.objIds = c.objIds.filter(function (id) { return valid.indexOf(id) >= 0; });
    } else {
      c.objIds = valid.slice();
    }
    syncPatterns();
  }
  function syncPatterns() {
    var c = C();
    c.patternIds = window.PIQ.objectivePatternIds();
    c.blocks = {};
  }

  function redraw() { draw(document.querySelector(".studio")); }

  /* ---------------- steps ---------------- */
  function drawStep(body) {
    if (state.step > 0) body.appendChild(backBtn());
    [stepTheme, stepFunction, stepProcess, stepPersonas, stepObjectives, stepPatterns, stepConfigure][state.step](body);
    var rb = document.getElementById("stReset");
    if (rb) rb.onclick = function () { window.PIQ.resetComposition(); state.step = 0; redraw(); };
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

  /* Step 0 · Theme — the CFO-level outcome. Optional: spans functions, carries a
     compound KPI, and (when chosen) filters the function list to what it touches. */
  function stepTheme(body) {
    var c = C();
    var themes = window.PIQ.tax.themes || [];
    body.appendChild(el("div", "st-q", "Which <b>business theme</b> are you driving?"));
    body.appendChild(el("p", "st-hint",
      "Themes are the outcomes a CFO steers by — they span multiple functions and roll up to a compound KPI. " +
      "Pick one to focus the journey on the functions that move it, or skip straight to a function for a bottoms-up build."));
    var grid = pickGrid(themes, function (t) {
      var on = c.themeId === t.id;
      var k = t.compoundKPI || {};
      var fns = (t.functionIds || []).map(function (id) { var f = fnById(id); return f ? f.short : id; }).join(" · ");
      return '<div class="pc-ico" style="--ac:' + t.accent + '">' + themeIcon(t.icon) + '</div>' +
        '<div class="pc-main"><div class="pc-t">' + esc(t.name) + '</div>' +
        '<div class="pc-d">' + esc(t.tagline) + '</div></div>' +
        '<div class="pc-kpi"><span class="pck-n">' + esc(k.name) + '</span>' +
          '<span class="pck-v">' + esc(k.current) + ' <i>→</i> <b>' + esc(k.target) + '</b> ' + esc(k.unit) + '</span></div>' +
        '<div class="pc-meta">Spans <b>' + esc(fns) + '</b></div>' +
        (on ? '<div class="pc-on">✓</div>' : '');
    }, function (t) {
      if (c.themeId !== t.id) {
        c.themeId = t.id;
        // if the current function isn't in the theme, clear the downstream selection
        if (c.fnId && (t.functionIds || []).indexOf(c.fnId) < 0) {
          c.fnId = null; c.procId = null; c.roleIds = []; c.objIds = []; c.patternIds = []; c.blocks = {};
        }
      }
      state.step = 1;
      redraw();
    }, function (t) { return c.themeId === t.id; });
    body.appendChild(grid);
    body.appendChild(nextBar("Themes are optional — a lens, not a gate",
      "Skip — go direct to function →", function () { c.themeId = null; state.step = 1; redraw(); }));
  }

  function stepFunction(body) {
    var c = C(), t = theme();
    if (t) {
      var k = t.compoundKPI || {};
      var banner = el("div", "st-themebar",
        '<div class="stt-ic" style="--ac:' + t.accent + '">' + themeIcon(t.icon) + '</div>' +
        '<div class="stt-main"><div class="stt-n">' + esc(t.name) + '</div>' +
        '<div class="stt-k">' + esc(k.name) + ' <b>' + esc(k.current) + ' → ' + esc(k.target) + ' ' + esc(k.unit) + '</b></div></div>' +
        '<button class="linkbtn" id="stChTheme">change theme</button>');
      body.appendChild(banner);
      banner.querySelector("#stChTheme").onclick = function () { state.step = 0; redraw(); };
    }
    body.appendChild(el("div", "st-q", t
      ? "Which <b>function</b> inside “" + esc(t.name) + "” are you transforming?"
      : "Which <b>function</b> are you transforming?"));
    var funcs = window.PIQ.themeFunctions();
    var grid = pickGrid(funcs, function (f) {
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
      if (c.fnId !== f.id) { c.fnId = f.id; c.procId = null; c.roleIds = []; c.objIds = []; c.patternIds = []; c.blocks = {}; }
      // auto-advance; a single-process function pre-selects it — UNLESS it carries a
      // value-chain map, where the SME must pick a built area from the taxonomy matrix.
      var single = f.processes.length === 1 && !f.valueChain;
      if (single) { c.procId = f.processes[0].id; selectAllPersonas(); }
      state.step = single ? 3 : 2;
      redraw();
    });
    body.appendChild(grid);
  }

  // a process participates through its full set of personas — select them all
  function selectAllPersonas() {
    var c = C(), p = proc(); if (!p) return;
    c.roleIds = p.roles.map(function (r) { return r.id; });
    syncObjectives(false);
  }

  function stepProcess(body) {
    var f = window.PIQ.fn(); if (!f) { state.step = 1; return redraw(); }
    var c = C();
    // Functions that carry a value-chain map (O2C) present the full process
    // taxonomy; only the built areas are navigable. Others use the card list.
    if (f.valueChain) return stepProcessMatrix(body, f, c);

    body.appendChild(el("div", "st-q", "Which <b>process</b> inside " + esc(f.name) + "?"));
    body.appendChild(pickGrid(f.processes, function (p) {
      var on = c.procId === p.id;
      return '<div class="pc-main"><div class="pc-t">' + esc(p.name) + '</div>' +
        '<div class="pc-d">' + esc(p.desc) + '</div></div>' +
        '<div class="pc-meta">' + p.roles.length + ' personas</div>' + (on ? '<div class="pc-on">✓</div>' : '');
    }, function (p) {
      if (c.procId !== p.id) { c.procId = p.id; selectAllPersonas(); }  // all personas participate by default
      redraw();   // stay on the Process tab and reveal its hierarchy
    }, function (p) { return c.procId === p.id; }));

    var p = proc();
    if (p) {
      body.appendChild(hierarchy(f, p));
      body.appendChild(swimlane(f, p));
      body.appendChild(nextBar(p.roles.length + " persona" + (p.roles.length !== 1 ? "s" : "") + " mapped",
        "Continue → Personas", function () { state.step = 3; redraw(); }));
    }
  }

  /* Process taxonomy matrix — L1 value chain › L2 groups › L3 process areas ›
     L4 sub-processes. Built areas (backed by a real pattern library) are clickable
     and select their process; every other area is landscape context. */
  function stepProcessMatrix(body, f, c) {
    var vc = f.valueChain;
    var live = f.status === "live";
    body.appendChild(el("div", "st-q", "The <b>" + esc(f.name) + "</b> process taxonomy"));
    body.appendChild(el("p", "st-hint",
      "Your end-to-end value chain, L1 → L4. Highlighted areas are backed by " +
      (live ? "the fully-built accelerator" : "a working sample library") +
      " — pick one to compose it. The rest map the surrounding landscape."));

    var chain = el("div", "vc");
    chain.appendChild(el("div", "vc-l1", '<span class="vc-arrow">↔</span>' + esc(vc.name)));

    var groups = el("div", "vc-groups");
    vc.groups.forEach(function (g) {
      var gEl = el("div", "vc-group tone-" + g.tone);
      gEl.style.flex = g.areas.length;   // group header spans its process areas
      gEl.appendChild(el("div", "vc-ghead",
        esc(g.name) + (g.note ? ' <small>' + esc(g.note) + '</small>' : '')));
      var areas = el("div", "vc-areas");
      g.areas.forEach(function (a) {
        var built = !!a.built;
        var col = el("div", "vc-col" + (built ? " built" : "") +
          (built && c.procId === a.procId ? " sel" : ""));
        col.appendChild(el("div", "vc-area",
          '<span class="vc-lvl">L3</span>' + esc(a.name) +
          (built ? '<span class="vc-badge">' + (live ? "Built ✓" : "Sample ✓") + '</span>'
                 : '<span class="vc-badge ctx">Roadmap</span>')));
        var subs = el("div", "vc-subs");
        (a.sub || []).forEach(function (s) {
          subs.appendChild(el("div", "vc-sub", '<span class="vc-lvl">L4</span>' + esc(s)));
        });
        col.appendChild(subs);
        if (built) col.onclick = function () { pickBuiltArea(a); };
        areas.appendChild(col);
      });
      gEl.appendChild(areas);
      groups.appendChild(gEl);
    });
    chain.appendChild(groups);
    body.appendChild(chain);

    var p = proc();
    if (p) {
      body.appendChild(hierarchy(f, p));
      body.appendChild(swimlane(f, p));
      body.appendChild(nextBar('Selected: ' + p.name + ' · ' + p.roles.length +
        " persona" + (p.roles.length !== 1 ? "s" : "") + " mapped",
        "Continue → Personas", function () { state.step = 3; redraw(); }));
    } else {
      body.appendChild(nextBar("Pick a built area to compose it", "", null));
    }
  }

  function pickBuiltArea(a) {
    var c = C();
    if (c.procId !== a.procId) { c.procId = a.procId; selectAllPersonas(); }
    redraw();   // reveal the selected process's L1–L4 tree + Continue bar
  }

  /* ---- Process map: swimlanes by role across the cognitive spine ----
     One lane per in-scope persona; columns are the Sense → Diagnose → Decide → Act
     stages the accelerator runs. Each cell holds the action blocks that role's
     patterns contribute in that stage, so the SME sees role presence across the
     process (and where each role's work is straight-through vs approval-gated). */
  var SWL_PHASES = [
    { name: "Sense", sub: "observe" }, { name: "Diagnose", sub: "analyse" },
    { name: "Decide", sub: "route" }, { name: "Act", sub: "execute" }
  ];
  var SWL_COLORS = ["#8e44ad", "#2980b9", "#16a085", "#d68910", "#c0392b", "#7c4dff", "#e0529c"];

  // classify an action-block key into a cognitive stage (0..3), first match wins
  function phaseOf(key) {
    var t = " " + key.toLowerCase() + " ";
    if (/read|pull|scan|monitor|track|fingerprint|ingest|watch|extract|checklist|cross_ref|parse|measure|_history/.test(t)) return 0;
    if (/classif|score|detect|diagnos|match|decompose|test|determin|identif|assess|compar|comput|reconcile|trace|estimat|verif|evaluat|check|isolat|project|analyz|split|quantif|aggregat|overlay|_variance|age_/.test(t)) return 1;
    if (/decide|route|propose|assign|tier|flag|prioriti|bundle|recommend|escalat/.test(t)) return 2;
    return 3; // Act — post/clear/update/hold/notify/send/apply/… and anything else
  }

  // the in-scope pattern ids a single persona contributes
  function rolePatternIds(r) {
    var c = C(), out = [], seen = {};
    (r.objectives || []).forEach(function (o) {
      if (c.objIds.indexOf(o.id) < 0) return;
      (o.patternIds || []).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
    });
    return out;
  }

  function shortBlock(label) {
    var s = String(label).split("(")[0].trim();
    return s.length > 24 ? s.slice(0, 23) + "…" : s;
  }

  var SWL_CAP = 5;   // chips shown per cell before "+N more"

  function swimlane(f, p) {
    var roles = window.PIQ.roles();
    var wrap = el("div", "swl-wrap");
    if (!roles.length) return wrap;
    var mode = state.swlMode || "happy";   // "happy" = straight-through spine, "all" = + variations

    var head = el("div", "swl-head");
    head.appendChild(el("div", "st-subq",
      "Process map <small>swimlanes by role · Sense → Diagnose → Decide → Act · presence across the flow</small>"));
    var toggle = el("div", "swl-toggle",
      '<button class="swl-mode' + (mode === "happy" ? " on" : "") + '" data-m="happy">Happy path</button>' +
      '<button class="swl-mode' + (mode === "all" ? " on" : "") + '" data-m="all">All actions</button>');
    toggle.querySelectorAll(".swl-mode").forEach(function (b) {
      b.onclick = function () { state.swlMode = b.dataset.m; redraw(); };
    });
    head.appendChild(toggle);
    wrap.appendChild(head);

    var grid = el("div", "swl");
    grid.appendChild(el("div", "swl-corner", "Role / Persona"));
    SWL_PHASES.forEach(function (ph, idx) {
      grid.appendChild(el("div", "swl-phase p" + idx,
        '<span class="swl-pn">' + ph.name + '</span><span class="swl-ps">' + ph.sub + '</span>' +
        (idx < 3 ? '<i class="swl-arr">→</i>' : '')));
    });

    roles.forEach(function (r, ri) {
      var blocks = window.PIQ.collectBlocks(rolePatternIds(r));
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
        '<span class="swl-rt"><b>' + esc(r.name) + '</b>' +
        '<small>' + present + ' of 4 stages</small></span>');
      roleEl.style.setProperty("--rc", rc);
      grid.appendChild(roleEl);

      buckets.forEach(function (cell, idx) {
        var c = el("div", "swl-cell p" + idx + (cell.length ? "" : " empty"));
        c.style.setProperty("--rc", rc);
        if (!cell.length) { c.innerHTML = '<span class="swl-none">—</span>'; grid.appendChild(c); return; }
        cell.forEach(function (b, bi) {
          var fit = window.PIQ.fitment(b);
          var chip = el("span", "swl-chip f-" + fit.mode + (bi >= SWL_CAP ? " swl-hide" : ""),
            esc(shortBlock(b.label)));
          chip.title = b.label + " — " + fit.tier + " · used by " + b.patterns.length +
            " pattern" + (b.patterns.length !== 1 ? "s" : "");
          c.appendChild(chip);
        });
        if (cell.length > SWL_CAP) {
          var more = el("button", "swl-more", "+" + (cell.length - SWL_CAP) + " more");
          more.onclick = function () {
            c.querySelectorAll(".swl-hide").forEach(function (x) { x.classList.remove("swl-hide"); });
            more.remove();
          };
          c.appendChild(more);
        }
        grid.appendChild(c);
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

  /* L1–L4 process-hierarchy tree: Function › Process › Persona › Objective.
     Hovering a persona (L3) reveals its detail card. */
  function hierarchy(f, p) {
    var wrap = el("div", "phier-wrap");
    wrap.appendChild(el("div", "st-subq", "Process hierarchy <small>L1 → L4 · hover a persona for detail</small>"));
    var tree = el("div", "phier");
    tree.appendChild(node(1, f.name, f.icon));
    var l2 = el("div", "ph-children");
    l2.appendChild(node(2, p.name));
    var l3 = el("div", "ph-children");
    p.roles.forEach(function (r) {
      var branch = el("div", "ph-branch");
      branch.appendChild(personaNode(r));
      var l4 = el("div", "ph-children");
      (r.objectives || []).forEach(function (o) { l4.appendChild(node(4, o.name, null, o.kpi)); });
      branch.appendChild(l4);
      l3.appendChild(branch);
    });
    l2.appendChild(l3);
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

  function personaNode(r) {
    var s = personaStats(r);
    return el("div", "ph-node l3 persona",
      '<span class="ph-lvl">L3</span><span class="ph-nm">' + esc(r.name) + '</span>' +
      '<small class="ph-sub">' + r.objectives.length + ' obj · ' + s.patterns + ' patterns</small>' +
      personaPop(r, s));
  }

  // derive a persona's scope from its objectives' patterns → action blocks → fitment
  function personaStats(r) {
    var ids = {}, out = [];
    (r.objectives || []).forEach(function (o) {
      (o.patternIds || []).forEach(function (id) { if (!ids[id]) { ids[id] = 1; out.push(id); } });
    });
    var blocks = window.PIQ.collectBlocks(out);
    var auto = 0, hitl = 0;
    blocks.forEach(function (b) { (window.PIQ.fitment(b).mode === "auto" ? auto++ : hitl++); });
    return { patterns: out.length, blocks: blocks.length, auto: auto, hitl: hitl };
  }

  function personaPop(r, s) {
    var total = (s.auto + s.hitl) || 1;
    var autoPct = Math.round(s.auto / total * 100);
    var objs = (r.objectives || []).map(function (o) {
      return '<li><b>' + esc(o.name) + '</b><span>' + esc(o.kpi) + '</span></li>';
    }).join("");
    return '<div class="persona-pop">' +
      '<div class="pp-h">' + esc(r.name) + '</div>' +
      '<div class="pp-lab">Objectives</div><ul class="pp-objs">' + objs + '</ul>' +
      '<div class="pp-stats"><div><b>' + s.patterns + '</b><span>patterns</span></div>' +
      '<div><b>' + s.blocks + '</b><span>action blocks</span></div></div>' +
      '<div class="pp-lab">Automation mix</div>' +
      '<div class="pp-mix"><div class="pp-bar"><i style="width:' + autoPct + '%"></i></div>' +
      '<span>' + s.auto + ' auto · ' + s.hitl + ' approval</span></div></div>';
  }

  /* Personas — multi-select, defaulting to every persona in the process. */
  function stepPersonas(body) {
    var p = proc(); if (!p) { state.step = 2; return redraw(); }
    var c = C();
    body.appendChild(el("div", "st-q",
      "Which <b>personas</b> participate in " + esc(p.name) + "?" +
      '<button class="linkbtn" id="stAllP">' + (c.roleIds.length === p.roles.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "Every persona in the process is included by default — the agents coordinate across all of them. Deselect any you want to leave out of scope."));
    body.appendChild(pickGrid(p.roles, function (r) {
      var on = c.roleIds.indexOf(r.id) >= 0;
      var objs = r.objectives.map(function (o) { return o.name; }).join(" · ");
      return '<div class="pc-main"><div class="pc-t">' + esc(r.name) + '</div>' +
        '<div class="pc-d">' + esc(objs) + '</div></div>' +
        '<div class="pc-meta">' + r.objectives.length + ' objectives</div>' + (on ? '<div class="pc-on">✓</div>' : '');
    }, function (r) { togglePersona(r); redraw(); },
       function (r) { return c.roleIds.indexOf(r.id) >= 0; }));
    body.appendChild(nextBar(c.roleIds.length + " persona" + (c.roleIds.length !== 1 ? "s" : "") + " in scope",
      c.roleIds.length ? "Choose objectives →" : "", function () { state.step = 4; redraw(); }));
    var all = document.getElementById("stAllP");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.roleIds = c.roleIds.length === p.roles.length ? [] : p.roles.map(function (r) { return r.id; });
      syncObjectives(false); redraw();
    };
  }
  function togglePersona(r) {
    var c = C(), i = c.roleIds.indexOf(r.id);
    if (i >= 0) c.roleIds.splice(i, 1); else c.roleIds.push(r.id);
    syncObjectives(false);   // re-derive objectives + patterns for the new persona set
  }

  /* Objectives — multi-select, grouped by persona, all in scope by default. */
  function stepObjectives(body) {
    var c = C(), roles = window.PIQ.roles();
    if (!roles.length) { state.step = 3; return redraw(); }
    var allObjIds = [];
    roles.forEach(function (r) { (r.objectives || []).forEach(function (o) { allObjIds.push(o.id); }); });
    body.appendChild(el("div", "st-q",
      "Which <b>objectives</b> should the agents pursue?" +
      '<button class="linkbtn" id="stAllO">' + (c.objIds.length === allObjIds.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "Objectives are grouped by persona. All are in scope by default; each maps to the KPI it moves and the patterns that deliver it."));
    roles.forEach(function (r) {
      body.appendChild(el("div", "obj-group-h", esc(r.name)));
      body.appendChild(pickGrid(r.objectives, function (o) {
        var on = c.objIds.indexOf(o.id) >= 0;
        return '<div class="pc-main"><div class="pc-t">' + esc(o.name) + '</div>' +
          '<div class="pc-d">Measured by <b>' + esc(o.kpi) + '</b></div></div>' +
          '<div class="pc-meta"><span class="pc-n">' + o.patternCount + '</span> patterns</div>' +
          (on ? '<div class="pc-on">✓</div>' : '');
      }, function (o) { toggleObjective(o); redraw(); },
         function (o) { return c.objIds.indexOf(o.id) >= 0; }));
    });
    var np = c.patternIds.length;
    body.appendChild(nextBar(c.objIds.length + " objective" + (c.objIds.length !== 1 ? "s" : "") + " · " + np + " pattern" + (np !== 1 ? "s" : ""),
      c.objIds.length ? "Review patterns →" : "", function () { state.step = 5; redraw(); }));
    var all = document.getElementById("stAllO");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.objIds = c.objIds.length === allObjIds.length ? [] : allObjIds.slice();
      syncPatterns(); redraw();
    };
  }
  function toggleObjective(o) {
    var c = C(), i = c.objIds.indexOf(o.id);
    if (i >= 0) c.objIds.splice(i, 1); else c.objIds.push(o.id);
    syncPatterns();
  }

  function stepPatterns(body) {
    var c = C();
    var ids = window.PIQ.objectivePatternIds(); if (!ids.length) { state.step = 4; return redraw(); }
    var pats = ids.map(window.PIQ.pattern).filter(Boolean);
    var p0 = proc();
    body.appendChild(el("div", "st-q",
      "Select the <b>patterns</b> to deploy for “" + esc(p0 ? p0.name : "this process") + "”" +
      '<button class="linkbtn" id="stAll">' + (c.patternIds.length === pats.length ? "clear all" : "select all") + '</button>'));
    body.appendChild(el("p", "st-hint",
      "Each pattern encodes the analyst's judgement: a happy path (straight-through) plus a branching DAG that handles the variations. " +
      "Tick the circle to add a pattern; click the card to open its detail and customise the happy-path DAG."));

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
          (custom ? ' <span class="dagbadge">✎ DAG edited</span>' : '') + '</div>' +
        '<button class="pat-check' + (sel ? " on" : "") + '" title="' + (sel ? "Remove from composition" : "Add to composition") + '">' + (sel ? "✓" : "+") + '</button></div>' +
        '<div class="pat-mm">“' + esc(trim(p.mentalModel, 150)) + '”</div>' +
        '<div class="pat-flow"><span class="flab">Happy path</span>' + (flow || '<span class="muted">no steps</span>') +
          (happy.length > 4 ? '<i>→</i><span class="mini-b more">+' + (happy.length - 4) + '</span>' : '') + '</div>' +
        '<div class="pat-foot"><span>' + branches + ' variation branches · ' +
          (gates ? '🔒 ' + gates + ' gate' + (gates > 1 ? "s" : "") : 'no gates') + '</span>' +
        '<span class="pat-cue">✎ details &amp; DAG</span></div>');
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
      c.patternIds.length ? "Configure action blocks →" : "", function () { state.step = 6; redraw(); }));

    var all = document.getElementById("stAll");
    if (all) all.onclick = function (e) {
      e.stopPropagation();
      c.patternIds = c.patternIds.length === pats.length ? [] : pats.map(function (p) { return p.id; });
      c.blocks = {}; redraw();
    };
  }

  /* ---- Pattern detail + happy-path DAG editor (opened from a pattern card) --
     Shows the full pattern (mental model, 3-layer mapping, branching DAG, gates)
     and lets the SME reorder / enable-disable the happy-path steps. Edits persist
     into PIQ.composition.dag and flow through collectBlocks → swimlane, the
     action-block configurator, Fitment and Runtime. */
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
  // materialise a per-pattern DAG override (seeded from the original) for editing
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

      '<div class="dedit"><div class="dedit-h"><h4>Happy-path DAG ' +
        '<span class="muted">reorder & enable/disable — flows to Fitment &amp; Runtime</span></h4>' +
        (custom ? '<button class="linkbtn" id="dagReset">reset to default</button>' : '') + '</div>' +
        '<div class="dsteps">' + rows + '</div>' +
        '<div class="dadd"><input id="dagAddInput" class="dadd-in" autocomplete="off" ' +
          'placeholder="+ Add an action block — search the repository or type your own…"/>' +
          '<div class="dadd-list" id="dagAddList"></div></div>' +
        '<div class="dprev"><span class="flab">Resulting sequence <b>' + onCount + '/' + steps.length + '</b></span>' + prev + '</div>' +
      '</div>' +

      '<div class="d-sec"><h4>Branching DAG <span class="muted">variation handling · read-only</span></h4>' +
        '<div class="branches">' + (branches || '<span class="muted">none</span>') + '</div></div>' +
      (p.hitlGates && p.hitlGates.length ? '<div class="gatebar">🔒 HITL gates: ' + p.hitlGates.map(esc).join(" · ") + '</div>' : '') +
      '</div>' +

      '<div class="pdlg-foot"><span class="muted">' + (custom ? "✎ DAG customised for this composition" : "Default DAG") + '</span>' +
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
  // populate the add-block suggestion list from the repository, filtered by the search box
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
