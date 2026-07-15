/* sandbox-personas.js — the Personas showcase (sandbox sub-view "sbpersonas").
 *
 * The "who" of ProcessIQ: the 11 Order-to-Cash roles, as an explorable gallery.
 *
 * Structure is DERIVED from taxonomy.json — ids, names, process, objectives, KPIs and
 * pattern ids all come from the live taxonomy, so a renamed role or a re-pointed
 * objective cannot leave this view lying. Only the prose (cadence, tab, avatar, the
 * day-in-the-life and the value story) is authored here, keyed by the real role id.
 */
(function () {
  "use strict";
  var PIQ = window.PIQ;

  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  var CCT = ((window.PROCESSIQ_CC || {}).themes) || {};   // A–H, for the theme-affinity map

  /* ---- authored prose, keyed by the REAL taxonomy role id --------------- */
  var PROSE = {
    "o2c-analyst": {
      cadence: "Daily", tab: "Action Queue", avatar: "👤",
      dayInLife: "Starts with the priority queue — ranked by collectibility, not just by aging " +
        "bucket. The 29th-Day Tactic pattern auto-flags customers gaming dispute timing. " +
        "Promise-to-pay capture feeds the cash forecast in real time.",
      value: "Resolves far more accounts per day because the queue is sorted by likelihood-to-collect, " +
        "not alphabetically by aging bucket.",
    },
    "o2c-credit": {
      cadence: "Weekly", tab: "Risk Radar", avatar: "🛡️",
      dayInLife: "Monitors early-warning signals: bureau downgrades, payment-behaviour drift, " +
        "bust-out precursors. Compound signals matter — one customer tripping patterns across " +
        "collections AND credit is flagged before either team notices alone.",
      value: "Catches insolvency signals weeks earlier than traditional credit scoring by reading " +
        "behaviour, not just financial ratios.",
    },
    "o2c-cashapp": {
      cadence: "Daily", tab: "Match Queue", avatar: "💰",
      dayInLife: "Handles the exceptions auto-match could not resolve. Remittance decoupling " +
        "identifies customers who deliberately split payment from advice; unapplied-cash " +
        "weaponization catches those using ambiguous remittances to delay credit.",
      value: "Lifts the auto-match rate by recognising remittance manipulation that rule-based " +
        "matchers miss.",
    },
    "o2c-kam": {
      cadence: "Monthly", tab: "Portfolio View", avatar: "🤝",
      dayInLife: "Reviews strategic accounts for relationship abuse: the customer that always " +
        "“loses” invoices, the one that channels complaints through the sales rep to bypass " +
        "process, the one gaming payment terms quarter by quarter.",
      value: "Surfaces the revenue leakage in the top accounts that nobody talks about because " +
        "“they're a big customer”.",
    },
    "o2c-om": {
      cadence: "Daily", tab: "Order Queue", avatar: "📋",
      dayInLife: "Catches order anomalies before they cascade: PO mismatches, pricing overrides, " +
        "quantity spikes that signal channel stuffing. Each pattern routes the order to the right " +
        "check before it becomes a downstream dispute.",
      value: "Shortens order-to-invoice by catching exceptions at entry, not at billing.",
    },
    "o2c-creditan": {
      cadence: "Daily", tab: "Exposure Dashboard", avatar: "📊",
      dayInLife: "Monitors credit exposure across the portfolio. Behavioural signals — payment " +
        "drift, dispute frequency, bureau changes — feed the credit decision, not just the static " +
        "score from six months ago.",
      value: "Makes credit decisions on behaviour rather than financials alone.",
    },
    "o2c-billspec": {
      cadence: "Daily", tab: "Billing Queue", avatar: "🧾",
      dayInLife: "Ensures invoices are correct before they leave. Pricing discrepancies, tax " +
        "miscalculations, duplicate billing — all caught before the customer receives a wrong " +
        "invoice and raises a dispute.",
      value: "Lifts first-time-right billing, which is the single biggest root cause of disputes.",
    },
    "o2c-disputean": {
      cadence: "Daily", tab: "Dispute Queue", avatar: "⚖️",
      dayInLife: "Works the dispute queue along pattern-specific resolution paths — a pricing " +
        "dispute is not handled like a delivery dispute. The chain routes to the right evidence " +
        "collection and the right approval.",
      value: "Cuts dispute resolution time by routing to pattern-specific paths instead of one " +
        "generic queue.",
    },
    "o2c-cashspec": {
      cadence: "Daily", tab: "Match Queue", avatar: "🏦",
      dayInLife: "Focuses on the hardest matches: partial payments, payments with no remittance, " +
        "payments quoting the wrong invoice number. Pattern matching catches the systematic " +
        "behaviours — always pays rounded amounts, always shorts by freight.",
      value: "Recovers unapplied cash by recognising payment-behaviour patterns at scale.",
    },
    "o2c-deductan": {
      cadence: "Daily", tab: "Deduction Queue", avatar: "🔍",
      dayInLife: "Investigates deductions — valid trade promotion, or invalid short-pay? Pattern " +
        "intelligence separates the legitimate from the systematic gaming, and each type gets its " +
        "own investigation chain.",
      value: "Raises the deduction recovery rate by identifying invalid deduction patterns at scale.",
    },
    "o2c-controller": {
      cadence: "Weekly", tab: "Portfolio Dashboard", avatar: "🎯",
      dayInLife: "The conductor. Sees pattern activity across every persona, watches compound " +
        "signals (collections + credit + cash-app all firing on one customer), steers DSO and " +
        "governs the exceptions that cross process boundaries.",
      value: "Moves DSO through cross-process orchestration that no single-function tool can see.",
    },
  };

  var CHAIN = [
    ["o2c-analyst", "flags #1 The 29th-Day Tactic"],
    ["o2c-credit", "receives the compound signal"],
    ["o2c-controller", "sees the portfolio impact"],
  ];

  var state = { sel: null };

  /* ---- derive the roster from the live taxonomy ------------------------- */
  function roster() {
    var fn = (PIQ.tax.functions || []).filter(function (f) { return f.id === "o2c"; })[0];
    if (!fn) return [];
    var out = [];
    (fn.processes || []).forEach(function (p) {
      (p.roles || []).forEach(function (r) {
        var objs = r.objectives || [];
        var pats = [];
        objs.forEach(function (o) { pats = pats.concat(o.patternIds || []); });
        out.push({
          id: r.id, name: r.name, procId: p.id, process: p.name,
          objectives: objs, patternIds: pats, total: pats.length,
          prose: PROSE[r.id] || { cadence: "Daily", tab: "Queue", avatar: "•", dayInLife: "", value: "" },
        });
      });
    });
    return out;
  }

  function themesOf(p) {
    var hit = {};
    p.patternIds.forEach(function (id) {
      var pat = PIQ.pattern(id);
      (pat && pat.servingThemes || []).forEach(function (t) { hit[t] = (hit[t] || 0) + 1; });
    });
    return Object.keys(hit).sort().map(function (t) {
      return { id: t, name: (CCT[t] || {}).name || t, n: hit[t] };
    });
  }

  /* ---- render ----------------------------------------------------------- */
  function render(view) {
    var list = roster();
    if (!list.length) {
      view.innerHTML = '<div class="sp-wrap"><p class="sp-none">The Order-to-Cash taxonomy is not loaded.</p></div>';
      return;
    }
    if (!state.sel || !list.some(function (p) { return p.id === state.sel; })) state.sel = list[0].id;

    var wrap = el("div", "sp-wrap");
    wrap.innerHTML =
      '<div class="sp-head">' +
        '<div class="kv">The people the accelerator is built for</div>' +
        '<h2>' + list.length + ' Order-to-Cash personas</h2>' +
        '<p class="sp-lead">ProcessIQ does not ask “what process?” first. It asks <b>who is ' +
        'accountable, and what are they trying to achieve?</b> A persona owns objectives; an ' +
        'objective owns patterns; a pattern owns an executable chain.</p>' +
      '</div>' +
      '<div class="sp-strip" id="spStrip"></div>' +
      '<div class="sp-main" id="spMain"></div>' +
      '<div class="sp-chain" id="spChain"></div>';
    view.appendChild(wrap);
    drawStrip(list);
    drawMain(list);
    drawChain();
  }

  function drawStrip(list) {
    var s = document.getElementById("spStrip");
    s.innerHTML = list.map(function (p) {
      return '<button class="sp-card' + (p.id === state.sel ? " on" : "") + '" data-p="' + esc(p.id) + '">' +
        '<span class="sp-av">' + p.prose.avatar + "</span>" +
        '<span class="sp-cn"><b>' + esc(p.name) + "</b><small>" + esc(p.process) + "</small></span>" +
        '<span class="sp-cb">' + p.total + "</span></button>";
    }).join("");
    s.querySelectorAll(".sp-card").forEach(function (b) {
      b.onclick = function () {
        state.sel = b.dataset.p;
        drawStrip(list); drawMain(list);
        if (PIQ.sandbox) PIQ.sandbox.narrate("persona-selected");
      };
    });
  }

  function drawMain(list) {
    var p = list.filter(function (x) { return x.id === state.sel; })[0];
    var m = document.getElementById("spMain");
    var cad = p.prose.cadence.toLowerCase();

    var objs = p.objectives.map(function (o) {
      var pats = (o.patternIds || []).map(function (id) {
        var pat = PIQ.pattern(id);
        if (!pat) return "";
        return '<button class="sp-pat" data-pat="' + id + '">#' + id + " " + esc(pat.name) + "</button>";
      }).join("");
      return '<div class="sp-obj">' +
        '<div class="sp-obj-h"><b>' + esc(o.name) + "</b>" +
          '<span class="sp-obj-n">' + (o.patternCount || (o.patternIds || []).length) + " patterns</span></div>" +
        '<div class="sp-obj-k">KPI · <b>' + esc(o.kpi || "—") + "</b></div>" +
        '<div class="sp-pats">' + pats + "</div></div>";
    }).join("");

    var th = themesOf(p);
    var heat = p.patternIds.slice(0, 24).map(function (id) {
      var pat = PIQ.pattern(id);
      var pr = pat ? String(pat.priority).toLowerCase() : "low";
      return '<i class="pri-' + esc(pr) + '" title="#' + id + " " + esc(pat ? pat.name : "") + '"></i>';
    }).join("");

    m.innerHTML =
      '<div class="sp-l">' +
        '<div class="sp-hero">' +
          '<span class="sp-hero-av">' + p.prose.avatar + "</span>" +
          "<div><h3>" + esc(p.name) + "</h3>" +
          '<div class="sp-hero-m">' + esc(p.process) +
            '<span class="sp-cad ' + esc(cad) + '" title="This persona checks ProcessIQ ' +
            esc(p.prose.cadence.toLowerCase()) + '. Their tab shows ' + esc(p.prose.tab) +
            ' — a cadence-appropriate view, not the full firehose.">' + esc(p.prose.cadence) + "</span>" +
          "</div></div>" +
          '<span class="sp-hero-n"><b>' + p.total + "</b>patterns</span>" +
        "</div>" +
        '<div class="sp-sec"><h5>A day in the life</h5><p>' + esc(p.prose.dayInLife) + "</p></div>" +
        '<div class="sp-value">' + esc(p.prose.value) + "</div>" +
        '<div class="sp-sec"><h5>Objectives <i>each one measured, each one owning its patterns</i></h5>' +
          objs + "</div>" +
      "</div>" +
      '<div class="sp-r">' +
        '<div class="sp-mini">' +
          '<div class="sp-mini-h"><b>' + esc(p.prose.tab) + "</b><span>" + esc(p.prose.cadence) + "</span></div>" +
          '<div class="sp-mini-l">Their Command Centre lens</div>' +
          '<div class="sp-heat">' + heat + "</div>" +
          '<div class="sp-mini-a">' +
            (p.objectives.slice(0, 2).map(function (o) {
              return '<div class="sp-mini-i"><i></i>' + esc(o.name) + "</div>";
            }).join("")) +
          "</div>" +
        "</div>" +
        '<div class="sp-aff"><h5>Themes these patterns move</h5>' +
          (th.length ? th.map(function (t) {
            return '<div class="sp-aff-r"><span class="sp-aff-d t-' + esc(t.id) + '"></span>' +
              '<span class="sp-aff-n">' + esc(t.id) + " · " + esc(t.name) + "</span>" +
              '<span class="sp-aff-c">' + t.n + "</span></div>";
          }).join("") : '<p class="sp-aff-e">These patterns are not yet mapped to a theme.</p>') +
        "</div>" +
      "</div>";

    m.querySelectorAll(".sp-pat").forEach(function (b) {
      b.onclick = function () {
        if (PIQ.sandbox) PIQ.sandbox.showPatternDetail(+b.dataset.pat);
      };
    });
  }

  function drawChain() {
    var c = document.getElementById("spChain");
    var all = roster();
    var steps = CHAIN.map(function (s, i) {
      var p = all.filter(function (x) { return x.id === s[0]; })[0];
      if (!p) return "";
      return (i ? '<span class="sp-ch-arr">→</span>' : "") +
        '<div class="sp-ch-n"><span class="sp-ch-av">' + p.prose.avatar + "</span>" +
        "<b>" + esc(p.name) + "</b><small>" + esc(s[1]) + "</small></div>";
    }).join("");
    c.innerHTML = '<h5>One customer, three personas</h5>' +
      '<div class="sp-ch">' + steps + "</div>" +
      '<p class="sp-ch-f">A pattern does not stop at the persona who saw it first. The same ' +
      'behaviour is a queue item to the analyst, an exposure signal to credit, and a DSO ' +
      'movement to the controller — this is the cross-functional read no single-function tool has.</p>';
  }

  PIQ.modules.sbpersonas = { render: render };
})();
