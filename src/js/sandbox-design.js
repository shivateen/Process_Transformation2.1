/* sandbox-design.js — the guided Design Studio demo (sandbox sub-view "sbguided").
 *
 * A seven-step auto-playing walkthrough of the Studio flow
 * (Theme → Function → Process → Personas → Objectives → Patterns → Configure),
 * narrated, with the real taxonomy and the real 101-pattern library behind it.
 *
 * This is a SEPARATE view, not a patch to studio.js — the Studio is on the
 * do-not-modify list. "Explore freely" hands the user to the real Studio, which is
 * already safe: sandbox.js has swapped the composition and neutered persistence.
 *
 * Note on badges: the spec asked for a judgment-type badge (OPT/DIA/TIM/ADV/EXC).
 * No such field exists on a pattern. The real classification axes are `priority`
 * (Critical/High/Medium/Low) and `category` (12 behavioural families), and those are
 * what the pattern cards below show.
 */
(function () {
  "use strict";
  var PIQ = window.PIQ;

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  var AUTO_MS = 4000;
  var STEPS = ["Theme", "Function", "Process", "Personas", "Objectives", "Patterns", "Configure"];

  var NARR = [
    { h: "Start at the CFO's altitude",
      b: "Themes span functions. Working Capital connects O2C collections to P2P payment timing " +
         "and Supply Chain inventory. Its compound KPI is the Cash Conversion Cycle — and it is " +
         "the thing the CFO is actually measured on." },
    { h: "Zoom into the function",
      b: "Order-to-Cash is fully built. Procure-to-Pay is live. The other eight ship as samples " +
         "that prove the framework generalises — the accelerator is function-agnostic by design." },
    { h: "Pick the process area",
      b: "AR Collections & Dispute Management — where the money is. Four personas, thirty-one " +
         "patterns, the densest coverage in the accelerator." },
    { h: "Who does the work?",
      b: "Personas own missions; missions own patterns. The Collections Analyst carries eighteen " +
         "named behavioural patterns — not eighteen alerts, eighteen mental models with names, " +
         "chains and branches." },
    { h: "What are they trying to achieve?",
      b: "Each objective maps to a measurable KPI. The patterns are the mechanism: they encode " +
         "HOW the objective is achieved, not merely WHAT to measure." },
    { h: "The behavioural intelligence layer",
      b: "Each pattern has a NAME. “#1 · The 29th-Day Tactic” is not “Late Payment Alert”. " +
         "Naming is the point — it means the analyst and the system share one mental model. " +
         "Process mining finds unnamed statistical deviations; ProcessIQ names the behaviour and " +
         "encodes the response." },
    { h: "From patterns to executable blocks",
      b: "Every action block carries an executor binding. WRITE blocks default to human-in-the-loop; " +
         "READ blocks run autonomously. The saga net handles failure: retry → compensate → escalate." },
  ];

  var state = { step: 0, playing: false, timer: null };

  function C() { return PIQ.composition; }
  function tax() { return PIQ.tax || {}; }
  function fnO2C() { return (tax().functions || []).filter(function (f) { return f.id === "o2c"; })[0] || null; }
  function procAR() {
    var f = fnO2C(); if (!f) return null;
    return (f.processes || []).filter(function (p) { return p.id === C().procId; })[0] || null;
  }

  /* ---- render ----------------------------------------------------------- */

  function render(view) {
    var wrap = el("div", "sd-wrap");
    wrap.innerHTML =
      '<div class="sd-head">' +
        '<div><div class="kv">Guided demo · Design Studio</div>' +
        '<h2>One theme to a hundred action blocks</h2></div>' +
        '<button class="sd-free" id="sdFree">Explore freely in the Studio →</button>' +
      '</div>' +
      '<div class="sd-dots" id="sdDots"></div>' +
      '<div class="sd-stage" id="sdStage"></div>' +
      '<div class="sd-narr" id="sdNarr"></div>' +
      '<div class="sd-ctl">' +
        '<button class="sd-b ghost" id="sdBack">← Back</button>' +
        '<button class="sd-b play" id="sdPlay">▶ Auto-play</button>' +
        '<span class="sd-sp"></span>' +
        '<span class="sd-n" id="sdN"></span>' +
        '<button class="sd-b go" id="sdNext">Next →</button>' +
      '</div>';
    view.appendChild(wrap);

    document.getElementById("sdFree").onclick = function () { stop(); PIQ.go("studio"); };
    document.getElementById("sdBack").onclick = function () { stop(); go(state.step - 1); };
    document.getElementById("sdNext").onclick = function () { stop(); go(state.step + 1); };
    document.getElementById("sdPlay").onclick = function () { state.playing ? stop() : play(); };

    // auto-play pauses while the pointer is over anything interactive
    wrap.addEventListener("mouseenter", function () { if (state.playing) clearTimeout(state.timer); }, true);
    wrap.addEventListener("mouseleave", function () { if (state.playing) queue(); }, true);

    if (!wrap._keys) {
      wrap._keys = true;
      document.addEventListener("keydown", onKey);
    }
    draw();
  }

  function onKey(e) {
    if (PIQ.active !== "sbguided") return;
    if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(state.step + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(state.step - 1); }
    else if (e.key === " ") { e.preventDefault(); state.playing ? stop() : play(); }
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length) {
      if (i >= STEPS.length && PIQ.sandbox) PIQ.sandbox.narrate("design-complete");
      return;
    }
    state.step = i;
    draw();
    if (i === 0 && PIQ.sandbox) PIQ.sandbox.narrate("theme-selected");
    if (i === STEPS.length - 1 && PIQ.sandbox) PIQ.sandbox.narrate("design-complete");
  }

  function play() { state.playing = true; syncCtl(); queue(); }
  function stop() { state.playing = false; clearTimeout(state.timer); syncCtl(); }
  function queue() {
    clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      if (!state.playing) return;
      if (state.step >= STEPS.length - 1) return stop();
      go(state.step + 1);
      queue();
    }, AUTO_MS);
  }

  function syncCtl() {
    var p = document.getElementById("sdPlay");
    if (!p) return;
    p.textContent = state.playing ? "❚❚ Pause" : "▶ Auto-play";
    p.classList.toggle("on", state.playing);
    var st = document.getElementById("sdStage");
    if (st) st.classList.toggle("playing", state.playing);
  }

  function draw() {
    var dots = document.getElementById("sdDots");
    if (!dots) return;
    dots.innerHTML = STEPS.map(function (s, i) {
      return '<button class="sd-dot' + (i < state.step ? " done" : "") + (i === state.step ? " on" : "") +
        '" data-i="' + i + '"><i></i><span>' + esc(s) + "</span></button>";
    }).join("");
    dots.querySelectorAll(".sd-dot").forEach(function (b) {
      b.onclick = function () { stop(); go(+b.dataset.i); };
    });

    var n = NARR[state.step];
    var narr = document.getElementById("sdNarr");
    narr.innerHTML = "<h4>" + esc(n.h) + "</h4><p>" + esc(n.b) + "</p>" +
      (state.playing ? '<div class="sd-prog"><i></i></div>' : "");

    document.getElementById("sdN").textContent = "Step " + (state.step + 1) + " of " + STEPS.length;
    document.getElementById("sdBack").disabled = state.step === 0;
    document.getElementById("sdNext").disabled = state.step === STEPS.length - 1;
    document.getElementById("sdStage").innerHTML =
      [stTheme, stFunction, stProcess, stPersonas, stObjectives, stPatterns, stConfigure][state.step]();
    syncCtl();
    bindStage();
  }

  function bindStage() {
    document.querySelectorAll("#sdStage .sd-pcard").forEach(function (b) {
      b.onclick = function () {
        stop();
        if (PIQ.sandbox) PIQ.sandbox.showPatternDetail(+b.dataset.pat);
      };
    });
  }

  /* ---- the seven stages, all read off the live taxonomy ----------------- */

  function stTheme() {
    var t = (tax().themes || []).filter(function (x) { return x.id === C().themeId; })[0];
    if (!t) return empty("theme");
    var k = t.compoundKPI || {};
    return '<div class="sd-one">' +
      '<div class="sd-pick on"><span class="sd-ico">' + (t.icon || "◆") + "</span>" +
        "<b>" + esc(t.name) + "</b><small>" + esc(t.tagline || "") + "</small></div>" +
      '<div class="sd-kpi">' +
        '<div class="sd-kpi-n">' + esc(k.name || "") + "</div>" +
        '<div class="sd-kpi-f mono">' + esc(k.formula || "") + "</div>" +
        '<div class="sd-kpi-v"><span><b>' + esc(k.current) + "</b>" + esc(k.unit || "") + "<i>current</i></span>" +
          '<span class="arr">→</span>' +
          '<span class="tgt"><b>' + esc(k.target) + "</b>" + esc(k.unit || "") + "<i>target</i></span></div>" +
      "</div></div>";
  }

  function stFunction() {
    var fns = tax().functions || [];
    return '<div class="sd-grid f">' + fns.map(function (f) {
      return '<div class="sd-pick' + (f.id === C().fnId ? " on" : "") + '">' +
        '<span class="sd-ico">' + (f.icon || "▣") + "</span><b>" + esc(f.name) + "</b>" +
        '<span class="sd-st ' + esc(f.status) + '">' + esc(f.status) + "</span></div>";
    }).join("") + "</div>";
  }

  function stProcess() {
    var f = fnO2C(); if (!f) return empty("function");
    return '<div class="sd-grid p">' + (f.processes || []).map(function (p) {
      var roles = (p.roles || []).length, pats = 0;
      (p.roles || []).forEach(function (r) {
        (r.objectives || []).forEach(function (o) { pats += (o.patternIds || []).length; });
      });
      return '<div class="sd-pick' + (p.id === C().procId ? " on" : "") + '">' +
        "<b>" + esc(p.name) + "</b><small>" + esc(p.desc || "") + "</small>" +
        '<span class="sd-mini">' + roles + " personas · " + pats + " patterns</span></div>";
    }).join("") + "</div>";
  }

  function stPersonas() {
    var p = procAR(); if (!p) return empty("process");
    return '<div class="sd-grid r">' + (p.roles || []).map(function (r) {
      var pats = 0;
      (r.objectives || []).forEach(function (o) { pats += (o.patternIds || []).length; });
      var on = C().roleIds.indexOf(r.id) >= 0;
      return '<div class="sd-pick' + (on ? " on" : "") + '">' +
        "<b>" + esc(r.name) + "</b>" +
        '<span class="sd-mini">' + (r.objectives || []).length + " objective" +
          ((r.objectives || []).length === 1 ? "" : "s") + "</span>" +
        '<span class="sd-cnt">' + pats + "</span></div>";
    }).join("") + "</div>";
  }

  function stObjectives() {
    var p = procAR(); if (!p) return empty("process");
    var rows = [];
    (p.roles || []).forEach(function (r) {
      (r.objectives || []).forEach(function (o) {
        rows.push('<div class="sd-obj' + (C().objIds.indexOf(o.id) >= 0 ? " on" : "") + '">' +
          '<div class="sd-obj-l"><b>' + esc(o.name) + "</b><small>" + esc(r.name) + "</small></div>" +
          '<div class="sd-obj-k">' + esc(o.kpi || "—") + "</div>" +
          '<div class="sd-obj-n">' + (o.patternIds || []).length + "</div></div>");
      });
    });
    return '<div class="sd-objs"><div class="sd-obj hd"><div class="sd-obj-l">Objective</div>' +
      '<div class="sd-obj-k">KPI</div><div class="sd-obj-n">Patterns</div></div>' +
      rows.join("") + "</div>";
  }

  function stPatterns() {
    var ids = C().patternIds || [];
    return '<div class="sd-pats">' + ids.map(function (id) {
      var p = PIQ.pattern(id);
      if (!p) return "";
      var mm = String(p.mentalModel || "");
      if (mm.length > 96) mm = mm.slice(0, 93).replace(/[\s,;.]+$/, "") + "…";
      return '<button class="sd-pcard pri-' + esc(String(p.priority).toLowerCase()) + '" data-pat="' + id + '">' +
        '<div class="sd-pc-h"><span class="sd-pc-n">#' + id + "</span><b>" + esc(p.name) + "</b></div>" +
        '<div class="sd-pc-t">' +
          '<span class="sd-tag pri-' + esc(String(p.priority).toLowerCase()) + '">' + esc(p.priority) + "</span>" +
          '<span class="sd-tag cat">' + esc(shortCat(p.category)) + "</span>" +
        "</div>" +
        '<div class="sd-pc-mm">“' + esc(mm) + '”</div>' +
        '<div class="sd-pc-f">' + (p.originalDAG || []).length + " action blocks" +
          ((p.hitlGates || []).length ? ' · <b>HITL gate</b>' : "") + "</div>" +
        "</button>";
    }).join("") + "</div>" +
    '<p class="sd-note">Click any pattern to open its mental model, its process flow and its ' +
    "branches. Every one of these is executable — none of them is a chart.</p>";
  }

  function shortCat(c) {
    return String(c || "")
      .replace(" & Deduction Manipulation", " & Deduction")
      .replace("Intentional Stalling & Delay Tactics", "Stalling & Delay")
      .replace("Credit Risk & Insolvency Indicators", "Credit Risk")
      .replace("Cash Application & Remittance Friction", "Cash App & Remittance")
      .replace("Relationship & Contractual Abuse", "Relationship Abuse");
  }

  function stConfigure() {
    var blocks = PIQ.collectBlocks(C().patternIds || []) || [];
    var auto = 0, hitl = 0;
    var rows = blocks.slice(0, 14).map(function (b) {
      var cfg = (C().blocks || {})[b.key] || {};
      var mode = cfg.mode || PIQ.fitment(b).mode;
      if (mode === "hitl") hitl++; else auto++;
      return '<div class="sd-blk">' +
        '<span class="sd-blk-n mono">' + esc(PIQ.prettify ? PIQ.prettify(b.key) : b.key) + "</span>" +
        '<span class="sd-blk-t">' + esc(cfg.tech || "LLM Agent") + "</span>" +
        '<span class="sd-blk-m ' + esc(mode) + '">' + (mode === "hitl" ? "🔒 HITL" : "auto") + "</span>" +
        "</div>";
    }).join("");
    blocks.slice(14).forEach(function (b) {
      var cfg = (C().blocks || {})[b.key] || {};
      ((cfg.mode || PIQ.fitment(b).mode) === "hitl") ? hitl++ : auto++;
    });

    return '<div class="sd-cfg">' +
      '<div class="sd-sum">' +
        '<div class="sd-sum-i"><b>1</b><span>theme</span></div><i>→</i>' +
        '<div class="sd-sum-i"><b>1</b><span>function</span></div><i>→</i>' +
        '<div class="sd-sum-i"><b>' + (C().roleIds || []).length + "</b><span>personas</span></div><i>→</i>" +
        '<div class="sd-sum-i"><b>' + (C().patternIds || []).length + "</b><span>patterns</span></div><i>→</i>" +
        '<div class="sd-sum-i acc"><b>' + blocks.length + "</b><span>action blocks</span></div>" +
      "</div>" +
      '<div class="sd-modes"><span class="sd-blk-m auto">' + auto + " autonomous</span>" +
        '<span class="sd-blk-m hitl">🔒 ' + hitl + " human-gated</span></div>" +
      '<div class="sd-blks">' + rows +
        (blocks.length > 14 ? '<div class="sd-blk more">+' + (blocks.length - 14) +
          " more action blocks</div>" : "") +
      "</div></div>";
  }

  function empty(what) {
    return '<p class="sd-empty">The demo composition has no ' + esc(what) +
      " — the taxonomy may have changed. Check the console for the id mismatch.</p>";
  }

  PIQ.modules.sbguided = { render: render };
})();
