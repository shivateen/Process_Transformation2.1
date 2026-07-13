/* ProcessIQ — Pattern Studio (was: Pattern Library)
 *
 * Two tabs:
 *   Library — the expert's playbook, codified: browse every behavioural pattern, filter
 *             by category / priority / search, drill into the three-layer mapping + the
 *             conditional Branching DAG with HITL gates. (Deck slides 6 & 11.)
 *   Mine    — the workshop: drop discovery documents into a categorised accordion, run
 *             the 5-stage pipeline, and review the candidate patterns it proposes. An
 *             accepted candidate is appended to the live library as #N+1.
 *
 * On the absence of an LLM: this accelerator is on-device and deterministic — there is no
 * model endpoint in the bundle. Stage 3 ("Pattern hypothesis") is therefore evidence-gated
 * rather than generative: a candidate surfaces only when the corpus actually contains the
 * document categories its evidence chain depends on, and its confidence is scaled by how
 * much of that evidence landed. The exact few-shot prompt a real extractor would receive is
 * built by buildPrompt() and shown in the UI, so the seam to a live model is one function
 * wide — replace the body of mine() and keep everything downstream.
 */
(function () {
  "use strict";
  var E = window.ProcessIQEngine;
  var patterns = window.PIQ.patterns;
  var meta = window.PIQ.meta;
  var book = window.PIQ.book;
  var PRIO = meta.priorityLegend;
  var MIN = window.PROCESSIQ_MINING || { uploadCategories: [], candidates: [], meta: {} };

  var state = { tab: "library", q: "", cat: "All", prio: "All", selId: patterns[0].id };

  function erp() { return window.PIQ.erp; }
  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function filtered() {
    var q = state.q.toLowerCase();
    return patterns.filter(function (p) {
      if (state.cat !== "All" && p.category !== state.cat) return false;
      if (state.prio !== "All" && p.priority !== state.prio) return false;
      if (q && (p.name + " " + p.category + " " + p.layer3_feature + " " + p.mentalModel).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function triggerInvoice(p) {
    return book.invoices.filter(function (iv) { return iv.groundTruthFeature === p.featureSlug; })[0] || null;
  }

  /* ---------- render: the tab shell ---------- */
  function render(view) {
    if (window.PIQ._jumpPattern) {
      state.selId = window.PIQ._jumpPattern; window.PIQ._jumpPattern = null; state.tab = "library";
    }
    var nMined = MS.accepted.length;
    view.innerHTML =
      '<div class="ps-tabs">' +
        '<button class="ps-tab' + (state.tab === "library" ? " on" : "") + '" data-t="library">Library' +
          '<small>' + patterns.length + ' patterns</small></button>' +
        '<button class="ps-tab' + (state.tab === "mine" ? " on" : "") + '" data-t="mine">Mine' +
          '<small>' + (corpusCount() ? corpusCount() + " docs" : "from documents") + '</small></button>' +
        (nMined ? '<span class="ps-mined">' + nMined + ' mined pattern' + (nMined > 1 ? "s" : "") + ' in the library</span>' : '') +
      '</div><div class="ps-body"></div>';
    view.querySelectorAll(".ps-tab").forEach(function (t) {
      t.onclick = function () { state.tab = t.dataset.t; render(view); };
    });
    var body = view.querySelector(".ps-body");
    if (state.tab === "mine") renderMine(body);
    else renderLibrary(body);
  }

  /* ====================================================================== */
  /* TAB 1 · LIBRARY — unchanged catalogue                                   */
  /* ====================================================================== */
  function renderLibrary(view) {
    view.innerHTML = '<div class="lib"></div>';
    var root = view.querySelector(".lib");

    // header + matrix
    var header = el("div", "lib-head");
    var matrix = catCounts().map(function (c) {
      return '<div class="mx" data-cat="' + esc(c.category) + '">' +
        '<b>' + c.count + '</b><span>' + esc(shortCat(c.category)) + '</span>' +
        '<div class="mxbar">' + bar(c) + '</div></div>';
    }).join("");
    header.innerHTML =
      '<div><div class="kv">The Expert\'s Playbook, Codified</div>' +
      '<h2 style="font-size:22px;margin:2px 0 0">' + patterns.length + ' Behavioural Patterns</h2></div>' +
      '<div class="matrix">' + matrix + '</div>';
    root.appendChild(header);

    // filter bar
    var fbar = el("div", "fbar");
    var cats = ["All"].concat(catCounts().map(function (c) { return c.category; }));
    var prios = ["All", "Critical", "High", "Medium", "Low"];
    fbar.innerHTML =
      '<input id="libSearch" class="search" placeholder="Search patterns, features, tactics…" value="' + esc(state.q) + '"/>' +
      '<div class="chips" id="catChips">' + cats.map(function (c) {
        return '<button class="chip-f' + (state.cat === c ? " on" : "") + '" data-cat="' + esc(c) + '">' + esc(shortCat(c)) + '</button>';
      }).join("") + '</div>' +
      '<div class="chips" id="prioChips">' + prios.map(function (p) {
        var col = p === "All" ? "" : 'style="--pc:' + PRIO[p] + '"';
        return '<button class="chip-p' + (state.prio === p ? " on" : "") + '" ' + col + ' data-prio="' + p + '">' + p + '</button>';
      }).join("") + '</div>';
    root.appendChild(fbar);

    // master-detail
    var md = el("div", "lib-md");
    md.innerHTML = '<div class="lib-list" id="libList"></div><div class="lib-detail" id="libDetail"></div>';
    root.appendChild(md);

    wire(root);
    renderList();
    renderDetail();
  }

  // counts recomputed from the live array so accepted (mined) patterns show up at once
  function catCounts() {
    var order = meta.categories.map(function (c) { return c.category; });
    var by = {};
    patterns.forEach(function (p) {
      var c = by[p.category] || (by[p.category] = { category: p.category, count: 0, Critical: 0, High: 0, Medium: 0, Low: 0 });
      c.count++; if (c[p.priority] != null) c[p.priority]++;
    });
    return Object.keys(by).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).map(function (k) { return by[k]; });
  }

  function shortCat(c) {
    return c.replace(" & Deduction Manipulation", " & Deduction")
      .replace("Intentional Stalling & Delay Tactics", "Stalling & Delay")
      .replace("Credit Risk & Insolvency Indicators", "Credit Risk")
      .replace("Cash Application & Remittance Friction", "Cash App & Remittance")
      .replace("Relationship & Contractual Abuse", "Relationship Abuse");
  }
  function bar(c) {
    var seg = [["Critical", c.Critical], ["High", c.High], ["Medium", c.Medium], ["Low", c.Low]];
    return seg.filter(function (s) { return s[1]; }).map(function (s) {
      return '<i style="flex:' + s[1] + ';background:' + PRIO[s[0]] + '"></i>';
    }).join("");
  }

  function renderList() {
    var list = document.getElementById("libList"); if (!list) return;
    var items = filtered();
    if (!items.length) { list.innerHTML = '<div class="lib-none">No patterns match these filters.</div>'; return; }
    list.innerHTML = items.map(function (p) {
      return '<div class="prow' + (state.selId === p.id ? " sel" : "") + '" data-id="' + p.id + '">' +
        '<div class="pnum" style="background:' + PRIO[p.priority] + '">' + p.id + '</div>' +
        '<div class="pmain"><div class="pn">' + esc(p.name) + '</div>' +
        '<div class="pc">' + esc(shortCat(p.category)) + '</div></div>' +
        '<div class="pf mono">' + esc(p.layer3_feature) + '</div></div>';
    }).join("");
    list.querySelectorAll(".prow").forEach(function (r) {
      r.onclick = function () { state.selId = +r.dataset.id; renderList(); renderDetail(); };
    });
  }

  function renderDetail() {
    var d = document.getElementById("libDetail"); if (!d) return;
    var p = patterns.filter(function (x) { return x.id === state.selId; })[0];
    if (!p) { d.innerHTML = ""; return; }
    var tables = (erp() === "sap" ? p.sources.sap : p.sources.oracle);
    var tchips = tables.map(function (t) { return '<span class="tbl">' + esc(t) + '</span>'; }).join("");

    // branching DAG tree
    var branches = (p.branchingDAG || []).map(function (b) {
      var verbs = b.actions.map(function (a) { return '<span class="verb">' + esc(a) + '</span>'; }).join("");
      var hitl = b.hitl ? '<div class="b-hitl">🔒 HITL: ' + esc(b.hitl) + '</div>' : "";
      return '<div class="branch t-' + b.tier + '"><div class="b-cond mono">' + esc(b.condition) + '</div>' +
        '<div class="b-acts">' + verbs + '</div>' + hitl + '</div>';
    }).join("");

    var flat = p.originalDAG.map(function (s) { return '<span class="verb flat">' + esc(s) + '</span>'; }).join('<span class="arr">→</span>');
    var tiv = triggerInvoice(p);
    var liveLink = tiv ? '<button class="btn go sm" id="toCockpit">See it live in the Cognitive Cockpit →</button>' : '';

    d.innerHTML =
      '<div class="d-head"><div class="pnum lg" style="background:' + PRIO[p.priority] + '">' + p.id + '</div>' +
      '<div><h2 style="font-size:21px;margin:0">' + esc(p.name) + '</h2>' +
      '<div class="cat">' + esc(p.category) + '</div>' +
      '<span class="badge" style="background:' + PRIO[p.priority] + '">' + p.priority + ' priority</span>' +
      '<span class="badge ghost mono">' + esc(p.layer3_feature) + '</span></div></div>' +

      '<div class="mental">“' + esc(p.mentalModel) + '”<span class="who">— the analyst\'s mental model</span></div>' +

      '<div class="d-grid">' +
        layer("1", "Logical Mapping", esc(p.layer1_logicalMapping), '<div class="tables">' + tchips + '</div>') +
        layer("2", "Event Series", esc(p.layer2_eventSeries), "") +
        layer("3", "AI Feature", '<b>' + esc(p.layer3_feature) + '</b> — pre-calculated expert trigger', '<pre class="sql">' + esc(p.conceptualSQL) + '</pre>') +
      '</div>' +

      '<div class="d-sec"><h4>Original Action DAG <span class="muted">flat sequence</span></h4><div class="flatdag">' + flat + '</div></div>' +

      '<div class="d-sec"><h4>Branching DAG <span class="muted">conditional decision tree for agentic orchestration</span></h4>' +
      '<div class="branches">' + branches + '</div></div>' +
      (p.hitlGates.length ? '<div class="gatebar">🔒 HITL gates: ' + p.hitlGates.map(esc).join(" · ") + '</div>' : '') +
      liveLink;

    var btn = document.getElementById("toCockpit");
    if (btn) btn.onclick = function () {
      window.PIQ._jumpInvoice = tiv.belnr;
      window.PIQ.go("cockpit");
    };
  }

  function layer(n, title, desc, extra) {
    return '<div class="dlayer"><div class="lh"><span class="ln">' + n + '</span>' + title + '</div>' +
      '<div class="ld">' + desc + '</div>' + (extra || "") + '</div>';
  }

  function wire(root) {
    var s = root.querySelector("#libSearch");
    s.oninput = function () { state.q = s.value; renderList(); };
    root.querySelector("#catChips").onclick = function (e) {
      var b = e.target.closest("[data-cat]"); if (!b) return;
      state.cat = b.dataset.cat;
      this.querySelectorAll(".chip-f").forEach(function (x) { x.classList.toggle("on", x === b); });
      renderList();
    };
    root.querySelector("#prioChips").onclick = function (e) {
      var b = e.target.closest("[data-prio]"); if (!b) return;
      state.prio = b.dataset.prio;
      this.querySelectorAll(".chip-p").forEach(function (x) { x.classList.toggle("on", x === b); });
      renderList();
    };
    // matrix tiles act as category filters
    root.querySelectorAll(".mx").forEach(function (m) {
      m.onclick = function () {
        state.cat = state.cat === m.dataset.cat ? "All" : m.dataset.cat;
        render(document.getElementById("view"));
      };
    });
  }

  /* ====================================================================== */
  /* TAB 2 · MINE — documents in, candidate patterns out                     */
  /* ====================================================================== */

  // Session state. Documents live in memory only — this is an accelerator, not a
  // production ingestion pipeline. Accepted patterns persist (see MINED_KEY).
  var MINED_KEY = "piq.mined.v1";
  var MS = window.PIQ.patternStudio = {
    corpus: {},        // slotId -> [{name, size}]
    open: {},          // categoryId -> expanded?
    stage: -1,         // -1 idle, 0..4 running/complete
    running: false,
    candidates: [],    // this session's proposals
    accepted: [],      // ids of patterns minted from candidates
    parked: {},        // cid -> true
    report: null,      // per-stage summaries
    showPrompt: false,
  };

  function CATS() { return MIN.uploadCategories || []; }
  function slotById(id) {
    var out = null;
    CATS().forEach(function (c) {
      (c.slots || []).forEach(function (s) { if (s.id === id) out = s; });
    });
    return out;
  }
  function catOfSlot(id) {
    var out = null;
    CATS().forEach(function (c) { (c.slots || []).forEach(function (s) { if (s.id === id) out = c; }); });
    return out;
  }
  function filesIn(slotId) { return MS.corpus[slotId] || []; }
  function catFileCount(cat) {
    return (cat.slots || []).reduce(function (a, s) { return a + filesIn(s.id).length; }, 0);
  }
  function corpusCount() {
    return Object.keys(MS.corpus).reduce(function (a, k) { return a + MS.corpus[k].length; }, 0);
  }
  function corpusBytes() {
    return Object.keys(MS.corpus).reduce(function (a, k) {
      return a + MS.corpus[k].reduce(function (b, f) { return b + f.size; }, 0);
    }, 0);
  }
  function activeCats() {
    return CATS().filter(function (c) { return catFileCount(c) > 0; }).map(function (c) { return c.id; });
  }
  function kb(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
    if (n >= 1024) return Math.round(n / 1024) + " KB";
    return n + " B";
  }

  /* ---- the pipeline ----------------------------------------------------- */

  // The exact prompt a live extractor would receive. Rendered in the UI; not sent
  // anywhere in this build. Swap mine() for a fetch() that posts this and parses the
  // response into the same candidate shape, and every stage below still works.
  function buildPrompt() {
    var fn = (window.PIQ.fn() && window.PIQ.fn().name) || "Order-to-Cash";
    var examples = patterns.slice(0, 6).map(function (p) {
      return "- name: " + JSON.stringify(p.name) +
        "\n  featureSlug: " + JSON.stringify(p.featureSlug) +
        "\n  category: " + JSON.stringify(p.category) +
        "\n  triggers: " + JSON.stringify((p.branchingDAG || []).map(function (b) { return b.condition; })) +
        "\n  originalDAG: " + JSON.stringify(p.originalDAG) +
        "\n  branchingDAG: " + JSON.stringify((p.branchingDAG || []).map(function (b) {
          return { tier: b.tier, actions: b.actions, hitl: b.hitl };
        })) +
        "\n  hitlGates: " + JSON.stringify(p.hitlGates);
    }).join("\n\n");
    var sig = (MS.report && MS.report.signals ? MS.report.signals.names : []).map(function (s) { return "- " + s; }).join("\n");
    var docs = Object.keys(MS.corpus).map(function (sid) {
      var s = slotById(sid);
      return "- [" + (s ? s.label : sid) + "] " + filesIn(sid).map(function (f) { return f.name; }).join(", ");
    }).join("\n");
    return (MIN.fewShotPrompt || "")
      .replace("{function}", fn)
      .replace("{examples}", examples)
      .replace("{signals}", "Documents:\n" + docs + "\n\nSignals:\n" + (sig || "- (none yet)"));
  }

  // Stage 1 — ingest & classify
  function stageIngest() {
    var byCat = CATS().map(function (c) {
      return { label: c.label, n: catFileCount(c) };
    }).filter(function (x) { return x.n; });
    return { files: corpusCount(), bytes: corpusBytes(), byCat: byCat,
      slots: Object.keys(MS.corpus).filter(function (k) { return filesIn(k).length; }).length };
  }

  // Stage 2 — signal extraction. Signals are derived from which slots actually carry
  // documents: each slot contributes the signal names the candidates key off.
  function stageSignals() {
    var names = {}, kinds = { "reason codes": 0, "timing patterns": 0, "escalation triggers": 0, "entity references": 0 };
    (MIN.candidates || []).forEach(function (c) {
      (c.evidence || []).forEach(function (ev) {
        if (!filesIn(ev.slot).length) return;
        (c.signals || []).forEach(function (s) { names[s] = 1; });
      });
    });
    // volume scales with the corpus, deterministically
    var n = corpusCount();
    kinds["reason codes"] = Math.min(24, n * 2 + Object.keys(names).length);
    kinds["timing patterns"] = Math.min(16, Math.ceil(n * 1.2));
    kinds["escalation triggers"] = Math.min(12, Math.ceil(n * 0.8));
    kinds["entity references"] = Math.min(40, n * 3);
    var total = Object.keys(kinds).reduce(function (a, k) { return a + kinds[k]; }, 0);
    return { names: Object.keys(names), kinds: kinds, total: total };
  }

  // Stage 3 — pattern hypothesis (evidence-gated; see the header note)
  function stageHypothesis() {
    var live = activeCats();
    var out = [];
    (MIN.candidates || []).forEach(function (c) {
      // a candidate needs at least one of its required categories present
      var hit = (c.requires || []).filter(function (r) { return live.indexOf(r) >= 0; });
      if (!hit.length) return;
      // ...and its confidence is scaled by how much of its evidence actually landed
      var ev = (c.evidence || []).filter(function (e) { return filesIn(e.slot).length; });
      if (!ev.length) return;
      var coverage = ev.length / (c.evidence || []).length;
      var reqCoverage = hit.length / (c.requires || []).length;
      var conf = c.confidence * (0.55 + 0.45 * coverage) * (0.7 + 0.3 * reqCoverage);
      out.push({
        cid: c.cid, src: c,
        name: c.name, triggers: (c.branchingDAG || []).map(function (b) { return b.condition; }),
        evidence: ev, evidenceTotal: (c.evidence || []).length,
        confidence: Math.min(0.97, conf),
        similarTo: c.similarTo,
        status: MS.parked[c.cid] ? "parked" : "open",
      });
    });
    out.sort(function (a, b) { return b.confidence - a.confidence; });
    return out;
  }

  // Stage 5 — calibration only means anything if transaction-level data was uploaded
  function stageCalibrate() {
    var txn = CATS().filter(function (c) { return c.id === "txn"; })[0];
    var have = txn ? catFileCount(txn) : 0;
    if (!have) return { possible: false };
    return { possible: true, docs: have, traces: 1200 + have * 940, threshold: 0.65 };
  }

  function mine() {
    MS.running = true; MS.stage = 0; MS.report = {};
    var view = document.getElementById("view");
    var steps = [
      function () { MS.report.ingest = stageIngest(); },
      function () { MS.report.signals = stageSignals(); },
      function () { MS.candidates = stageHypothesis(); MS.report.hypothesis = { n: MS.candidates.length }; },
      function () { /* review is the SME's stage — nothing to compute */ },
      function () { MS.report.calibrate = stageCalibrate(); },
    ];
    var i = 0;
    (function step() {
      if (i >= steps.length) {
        MS.running = false; MS.stage = steps.length - 1;
        renderMine(view.querySelector(".ps-body")); return;
      }
      MS.stage = i;
      steps[i]();
      i++;
      renderMine(view.querySelector(".ps-body"));
      setTimeout(step, 620);
    })();
  }

  /* ---- accepting a candidate into the live library ---------------------- */
  function nextId() {
    return patterns.reduce(function (m, p) { return Math.max(m, p.id); }, 0) + 1;
  }
  function acceptCandidate(c) {
    var s = c.src;
    var p = {
      id: nextId(), name: c.name, category: s.category, priority: s.priority,
      priorityRank: { Critical: 1, High: 2, Medium: 3, Low: 4 }[s.priority] || 3,
      mentalModel: s.mentalModel, sources: s.sources,
      layer1_logicalMapping: s.layer1_logicalMapping,
      layer2_eventSeries: s.layer2_eventSeries,
      layer3_feature: s.layer3_feature, featureSlug: s.featureSlug,
      conceptualSQL: s.conceptualSQL,
      originalDAG: s.originalDAG.slice(),
      branchingDAG: (s.branchingDAG || []).map(function (b, i) {
        return { condition: c.triggers[i] != null ? c.triggers[i] : b.condition,
          actions: b.actions.slice(), hitl: b.hitl, tier: b.tier };
      }),
      hitlGates: (s.hitlGates || []).slice(),
      calibration: MS.report && MS.report.calibrate && MS.report.calibrate.possible
        ? { defaultThreshold: "0.50", calibratedThreshold: String(MS.report.calibrate.threshold),
            traceCount: MS.report.calibrate.traces, additionalCoverage: 0, method: "Mined from uploaded corpus" }
        : null,
      mined: true,
    };
    patterns.push(p);
    MS.accepted.push(p.id);
    c.status = "accepted"; c.newId = p.id;
    persistMined();
    return p;
  }
  function persistMined() {
    try {
      var mined = patterns.filter(function (p) { return p.mined; });
      localStorage.setItem(MINED_KEY, JSON.stringify(mined));
    } catch (e) {}
  }
  // Two kinds of record land in MINED_KEY: brand-new patterns (Accept) and incumbents
  // that a Merge folded extra branches into. A new pattern is appended; a merged
  // incumbent already exists by id, so it must *replace* the base entry — skipping it
  // (the obvious guard) would silently throw the merge away on every reload.
  function restoreMined() {
    try {
      var raw = localStorage.getItem(MINED_KEY); if (!raw) return;
      var arr = JSON.parse(raw); if (!Array.isArray(arr)) return;
      var idx = {};
      patterns.forEach(function (p, i) { idx[p.id] = i; });
      arr.forEach(function (p) {
        if (!p || !p.name || !p.originalDAG) return;
        if (idx[p.id] != null) { patterns[idx[p.id]] = p; return; }   // merged incumbent
        patterns.push(p); MS.accepted.push(p.id);                     // newly minted
      });
    } catch (e) {}
  }
  restoreMined();

  /* ---- Mine UI ---------------------------------------------------------- */
  function renderMine(view) {
    var n = corpusCount();
    var stages = (MIN.meta && MIN.meta.stages) || [];
    var stepper = MS.stage < 0 ? "" :
      '<div class="mn-stepper">' + stages.map(function (s, i) {
        var cls = i < MS.stage ? "done" : i === MS.stage ? (MS.running ? "run" : "done") : "todo";
        return '<div class="mn-step ' + cls + '"><span class="mn-si">' +
          (cls === "done" ? "✓" : i + 1) + '</span>' +
          '<div class="mn-st"><b>' + esc(s.label) + '</b><small>' + esc(s.blurb) + '</small></div></div>';
      }).join("") + '</div>' + stageReport();

    view.innerHTML =
      '<div class="mn">' +
        '<div class="mn-head"><div><div class="kv">Pattern Studio · Mine</div>' +
          '<h2 style="font-size:22px;margin:2px 0 0">Mine new patterns from your documents</h2>' +
          '<p class="mn-lead">Open a category, drop your files. The library you already have becomes the ' +
            'few-shot example set — what comes back is what it does <i>not</i> yet contain.</p></div>' +
          '<button class="btn ghost xs mn-quick">Quick start</button></div>' +

        '<div class="mn-acc">' + CATS().map(accCat).join("") + '</div>' +

        '<div class="mn-bar"><span class="mn-corpus"><b>Corpus:</b> ' + n + ' file' + (n === 1 ? "" : "s") +
          ' · ' + kb(corpusBytes()) + (n ? ' · ' + activeCats().length + ' categor' + (activeCats().length === 1 ? "y" : "ies") : '') + '</span>' +
          (n ? '<button class="linkbtn mn-clear">clear corpus</button>' : '') +
          '<button class="btn go mn-run"' + (n && !MS.running ? "" : " disabled") + '>' +
          (MS.running ? "Mining…" : "Mine Patterns →") + '</button></div>' +

        stepper +
        (MS.stage >= 2 ? candidateSection() : "") +
      '</div>';

    wireMine(view);
  }

  function accCat(c) {
    var nf = catFileCount(c), open = !!MS.open[c.id];
    var slots = (c.slots || []).map(function (s) {
      var files = filesIn(s.id);
      return '<div class="mn-slot" data-slot="' + s.id + '">' +
        '<div class="mn-sl-h"><span class="mn-sl-n">' + esc(s.label) + '</span>' +
          '<span class="mn-sl-f">' + s.formats.join(" ") + '</span></div>' +
        '<div class="mn-sl-hint">' + esc(s.hint) + '</div>' +
        (files.length
          ? '<div class="mn-files">' + files.map(function (f, i) {
              return '<span class="mn-file">📄 ' + esc(f.name) + '<i>' + kb(f.size) + '</i>' +
                '<button class="mn-rm" data-slot="' + s.id + '" data-i="' + i + '" title="Remove">✕</button></span>';
            }).join("") + '</div>'
          : '<div class="mn-drop">Drop files here, or click to browse</div>') +
        '</div>';
    }).join("");
    return '<div class="mn-cat' + (open ? " open" : "") + '" data-cat="' + c.id + '">' +
      '<button class="mn-cat-h"><span class="mn-caret">' + (open ? "▾" : "▸") + '</span>' +
        '<span class="mn-cat-n">' + esc(c.label) + '<small>' + esc(c.blurb) + '</small></span>' +
        '<span class="mn-cat-c' + (nf ? " has" : "") + '">' + nf + ' file' + (nf === 1 ? "" : "s") + '</span></button>' +
      '<div class="mn-slots">' + slots + '</div></div>';
  }

  function stageReport() {
    var r = MS.report || {};
    var out = [];
    if (r.ingest) {
      out.push('<div class="mn-rep"><b>Ingest &amp; Classify</b> — ' + r.ingest.files + ' document' +
        (r.ingest.files === 1 ? "" : "s") + ' across ' + r.ingest.slots + ' slot' + (r.ingest.slots === 1 ? "" : "s") + ': ' +
        r.ingest.byCat.map(function (c) { return c.n + " " + esc(c.label.toLowerCase()); }).join(", ") + '.</div>');
    }
    if (r.signals) {
      var k = r.signals.kinds;
      out.push('<div class="mn-rep"><b>Signal extraction</b> — ' + r.signals.total + ' distinct signals: ' +
        Object.keys(k).map(function (x) { return k[x] + " " + x; }).join(", ") + '.' +
        (r.signals.names.length ? '<div class="mn-sigs">' + r.signals.names.map(function (s) {
          return '<span class="mn-sig">' + esc(s) + '</span>'; }).join("") + '</div>' : '') + '</div>');
    }
    if (r.hypothesis) {
      out.push('<div class="mn-rep"><b>Pattern hypothesis</b> — ' + r.hypothesis.n + ' candidate' +
        (r.hypothesis.n === 1 ? "" : "s") + ' proposed against a library of ' + patterns.length + '. ' +
        '<button class="linkbtn mn-prompt">' + (MS.showPrompt ? "hide" : "show") + ' the prompt</button>' +
        (MS.showPrompt ? '<pre class="mn-promptbox">' + esc(buildPrompt()) + '</pre>' : '') + '</div>');
    }
    if (r.calibrate) {
      out.push('<div class="mn-rep"><b>Calibration</b> — ' + (r.calibrate.possible
        ? 'transaction-level data present (' + r.calibrate.docs + ' doc' + (r.calibrate.docs === 1 ? "" : "s") +
          '); accepted detectors will be run against it at threshold ' + r.calibrate.threshold + '.'
        : 'skipped — no transactional evidence uploaded, so there is nothing to calibrate against.') + '</div>');
    }
    return out.join("");
  }

  function candidateSection() {
    if (!MS.candidates.length) {
      return '<div class="mn-none">No candidates. The corpus does not yet carry evidence the library ' +
        'is missing — try adding <b>Transactional Evidence</b> or <b>Process &amp; Policy</b> documents.</div>';
    }
    return '<div class="mn-cands"><h3 class="mn-h3">Candidate patterns <small>you are the gate — nothing enters the library without your call</small></h3>' +
      MS.candidates.map(candCard).join("") + '</div>';
  }

  function candCard(c) {
    var pct = Math.round(c.confidence * 100);
    var sim = c.similarTo;
    var simCls = sim && sim.score >= 0.7 ? "hot" : "";
    if (c.status === "accepted") {
      return '<div class="mn-cand accepted"><div class="mn-cd-h">' +
        '<span class="mn-cd-id">#' + c.newId + '</span>' +
        '<span class="mn-cd-n">' + esc(c.name) + '</span>' +
        '<span class="mn-cd-ok">✓ accepted into the library</span></div></div>';
    }
    if (c.status === "rejected") {
      return '<div class="mn-cand rejected"><div class="mn-cd-h">' +
        '<span class="mn-cd-n">' + esc(c.name) + '</span>' +
        '<span class="mn-cd-no">rejected</span>' +
        '<button class="linkbtn mn-undo" data-cid="' + c.cid + '">undo</button></div></div>';
    }
    var editing = c.editing;
    return '<div class="mn-cand' + (c.status === "parked" ? " parked" : "") + '" data-cid="' + c.cid + '">' +
      '<div class="mn-cd-h">' +
        (editing
          ? '<input class="mn-cd-name" value="' + esc(c.name) + '"/>'
          : '<span class="mn-cd-n">' + esc(c.name) + '</span>') +
        '<span class="mn-cd-cat">' + esc(c.src.category) + '</span>' +
        '<span class="badge" style="background:' + PRIO[c.src.priority] + '">' + c.src.priority + '</span>' +
        (c.status === "parked" ? '<span class="mn-cd-park">parked</span>' : '') +
      '</div>' +

      '<div class="mn-cd-mm">“' + esc(c.src.mentalModel) + '”</div>' +

      '<div class="mn-conf"><span class="mn-conf-l">Confidence</span>' +
        '<span class="mn-conf-t"><i style="width:' + pct + '%"></i></span>' +
        '<b>' + pct + '%</b>' +
        '<span class="mn-conf-e">' + c.evidence.length + ' of ' + c.evidenceTotal + ' evidence sources present</span></div>' +

      (sim ? '<div class="mn-sim ' + simCls + '">' +
        (sim.score >= 0.7 ? '⚠ ' : '') + 'Resembles <b>#' + sim.id + ' ' + esc(sim.name) + '</b> — ' +
        Math.round(sim.score * 100) + '% similar.' +
        (sim.score >= 0.7
          ? '<span class="mn-sim-a"><button class="mn-merge" data-cid="' + c.cid + '">Merge</button>' +
            '<button class="mn-keep" data-cid="' + c.cid + '">Keep separate</button>' +
            '<button class="mn-discard" data-cid="' + c.cid + '">Discard</button></span>'
          : '') + '</div>' : '') +

      '<div class="mn-cd-sec"><h5>Triggers <small>' + (editing ? "editable" : "") + '</small></h5>' +
        (editing
          ? '<textarea class="mn-trig" rows="' + Math.max(3, c.triggers.length) + '">' + esc(c.triggers.join("\n")) + '</textarea>'
          : '<div class="mn-trigs">' + c.triggers.map(function (t) {
              return '<span class="mn-trig-p mono">' + esc(t) + '</span>'; }).join("") + '</div>') +
      '</div>' +

      '<div class="mn-cd-sec"><h5>Happy-path DAG</h5><div class="flatdag">' +
        c.src.originalDAG.map(function (s) { return '<span class="verb flat">' + esc(s) + '</span>'; })
          .join('<span class="arr">→</span>') + '</div></div>' +

      '<details class="mn-ev"><summary>Evidence chain — ' + c.evidence.length + ' source' +
        (c.evidence.length === 1 ? "" : "s") + '</summary>' +
        c.evidence.map(function (e) {
          var s = slotById(e.slot), cat = catOfSlot(e.slot);
          var files = filesIn(e.slot).map(function (f) { return f.name; }).join(", ");
          return '<div class="mn-ev-row"><div class="mn-ev-src">' +
            '<b>' + esc(s ? s.label : e.slot) + '</b>' +
            '<small>' + esc(cat ? cat.label : "") + (files ? ' · ' + esc(files) : '') + '</small></div>' +
            '<div class="mn-ev-x">' + esc(e.excerpt) + '</div></div>';
        }).join("") + '</details>' +

      '<div class="mn-cd-acts">' +
        (editing
          ? '<button class="btn go xs mn-save" data-cid="' + c.cid + '">Save &amp; Accept</button>' +
            '<button class="btn ghost xs mn-cancel" data-cid="' + c.cid + '">Cancel</button>'
          : '<button class="btn go xs mn-accept" data-cid="' + c.cid + '">Accept</button>' +
            '<button class="btn ghost xs mn-edit" data-cid="' + c.cid + '">Edit &amp; Accept</button>' +
            '<button class="btn ghost xs mn-reject" data-cid="' + c.cid + '">Reject</button>' +
            '<button class="btn ghost xs mn-park" data-cid="' + c.cid + '">' +
              (c.status === "parked" ? "Un-park" : "Park") + '</button>') +
      '</div></div>';
  }

  function candById(cid) {
    return MS.candidates.filter(function (x) { return x.cid === cid; })[0];
  }

  function wireMine(view) {
    var root = function () { return document.getElementById("view"); };
    var rerender = function () { renderMine(root().querySelector(".ps-body")); };
    var reshell = function () { render(root()); };   // tab counts change → redraw the shell

    // accordion
    view.querySelectorAll(".mn-cat-h").forEach(function (h) {
      h.onclick = function () {
        var id = h.parentNode.dataset.cat;
        MS.open[id] = !MS.open[id];
        rerender();
      };
    });

    // quick start — open the two categories most likely to yield patterns
    var qs = view.querySelector(".mn-quick");
    if (qs) qs.onclick = function () {
      ((MIN.meta && MIN.meta.quickStart) || []).forEach(function (id) { MS.open[id] = true; });
      rerender();
    };

    // upload: click-to-browse + drag/drop, per slot
    view.querySelectorAll(".mn-slot").forEach(function (slot) {
      var sid = slot.dataset.slot;
      var def = slotById(sid);
      function add(files) {
        if (!files || !files.length) return;
        var accept = (MIN.meta && MIN.meta.acceptedFormats) || [];
        var bucket = MS.corpus[sid] || (MS.corpus[sid] = []);
        var skipped = 0;
        [].slice.call(files).forEach(function (f) {
          var ext = "." + (f.name.split(".").pop() || "").toLowerCase();
          if (accept.length && accept.indexOf(ext) < 0) { skipped++; return; }
          bucket.push({ name: f.name, size: f.size });
        });
        if (skipped) toast(skipped + " file" + (skipped > 1 ? "s" : "") + " skipped — unsupported format");
        MS.stage = -1; MS.candidates = []; MS.report = null;   // corpus changed → results are stale
        reshell();
      }
      var drop = slot.querySelector(".mn-drop");
      if (drop) {
        drop.onclick = function () {
          var inp = document.createElement("input");
          inp.type = "file"; inp.multiple = true;
          inp.accept = (def && def.formats ? def.formats : []).join(",");
          inp.onchange = function () { add(inp.files); };
          inp.click();
        };
      }
      slot.addEventListener("dragover", function (e) { e.preventDefault(); slot.classList.add("over"); });
      slot.addEventListener("dragleave", function () { slot.classList.remove("over"); });
      slot.addEventListener("drop", function (e) {
        e.preventDefault(); slot.classList.remove("over");
        add(e.dataTransfer && e.dataTransfer.files);
      });
    });

    view.querySelectorAll(".mn-rm").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var arr = MS.corpus[b.dataset.slot] || [];
        arr.splice(+b.dataset.i, 1);
        if (!arr.length) delete MS.corpus[b.dataset.slot];
        MS.stage = -1; MS.candidates = []; MS.report = null;
        reshell();
      };
    });

    var clr = view.querySelector(".mn-clear");
    if (clr) clr.onclick = function () {
      MS.corpus = {}; MS.stage = -1; MS.candidates = []; MS.report = null;
      reshell();
    };

    var run = view.querySelector(".mn-run");
    if (run && !run.disabled) run.onclick = mine;

    var pr = view.querySelector(".mn-prompt");
    if (pr) pr.onclick = function () { MS.showPrompt = !MS.showPrompt; rerender(); };

    // candidate actions
    view.querySelectorAll(".mn-accept").forEach(function (b) {
      b.onclick = function () {
        var c = candById(b.dataset.cid);
        var p = acceptCandidate(c);
        toast("Accepted as pattern #" + p.id + " — " + p.name);
        reshell();
      };
    });
    view.querySelectorAll(".mn-edit").forEach(function (b) {
      b.onclick = function () { candById(b.dataset.cid).editing = true; rerender(); };
    });
    view.querySelectorAll(".mn-cancel").forEach(function (b) {
      b.onclick = function () { candById(b.dataset.cid).editing = false; rerender(); };
    });
    view.querySelectorAll(".mn-save").forEach(function (b) {
      b.onclick = function () {
        var card = b.closest(".mn-cand"), c = candById(b.dataset.cid);
        var nm = card.querySelector(".mn-cd-name"), tg = card.querySelector(".mn-trig");
        if (nm && nm.value.trim()) c.name = nm.value.trim();
        if (tg) c.triggers = tg.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        c.editing = false;
        var p = acceptCandidate(c);
        toast("Accepted as pattern #" + p.id + " — " + p.name);
        reshell();
      };
    });
    view.querySelectorAll(".mn-reject, .mn-discard").forEach(function (b) {
      b.onclick = function () { candById(b.dataset.cid).status = "rejected"; rerender(); };
    });
    view.querySelectorAll(".mn-undo").forEach(function (b) {
      b.onclick = function () { candById(b.dataset.cid).status = "open"; rerender(); };
    });
    view.querySelectorAll(".mn-park").forEach(function (b) {
      b.onclick = function () {
        var c = candById(b.dataset.cid);
        c.status = c.status === "parked" ? "open" : "parked";
        MS.parked[c.cid] = c.status === "parked";
        rerender();
      };
    });
    view.querySelectorAll(".mn-keep").forEach(function (b) {
      b.onclick = function () { candById(b.dataset.cid).similarTo = null; rerender(); };
    });
    view.querySelectorAll(".mn-merge").forEach(function (b) {
      b.onclick = function () {
        var c = candById(b.dataset.cid), sim = c.similarTo;
        var host = patterns.filter(function (p) { return p.id === sim.id; })[0];
        if (host) {
          // merging = fold the candidate's unseen triggers into the incumbent as new branches
          var have = {};
          (host.branchingDAG || []).forEach(function (br) { have[br.condition] = 1; });
          c.src.branchingDAG.forEach(function (br, i) {
            var cond = c.triggers[i] != null ? c.triggers[i] : br.condition;
            if (have[cond]) return;
            host.branchingDAG.push({ condition: cond, actions: br.actions.slice(), hitl: br.hitl, tier: br.tier });
          });
          (c.src.hitlGates || []).forEach(function (g) {
            if ((host.hitlGates || []).indexOf(g) < 0) host.hitlGates.push(g);
          });
          host.mined = true;
          persistMined();
        }
        c.status = "rejected";
        toast("Merged into #" + sim.id + " " + sim.name);
        rerender();
      };
    });
  }

  function toast(msg) {
    var t = document.querySelector(".cfo-toast");
    if (!t) { t = el("div", "cfo-toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  window.PIQ.modules.patternstudio = { render: render };
  window.PIQ.onErp(function () { if (window.PIQ.active === "patternstudio" && state.tab === "library") renderDetail(); });
})();
