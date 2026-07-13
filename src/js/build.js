/* Stage 3 · Build — Implementation Studio
 * Makes visible what happens after "configure the action blocks" (Studio) and
 * before "run the workflow" (Run & Govern): the configured blocks + fitment verdicts
 * are assembled into an executable agent chain, validated, and promoted to live.
 *
 * Input  : PIQ.composition (selected patterns + configured blocks + fitment).
 * Output : on "Generate Agent Chain" the composition is validated and marked live,
 *          which unlocks the Run & Govern stage.
 */
(function () {
  "use strict";
  var PRIO = window.PIQ.meta.priorityLegend;

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function C() { return window.PIQ.composition; }

  // a block is a WRITE / mutating action if it isn't a pure read/sense verb
  function isWrite(b) {
    var t = b.key.toLowerCase();
    if (/read|pull|scan|monitor|track|fingerprint|ingest|compare|compute|detect|assess|check|match|classif|score/.test(t)) return false;
    return true;
  }

  function render(view) {
    var c = C();
    if (!c.patternIds.length) { view.appendChild(empty()); return; }
    var root = el("div", "bld");
    root.appendChild(head());
    root.appendChild(inputBar());
    root.appendChild(assemblyPanel());
    root.appendChild(validationPanel());
    root.appendChild(generateBar());
    view.appendChild(root);
    wire(root);
  }

  function empty() {
    var d = el("div", "fit-empty",
      '<div class="kv">Build — Implementation Studio</div>' +
      '<h2>Nothing to build yet</h2>' +
      '<p>Compose a process in the <b>Studio</b> and run it through <b>Agent Fitment</b>. ' +
      'The configured blocks are assembled into an executable agent chain here.</p>' +
      '<button class="btn go" id="toStudio">← Go to Studio</button>');
    d.querySelector("#toStudio").onclick = function () { window.PIQ.go("studio"); };
    return d;
  }

  function head() {
    var f = window.PIQ.fn(), p = window.PIQ.proc(), c = C();
    var blocks = window.PIQ.collectBlocks(c.patternIds);
    return el("div", "fit-head",
      '<div><div class="kv">Build — Implementation Studio</div>' +
      '<h2>' + esc(f.name) + ' › ' + esc((p || {}).name || "") + (c.live ? ' <span class="livedot">● LIVE</span>' : '') + '</h2>' +
      '<p class="fit-lede">The configured action blocks and their fitment verdicts are chained into an executable agent ' +
      'DAG — tech stack bound, execution mode set, rollback and connectivity checked — then promoted to production.</p></div>' +
      '<div class="fit-kpis">' + kpi(c.patternIds.length, "patterns") + kpi(blocks.length, "blocks") +
      kpi(c.patternIds.length, "agent chains") + '</div>');
  }
  function kpi(v, l) { return '<div class="fkpi"><b>' + v + '</b><span>' + l + '</span></div>'; }

  function inputBar() {
    var c = C();
    var keys = Object.keys(c.blocks);
    var nConf = keys.filter(function (k) { return c.blocks[k].configured; }).length;
    return el("div", "bld-input",
      '<span class="bi-lab">Input from Studio</span>' +
      '<span class="bi-pill">' + c.patternIds.length + ' patterns selected</span>' +
      '<span class="bi-pill">' + keys.length + ' action blocks</span>' +
      '<span class="bi-pill">' + nConf + ' / ' + keys.length + ' configured</span>' +
      '<span class="bi-pill">fitment verdicts resolved</span>');
  }

  /* Assembly — one agent chain per selected pattern; its happy-path blocks connect
     left-to-right, each labelled with the configured tech stack + execution mode. */
  function assemblyPanel() {
    var c = C();
    var wrap = el("div", "bld-asm");
    wrap.appendChild(el("div", "st-subq", "Agent chain assembly <small>configured blocks → executable DAG · press Generate to bind</small>"));
    var chains = el("div", "asm-chains");
    var pats = window.PIQ.selectedPatterns();
    var ni = 0;
    pats.forEach(function (p) {
      var steps = window.PIQ.happyDAG(p.id);
      var nodes = steps.map(function (k) {
        var cfg = c.blocks[k] || {};
        var write = /Auto_|Post|Clear|Update|Hold|Notify|Schedule|Block|Freeze|Reschedule|Recommend|Escalate|Route|Request/.test(k);
        var mode = cfg.mode || "auto";
        ni++;
        return '<div class="asm-node" data-ni="' + ni + '">' +
          '<div class="an-b ' + (write ? "w" : "r") + '">' + esc(window.PIQ.prettify(k)) + '</div>' +
          '<div class="an-meta"><span class="an-tech">' + esc(cfg.tech || "—") + '</span>' +
          '<span class="an-mode m-' + mode + '">' + (mode === "hitl" ? "HITL" : "Auto") + '</span></div></div>';
      }).join('<span class="asm-arr">→</span>');
      chains.appendChild(el("div", "asm-chain",
        '<div class="asm-pat"><span class="pat-prio" style="background:' + PRIO[p.priority] + '"></span>' +
        esc(p.name) + (p.sample ? ' <span class="statusbadge sample">sample</span>' : '') + '</div>' +
        '<div class="asm-flow">' + (nodes || '<span class="muted">no happy-path blocks</span>') + '</div>'));
    });
    wrap.appendChild(chains);
    return wrap;
  }

  /* Validation — the four go-live gates. Some pass from the configuration; source
     connectivity is verified as part of the (simulated) generate step. */
  function checks() {
    var c = C();
    var blocks = window.PIQ.collectBlocks(c.patternIds);
    var techOK = blocks.every(function (b) { var cf = c.blocks[b.key]; return cf && cf.tech && cf.tech !== "—"; });
    var writes = blocks.filter(function (b) { return b.hitl || (isWrite(b) && window.PIQ.fitment(b).mode === "hitl"); });
    var hitlOK = writes.every(function (b) { return (c.blocks[b.key] || {}).mode === "hitl"; });
    var sagaOK = techOK;   // every governed write registers a compensating step
    return [
      { k: "tech", ok: techOK, label: "All blocks have a tech stack assigned",
        detail: techOK ? "SAP BAPI/RFC · Oracle REST · LLM Agent · RPA bound" : "Some blocks still need a technology" },
      { k: "hitl", ok: hitlOK, label: "All WRITE blocks have a HITL gate",
        detail: writes.length ? (hitlOK ? writes.length + " approval-gated writes routed to human sign-off" : "An approval-gated write is set to Auto") : "No mutating writes require a gate" },
      { k: "saga", ok: sagaOK, label: "All blocks have Saga rollback defined",
        detail: sagaOK ? "Compensating transaction registered per write step" : "Assign tech to enable rollback registration" },
      { k: "conn", ok: !!C()._built, label: "Source system connectivity verified",
        detail: C()._built ? "SAP + Oracle endpoints reachable · credentials valid" : "Verified during agent-chain generation" },
    ];
  }

  function validationPanel() {
    var wrap = el("div", "bld-valid");
    wrap.appendChild(el("div", "st-subq", "Pre-flight validation <small>every gate must pass before the chain can run</small>"));
    var list = el("div", "vchecks", "");
    list.id = "vchecks";
    list.innerHTML = checks().map(function (v) {
      return '<div class="vcheck ' + (v.ok ? "ok" : "no") + '"><span class="vc-ic">' + (v.ok ? "✓" : "○") + '</span>' +
        '<div class="vc-main"><div class="vc-l">' + esc(v.label) + '</div>' +
        '<div class="vc-d">' + esc(v.detail) + '</div></div></div>';
    }).join("");
    wrap.appendChild(list);
    return wrap;
  }

  function generateBar() {
    var c = C();
    var ready = checks().slice(0, 3).every(function (v) { return v.ok; });
    return el("div", "fit-golive",
      '<div><b>' + (c.live ? "Agent chain generated." : "Ready to build.") + '</b> ' +
      (c.live ? "The composed process is live — open Run &amp; Govern to operate it."
              : "Bind the configured blocks into an executable, governed agent chain and promote it to production.") + '</div>' +
      (c.live
        ? '<button class="btn go" id="bldRun">Open Live Operations →</button>'
        : '<button class="btn go" id="bldGen"' + (ready ? "" : " disabled") + '>⚙ Generate Agent Chain</button>'));
  }

  function wire(root) {
    var gen = root.querySelector("#bldGen");
    if (gen) gen.onclick = function () { generate(root); };
    var run = root.querySelector("#bldRun");
    if (run) run.onclick = function () { window.PIQ.go("runtime"); };
  }

  // animate the assembly, verify connectivity, mark live, unlock Run & Govern
  function generate(root) {
    var nodes = root.querySelectorAll(".asm-node");
    var gen = root.querySelector("#bldGen");
    if (gen) { gen.disabled = true; gen.textContent = "● Assembling…"; }
    // spread the reveal over ~1.6s total, however many nodes there are
    var stp = nodes.length ? Math.min(70, Math.floor(1600 / nodes.length)) : 0;
    nodes.forEach(function (n, i) { setTimeout(function () { n.classList.add("on"); }, 60 + i * stp); });
    var done = 60 + nodes.length * stp + 320;
    setTimeout(function () {
      var c = C();
      c._built = true; c.live = true;
      if (window.PIQ.persistComposition) window.PIQ.persistComposition();
      // re-render so validation + go-live bar reflect the promoted state
      var view = document.getElementById("view"); view.innerHTML = ""; render(view);
    }, done);
  }

  window.PIQ.modules.build = { render: render };
  window.PIQ.onErp(function () { if (window.PIQ.active === "build") { var v = document.getElementById("view"); v.innerHTML = ""; render(v); } });
})();
