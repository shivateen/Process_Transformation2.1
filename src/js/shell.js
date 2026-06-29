/* ProcessIQ — Platform Shell
 * Owns shared state (window.PIQ), the top-nav module router, and the global ERP
 * toggle. Each of the deck's six acts registers itself as a module; the shell
 * renders the active one into #view. Live modules render; stubs show a roadmap card. */
(function () {
  "use strict";

  window.PIQ = {
    erp: "sap",
    patterns: window.PROCESSIQ_PATTERNS.patterns,
    meta: window.PROCESSIQ_PATTERNS.meta,
    book: window.PROCESSIQ_PORTFOLIO,
    E: window.ProcessIQEngine,
    modules: {},     // registered by each module file
    active: null,
    _erpListeners: [],
  };

  // Module order mirrors the deck's six acts.
  var ORDER = [
    { id: "provocation", label: "The Provocation" },
    { id: "library", label: "Pattern Library" },
    { id: "cockpit", label: "Cognitive Cockpit" },
    { id: "governance", label: "Action & Governance" },
    { id: "discovery", label: "Discovery Engine" },
    { id: "roi", label: "ROI & Attribution" },
  ];

  PIQ.onErp = function (fn) { PIQ._erpListeners.push(fn); };

  function renderNav() {
    var nav = document.getElementById("modnav");
    nav.innerHTML = "";
    ORDER.forEach(function (m) {
      var b = document.createElement("button");
      b.className = "modtab" + (PIQ.active === m.id ? " on" : "") + (m.stub ? " stub" : "");
      b.textContent = m.label;
      b.onclick = function () { go(m.id); };
      nav.appendChild(b);
    });
  }

  function go(id) {
    PIQ.active = id;
    renderNav();
    var view = document.getElementById("view");
    view.innerHTML = "";
    var entry = ORDER.filter(function (m) { return m.id === id; })[0];
    var mod = PIQ.modules[id];
    if (mod && mod.render) {
      mod.render(view);
    } else {
      view.appendChild(stubCard(entry));
    }
  }

  function stubCard(entry) {
    var idx = ORDER.map(function (m) { return m.id; }).indexOf(entry.id) + 1;
    var ROADMAP = {
      provocation: "Scrollytelling intro — the Efficiency→Efficacy story, the $12M write-off no amount of speed fixes, and the fresher-vs-expert outcome split (deck slides 2–4).",
      governance: "The three trust modes — Assisted → Policy-Approved → Autonomous — plus the Saga / idempotency / system-of-record governance model (deck slides 13–14).",
      discovery: "The math → text → LLM pipeline (Isolation Forests + vector embeddings + LLM narrative) that surfaces Candidate Pattern #32 for SME approval (deck slides 16–17).",
      roi: "KPI deltas (DSO, CEI, auto-match…) and the business-outcome waterfall — every dollar traced to a pattern, a decision, and an action (deck slides 19–20).",
    };
    var d = document.createElement("div");
    d.className = "modstub";
    d.innerHTML =
      '<div class="modstub-card">' +
      '<div class="ph">Module ' + idx + ' of 6 · roadmap</div>' +
      '<h2>' + entry.label + '</h2>' +
      '<p>' + (ROADMAP[entry.id] || "") + '</p>' +
      '<div class="modstub-cta">Live now: ' +
      '<a href="#" data-go="cockpit">Cognitive Cockpit</a> · ' +
      '<a href="#" data-go="library">Pattern Library</a></div>' +
      '</div>';
    d.querySelectorAll("[data-go]").forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); go(a.dataset.go); };
    });
    return d;
  }

  /* global ERP toggle */
  document.getElementById("erpToggle").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    PIQ.erp = b.dataset.erp;
    this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
    PIQ._erpListeners.forEach(function (fn) { try { fn(PIQ.erp); } catch (e) {} });
  });

  /* boot */
  document.getElementById("varStat").textContent = PIQ.E._money(PIQ.book.meta.valueAtRisk);
  document.getElementById("dateStat").textContent = PIQ.book.meta.asOfDate;

  // modules self-register on load; open on The Provocation (the narrative front door).
  PIQ.boot = function () { go("provocation"); };
})();
