/* Stage 2 · Discover & Fit — Agent Fitment
 * Takes the composition handed over by the Studio and (a) assesses every action block
 * for agent fitment (Full-auto / Assisted / Human-led), (b) records the happy path and
 * agentivises it as the straight-through spine, and (c) renders the to-be process flow:
 * the happy path with the selected patterns attached as variation handlers.
 *
 * Deterministic: fitment verdicts come from PIQ.fitment; nothing here invents data.
 */
(function () {
  "use strict";
  var PRIO = window.PIQ.meta.priorityLegend;

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function C() { return window.PIQ.composition; }

  function render(view) {
    var c = C();
    if (!c.patternIds.length) { view.appendChild(empty()); return; }
    var blocks = window.PIQ.collectBlocks(c.patternIds);
    var happy = blocks.filter(function (b) { return b.source === "happy"; });
    var fits = blocks.map(function (b) { return window.PIQ.fitment(b); });
    var dist = { "Full-auto": 0, "Assisted": 0, "Human-led": 0 };
    fits.forEach(function (f) { dist[f.tier]++; });
    var stp = Math.round(100 * dist["Full-auto"] / blocks.length);

    var root = el("div", "fit");
    root.appendChild(head(c, blocks, stp));
    root.appendChild(distBar(dist, blocks.length));
    root.appendChild(fitmentTable(blocks));
    root.appendChild(happyPanel(happy));
    root.appendChild(tobePanel());
    root.appendChild(goLiveBar(stp));
    view.appendChild(root);
    wire(root, happy);
  }

  function empty() {
    var d = el("div", "fit-empty",
      '<div class="kv">Stage 2 · Discover & Fit</div>' +
      '<h2>Nothing composed yet</h2>' +
      '<p>Use the <b>Studio</b> to pick a function, process and patterns. Your selection flows here for agent-fitment assessment and happy-path agentivisation.</p>' +
      '<button class="btn go" id="toStudio">← Go to Studio</button>');
    d.querySelector("#toStudio").onclick = function () { window.PIQ.go("studio"); };
    return d;
  }

  function head(c, blocks, stp) {
    var f = window.PIQ.fn(), o = window.PIQ.objective();
    return el("div", "fit-head",
      '<div><div class="kv">Stage 2 · Discover & Fit — Process discovery & agent fitment</div>' +
      '<h2>' + esc(f.name) + ' › ' + esc(o.name) + '</h2>' +
      '<p class="fit-lede">Every activity in the to-be flow is assessed for agent fit. The happy path is recorded and agentivised; the patterns become the variation handlers.</p></div>' +
      '<div class="fit-kpis">' +
        kpi(c.patternIds.length, "patterns") + kpi(blocks.length, "action blocks") + kpi(stp + "%", "straight-through") +
      '</div>');
  }
  function kpi(v, l) { return '<div class="fkpi"><b>' + v + '</b><span>' + l + '</span></div>'; }

  function distBar(dist, total) {
    var seg = [["Full-auto", "#27ae60"], ["Assisted", "#e67e22"], ["Human-led", "#c0392b"]];
    var bars = seg.filter(function (s) { return dist[s[0]]; }).map(function (s) {
      return '<i style="flex:' + dist[s[0]] + ';background:' + s[1] + '" title="' + s[0] + '"></i>';
    }).join("");
    var legend = seg.map(function (s) {
      return '<span class="dl"><i style="background:' + s[1] + '"></i>' + s[0] + ' · <b>' + dist[s[0]] + '</b></span>';
    }).join("");
    return el("div", "fit-dist",
      '<div class="fd-h">Agent fitment distribution <span class="muted">across ' + total + ' action blocks</span></div>' +
      '<div class="fd-bar">' + bars + '</div><div class="fd-legend">' + legend + '</div>');
  }

  function fitmentTable(blocks) {
    var rows = blocks.map(function (b) {
      var fit = window.PIQ.fitment(b);
      var cfg = (C().blocks[b.key] || {});
      var pct = Math.round(fit.score * 100);
      return '<div class="ftrow">' +
        '<div class="ft-src k-' + (b.source === "happy" ? "happy" : "vary") + '" title="' + (b.source === "happy" ? "happy path" : "variation") + '"></div>' +
        '<div class="ft-name"><b>' + esc(b.label) + '</b><span class="mono">' + esc(b.key) + '</span></div>' +
        '<div class="ft-tech">' + esc(cfg.tech || "—") + '</div>' +
        '<div class="ft-score"><div class="ft-bar"><i style="width:' + pct + '%"></i></div><span>' + pct + '%</span></div>' +
        '<div class="ft-verdict"><span class="fitchip f-' + fit.mode + '">' + fit.tier + '</span></div></div>';
    }).join("");
    return el("div", "fit-table",
      '<div class="ftrow ft-head"><div class="ft-src"></div><div class="ft-name">Action block</div>' +
      '<div class="ft-tech">Technology</div><div class="ft-score">Fitment</div><div class="ft-verdict">Verdict</div></div>' + rows);
  }

  function happyPanel(happy) {
    var c = C();
    var recorded = (c.happyPath || []).length > 0;
    var flow = happy.map(function (b, i) {
      var cfg = c.blocks[b.key] || {};
      return '<div class="hp-node' + (recorded ? " rec" : "") + '">' +
        '<div class="hp-i">' + (i + 1) + '</div><div class="hp-l">' + esc(b.label) + '</div>' +
        '<div class="hp-t">' + esc(cfg.tech || "") + '</div></div>';
    }).join('<span class="hp-arr">→</span>');
    return el("div", "fit-happy",
      '<div class="fh-top"><div><h3>Happy path · straight-through spine</h3>' +
      '<p class="muted">The no-variation route. Once recorded, this runs touchless in production — agentivised end-to-end.</p></div>' +
      '<button class="btn ' + (recorded ? "ghost" : "go") + ' sm" id="recBtn">' + (recorded ? "✓ Recorded & agentivised" : "● Record happy path") + '</button></div>' +
      '<div class="hp-flow">' + (flow || '<span class="muted">No happy-path blocks in this selection.</span>') + '</div>');
  }

  function tobePanel() {
    var c = C();
    var pats = window.PIQ.selectedPatterns();
    var lanes = pats.map(function (p) {
      var branches = (p.branchingDAG || []).map(function (b) {
        var acts = (b.actions || []).join(" + ");
        return '<div class="tb-branch t-' + (b.tier || "primary") + '">' +
          '<span class="tb-cond mono">' + esc(b.condition) + '</span>' +
          '<span class="tb-act">' + esc(window.PIQ.prettify(acts)) + '</span>' +
          (b.hitl ? '<span class="tb-hitl">🔒 ' + esc(b.hitl) + '</span>' : '') + '</div>';
      }).join("");
      return '<div class="tb-lane"><div class="tb-pat"><span class="pat-prio" style="background:' + PRIO[p.priority] + '"></span>' +
        esc(p.name) + '</div><div class="tb-branches">' + branches + '</div></div>';
    }).join("");
    return el("div", "fit-tobe",
      '<h3>To-be process flow <span class="muted">happy path + pattern-driven variation handling</span></h3>' +
      '<div class="tb-wrap">' + lanes + '</div>');
  }

  function goLiveBar(stp) {
    var live = C().live;
    return el("div", "fit-golive",
      '<div><b>Ready to operate.</b> ' + stp + '% of activity is straight-through; the rest is governed by ' +
      C().patternIds.length + ' patterns with human-in-the-loop gates where judgement is required.</div>' +
      '<button class="btn go" id="goLive">' + (live ? "Open Live Operations →" : "Go live → Run & Govern") + '</button>');
  }

  function wire(root, happy) {
    var rec = root.querySelector("#recBtn");
    if (rec) rec.onclick = function () {
      C().happyPath = happy.map(function (b) { return b.key; });
      render2();
    };
    var gl = root.querySelector("#goLive");
    if (gl) gl.onclick = function () { C().live = true; window.PIQ.go("runtime"); };
  }
  function render2() {
    var view = document.getElementById("view"); view.innerHTML = ""; render(view);
  }

  window.PIQ.modules.fitment = { render: render };
  window.PIQ.onErp(function () { if (window.PIQ.active === "fitment") render2(); });
})();
