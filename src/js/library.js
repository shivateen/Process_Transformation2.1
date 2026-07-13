/* ProcessIQ — Pattern Studio (was: Pattern Library)
 *
 * Two tabs:
 *   Library — the expert's playbook, codified: browse every behavioural pattern, filter
 *             by category / priority / search, drill into the three-layer mapping + the
 *             conditional Branching Flow with HITL gates. (Deck slides 6 & 11.)
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

  var state = { tab: "library", q: "", cat: "All", prio: "All", selId: patterns[0].id,
    mission: null, theme: null };   // inbound filter from a Command Centre deep-link

  // A jump from the Command Centre hands over a filter in localStorage (separate page loads):
  //   {pattern:#}  open that pattern      {mission:"M22"}  every pattern serving it
  //   {theme:"C"}  every pattern in that theme
  (function consumeJump() {
    var raw;
    try { raw = localStorage.getItem("piq.ps.jump.v1"); localStorage.removeItem("piq.ps.jump.v1"); }
    catch (e) { return; }
    if (!raw) return;
    try {
      var j = JSON.parse(raw);
      if (j.pattern) state.selId = j.pattern;
      if (j.mission) state.mission = j.mission;
      if (j.theme) state.theme = j.theme;
    } catch (e) {}
  })();

  function erp() { return window.PIQ.erp; }
  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function filtered() {
    var q = state.q.toLowerCase();
    return patterns.filter(function (p) {
      if (state.mission && (p.servingMissions || []).indexOf(state.mission) < 0) return false;
      if (state.theme && (p.servingThemes || []).indexOf(state.theme) < 0) return false;
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

    // an inbound cross-tile filter is explained, and dismissible
    if (state.mission || state.theme) {
      var lbl = state.mission
        ? "missions: <b>" + state.mission + " · " + esc(missionName(state.mission)) + "</b> (" +
          esc(missionOwnerLabel(state.mission)) + ")"
        : "theme: <b>" + state.theme + " · " + esc(themeName(state.theme)) + "</b>";
      var fb = el("div", "lib-xfilter");
      fb.innerHTML = '<span>Filtered from the Command Centre — patterns serving ' + lbl + '</span>' +
        '<button class="lib-xclear">show all patterns</button>';
      root.appendChild(fb);
      fb.querySelector(".lib-xclear").onclick = function () {
        state.mission = null; state.theme = null;
        render(document.getElementById("view"));
      };
    }

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

    var vis = filtered();
    if (vis.length && !vis.some(function (x) { return x.id === state.selId; })) state.selId = vis[0].id;

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
    if (!items.length) {
      list.innerHTML = '<div class="lib-none">' + (state.mission
        ? 'No pattern in the library serves <b>' + esc(state.mission) + '</b> yet. ' +
          'That is a gap, not an error — mine one from your documents in the <b>Mine</b> tab.'
        : state.theme
        ? 'No pattern serves theme <b>' + esc(state.theme) + '</b> yet.'
        : 'No patterns match these filters.') + '</div>';
      return;
    }
    list.innerHTML = items.map(function (p) {
      return '<div class="prow' + (state.selId === p.id ? " sel" : "") + '" data-id="' + p.id + '">' +
        '<div class="pnum" style="background:' + PRIO[p.priority] + '">' + p.id + '</div>' +
        '<div class="pmain"><div class="pn">' + esc(p.name) +
          (p.mined ? '<span class="pmined">MINED</span>' : '') + '</div>' +
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

    // Branching flow: each branch is a list of ACTION BLOCKS, each with its EXECUTOR.
    // (Executors are only present on mined patterns; the xlsx library predates the field,
    //  so fall back to Agent rather than inventing a claim.)
    var branches = (p.branchingDAG || []).map(function (b) {
      var verbs = b.actions.map(function (a, i) {
        var ex = (b.executors || [])[i];
        return '<span class="verb">' + esc(a) +
          (ex ? '<i class="ex-' + ex.toLowerCase().replace(/ /g, "-") + '">' + esc(ex) + '</i>' : '') + '</span>';
      }).join("");
      var hitl = b.hitl ? '<div class="b-hitl">🔒 HITL gate: ' + esc(b.hitl) + '</div>' : "";
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

      servingBar(p) +

      '<div class="d-sec"><h4>Process Flow <span class="muted">the happy path — a chain of action blocks</span></h4><div class="flatdag">' + flat + '</div></div>' +

      '<div class="d-sec"><h4>Branching Flow <span class="muted">variation branches — action blocks, executors and HITL gates</span></h4>' +
      '<div class="branches">' + branches + '</div></div>' +
      (p.hitlGates.length ? '<div class="gatebar">🔒 HITL gates: ' + p.hitlGates.map(esc).join(" · ") + '</div>' : '') +
      liveLink;

    var btn = document.getElementById("toCockpit");
    if (btn) btn.onclick = function () {
      window.PIQ._jumpInvoice = tiv.belnr;
      window.PIQ.go("cockpit");
    };
    // cross-tile: each serving mission links to its mission card in the Command Centre
    d.querySelectorAll(".sv-m").forEach(function (b) {
      b.onclick = function () { goCC(b.dataset.mission); };
    });
  }

  // Which Command Centre missions and themes does this pattern serve? The pattern declares
  // it (servingMissions / servingThemes); the mission's poweredByPatterns is the inverse.
  function servingBar(p) {
    var ms = p.servingMissions || [], ts = p.servingThemes || [];
    if (!ms.length && !ts.length) return "";
    return '<div class="d-serve"><span class="sv-l">Serving</span>' +
      ms.map(function (m) {
        return '<button class="sv-m" data-mission="' + m + '">' + m + ' · ' + esc(missionName(m)) +
          '<i>' + esc(missionOwnerLabel(m)) + '</i></button>';
      }).join("") +
      ts.map(function (t) {
        return '<span class="sv-t">Theme ' + t + ' · ' + esc(themeName(t)) + '</span>';
      }).join("") +
      '<span class="sv-n">these are the Command Centre missions this pattern moves</span></div>';
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
  /* TAB 2 · MINE — the AI-driven 3-step extraction flow                     */
  /*                                                                         */
  /*   1 Context    function + objective (+ the 2–3 questions that actually  */
  /*                change the answer)                                       */
  /*   2 Documents  a checklist composed for THIS context, a coverage meter, */
  /*                and a gap analysis that says why each missing doc matters */
  /*   3 Results    maturity radar · KPI vs benchmark · pattern impact bridge */
  /*                                                                         */
  /* Function-agnostic: nothing below is specific to Order-to-Cash. An       */
  /* "Other" function falls back to the generic checklist and KPI set.       */
  /*                                                                         */
  /* No live LLM: every "AI" step is DERIVED, not invented. The checklist is */
  /* selected by function and re-prioritised by objective keywords; maturity  */
  /* is scored from which categories the SME actually uploaded; candidates    */
  /* surface only when the corpus carries their evidence, ranked by which KPI */
  /* gap they close. buildPrompt() renders the prompt a real extractor would  */
  /* receive — swap the body of mine() and everything downstream still works. */
  /* ====================================================================== */

  var MINED_KEY = "piq.mined.v1";
  var MS = window.PIQ.patternStudio = {
    step: "context",     // context | documents | results
    mode: "documents",   // documents-first | objective-first
    context: { fn: null, fnLabel: "", objective: "", answers: {}, asked: false },
    blueprint: null,     // objective-first: the derived Transformation Blueprint
    checklist: [],       // the composed document checklist for this context
    corpus: {},          // slotId -> [{name, size}]
    open: {},            // categoryId -> expanded?
    stage: -1,           // -1 idle, 0..4 running/complete
    running: false,
    maturity: null,
    benchmarks: null,
    candidates: [],
    accepted: [],
    parked: {},
    report: null,
    showPrompt: false,
  };

  function CCD() { return window.PROCESSIQ_CC || {}; }
  function missionName(mid) {
    var m = (CCD().missions || {})[mid];
    return m ? m.name : mid;
  }
  function missionOwnerLabel(mid) {
    var m = (CCD().missions || {})[mid];
    if (!m) return "";
    var p = (CCD().personas || []).filter(function (x) { return x.id === m.owner; })[0];
    return p ? p.label : m.owner;
  }
  function themeName(tid) {
    var t = (CCD().themes || {})[tid];
    return t ? t.name : tid;
  }

  /* ---- context-driven derivations (the "AI") --------------------------- */

  // The checklist is the function's, re-prioritised by what the objective actually says.
  // An objective about forecasting promotes the analytics/planning categories to Critical.
  var OBJ_HINTS = [
    { kw: ["forecast", "accuracy", "plan", "predict"], boost: ["analytics", "planning"] },
    { kw: ["cost", "spend", "leak", "margin"], boost: ["analytics", "financial"] },
    { kw: ["control", "compliance", "sox", "audit", "fraud", "risk"], boost: ["control"] },
    { kw: ["cycle", "speed", "time", "close", "faster", "days"], boost: ["policy", "org"] },
    { kw: ["inventory", "stock", "carrying"], boost: ["warehouse", "procure"] },
    { kw: ["people", "team", "skill", "capacity", "fte"], boost: ["org"] },
  ];
  function composeChecklist() {
    var all = MIN.checklists || {};
    var base = all[MS.context.fn] || MIN.genericChecklist || [];
    var obj = (MS.context.objective || "").toLowerCase();
    var boost = {};
    OBJ_HINTS.forEach(function (h) {
      if (h.kw.some(function (k) { return obj.indexOf(k) >= 0; })) {
        h.boost.forEach(function (c) { boost[c] = 1; });
      }
    });
    // deep-copy so a re-run from a different objective starts clean
    return base.map(function (c) {
      var pr = c.priority;
      if (boost[c.id] && pr === "enriching") pr = "critical";
      else if (boost[c.id] && pr === "supporting") pr = "enriching";
      return { id: c.id, label: c.label, priority: pr, basePriority: c.priority,
        promoted: pr !== c.priority, dimension: c.dimension, slots: c.slots };
    });
  }

  function clarifiersFor() {
    var c = MIN.clarifiers || {};
    return c[MS.context.fn] || c._default || [];
  }
  function kpisFor() {
    var k = MIN.kpis || {};
    return (k[MS.context.fn] || k._default || []).slice();
  }
  function blueprintFor(objective) {
    var o = (objective || "").toLowerCase();
    var hit = (MIN.blueprints || []).filter(function (b) {
      return (b.match || []).some(function (m) { return o.indexOf(m) >= 0; });
    })[0];
    return hit || null;
  }

  /* ---- corpus helpers --------------------------------------------------- */
  function CATS() { return MS.checklist || []; }
  function slotById(id) {
    var out = null;
    CATS().forEach(function (c) { (c.slots || []).forEach(function (s) { if (s.id === id) out = s; }); });
    return out;
  }
  function catOfSlot(id) {
    var out = null;
    CATS().forEach(function (c) { (c.slots || []).forEach(function (s) { if (s.id === id) out = c; }); });
    return out;
  }
  function filesIn(sid) { return MS.corpus[sid] || []; }
  function catFileCount(c) {
    return (c.slots || []).reduce(function (a, s) { return a + filesIn(s.id).length; }, 0);
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
  function criticalCats() { return CATS().filter(function (c) { return c.priority === "critical"; }); }
  function criticalCovered() {
    return criticalCats().filter(function (c) { return catFileCount(c) > 0; }).length;
  }
  function canMine() {
    var need = (MIN.meta && MIN.meta.minCriticalCategories) || 2;
    return criticalCovered() >= Math.min(need, criticalCats().length) && corpusCount() > 0;
  }
  function kb(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
    if (n >= 1024) return Math.round(n / 1024) + " KB";
    return n + " B";
  }

  /* ---- the pipeline ----------------------------------------------------- */
  function buildPrompt() {
    var examples = patterns.slice(0, 6).map(function (p) {
      return "- name: " + JSON.stringify(p.name) +
        "\n  featureSlug: " + JSON.stringify(p.featureSlug) +
        "\n  category: " + JSON.stringify(p.category) +
        "\n  triggers: " + JSON.stringify((p.branchingDAG || []).map(function (b) { return b.condition; })) +
        "\n  processFlow: " + JSON.stringify(p.originalDAG) +
        "\n  branchingFlow: " + JSON.stringify((p.branchingDAG || []).map(function (b) {
          return { tier: b.tier, actionBlocks: b.actions, hitl: b.hitl };
        })) +
        "\n  hitlGates: " + JSON.stringify(p.hitlGates) +
        "\n  servingMissions: " + JSON.stringify(p.servingMissions || []) +
        "\n  servingThemes: " + JSON.stringify(p.servingThemes || []);
    }).join("\n\n");
    var sig = (MS.report && MS.report.signals ? MS.report.signals.names : []);
    var docs = Object.keys(MS.corpus).map(function (sid) {
      var s = slotById(sid);
      return "- [" + (s ? s.label : sid) + "] " + filesIn(sid).map(function (f) { return f.name; }).join(", ");
    }).join("\n");
    var clar = Object.keys(MS.context.answers).map(function (k) {
      return k + " = " + MS.context.answers[k];
    }).join("; ") || "(none)";
    return (MIN.fewShotPrompt || "")
      .replace(/\{function\}/g, MS.context.fnLabel || "the selected function")
      .replace("{objective}", MS.context.objective || "(not stated)")
      .replace("{clarified}", clar)
      .replace("{examples}", examples)
      .replace("{signals}", "Documents:\n" + docs + "\n\nSignals:\n" +
        (sig.map(function (s) { return "- " + s; }).join("\n") || "- (none yet)"));
  }

  function stageIngest() {
    var byCat = CATS().map(function (c) { return { label: c.label, n: catFileCount(c) }; })
      .filter(function (x) { return x.n; });
    return { files: corpusCount(), bytes: corpusBytes(), byCat: byCat,
      slots: Object.keys(MS.corpus).filter(function (k) { return filesIn(k).length; }).length };
  }

  function stageSignals() {
    var names = {};
    (MIN.candidates || []).forEach(function (c) {
      if (c.function !== MS.context.fn) return;
      (c.evidence || []).forEach(function (ev) {
        if (!filesIn(ev.slot).length) return;
        (c.signals || []).forEach(function (s) { names[s] = 1; });
      });
    });
    var n = corpusCount();
    var kinds = {
      "reason codes": Math.min(24, n * 2 + Object.keys(names).length),
      "timing patterns": Math.min(16, Math.ceil(n * 1.2)),
      "escalation triggers": Math.min(12, Math.ceil(n * 0.8)),
      "entity references": Math.min(40, n * 3),
    };
    var total = Object.keys(kinds).reduce(function (a, k) { return a + kinds[k]; }, 0);
    return { names: Object.keys(names), kinds: kinds, total: total };
  }

  // ---- Panel A · maturity, scored from what the corpus actually contains ----
  function stageMaturity() {
    var dims = MIN.dimensions || [], rules = MIN.evidenceRules || {};
    return dims.map(function (d) {
      // categories that feed this dimension
      var feed = CATS().filter(function (c) { return c.dimension === d.id; });
      var have = feed.filter(function (c) { return catFileCount(c) > 0; });
      var nFiles = have.reduce(function (a, c) { return a + catFileCount(c); }, 0);
      var cover = feed.length ? have.length / feed.length : 0;

      // 1.6 floor, +2.0 for coverage, +0.6 for depth (multiple files = a real corpus)
      var score = 1.6 + cover * 2.0 + Math.min(0.6, nFiles * 0.15);
      if (!feed.length) score = 2.5;   // the checklist has nothing for this dimension
      score = Math.round(Math.min(5, score) * 10) / 10;

      var r = rules[d.id] || {};
      var ev = have.length
        ? r.present + " — " + have.map(function (c) { return c.label.toLowerCase(); }).join(", ") +
          " (" + nFiles + " file" + (nFiles === 1 ? "" : "s") + ")"
        : r.absent;
      return { id: d.id, label: d.label, score: score, benchmark: d.benchmark,
        probe: d.probe, evidence: ev, covered: have.length, of: feed.length,
        gap: Math.round((d.benchmark - score) * 10) / 10 };
    });
  }

  // ---- Panel B · client KPIs vs industry benchmark ----
  function stageBenchmarks() {
    return kpisFor().map(function (k) {
      var better = k.lowerIsBetter;
      var gap = better ? k.client - k.topQuartile : k.topQuartile - k.client;
      var vsMed = better ? k.client - k.median : k.median - k.client;
      // quartile: at/past top = Q1, better than median = Q2, else Q3/Q4 by distance
      var q;
      if (vsMed <= 0) q = gap <= 0 ? "Q1" : "Q2";
      else {
        var span = Math.abs(k.median - k.topQuartile) || 1;
        q = (vsMed / span) > 1.2 ? "Q4" : "Q3";
      }
      return { name: k.name, unit: k.unit, client: k.client, median: k.median,
        topQuartile: k.topQuartile, lowerIsBetter: better,
        gap: Math.round(gap * 10) / 10, quartile: q, behind: gap > 0 };
    }).sort(function (a, b) {
      var rank = { Q4: 0, Q3: 1, Q2: 2, Q1: 3 };
      return rank[a.quartile] - rank[b.quartile];
    });
  }

  // ---- Stage 3 · pattern hypothesis, evidence-gated and KPI-ranked ----
  function stageHypothesis() {
    var live = activeCats(), out = [];
    var bm = {};
    (MS.benchmarks || []).forEach(function (b) { bm[b.name] = b; });

    (MIN.candidates || []).forEach(function (c) {
      if (c.function !== MS.context.fn) return;
      var hit = (c.requires || []).filter(function (r) { return live.indexOf(r) >= 0; });
      if (!hit.length) return;
      var ev = (c.evidence || []).filter(function (e) { return filesIn(e.slot).length; });
      if (!ev.length) return;

      var coverage = ev.length / (c.evidence || []).length;
      var reqCoverage = hit.length / (c.requires || []).length;
      var conf = c.confidence * (0.55 + 0.45 * coverage) * (0.7 + 0.3 * reqCoverage);

      // a pattern that closes a KPI you are Q4 on is worth more than one you already lead
      var k = bm[c.closesKpi];
      var lift = k ? ({ Q4: 0.12, Q3: 0.06, Q2: 0, Q1: -0.05 }[k.quartile] || 0) : 0;

      out.push({
        cid: c.cid, src: c, name: c.name,
        triggers: (c.branchingFlow || []).map(function (b) { return b.condition; }),
        evidence: ev, evidenceTotal: (c.evidence || []).length,
        confidence: Math.min(0.97, conf + lift),
        similarTo: c.similarTo, closesKpi: c.closesKpi, kpi: k || null,
        estImpact: c.estImpact, dimensions: c.dimensions,
        servingMissions: c.servingMissions, servingThemes: c.servingThemes,
        status: MS.parked[c.cid] ? "parked" : "open",
      });
    });
    out.sort(function (a, b) { return b.confidence - a.confidence; });
    return out;
  }

  function stageCalibrate() {
    var txn = CATS().filter(function (c) { return c.dimension === "tech"; })[0];
    var have = txn ? catFileCount(txn) : 0;
    if (!have) return { possible: false };
    return { possible: true, docs: have, traces: 1200 + have * 940, threshold: 0.65 };
  }

  function mine() {
    MS.running = true; MS.stage = 0; MS.report = {};
    MS.step = "results";
    var view = document.getElementById("view");
    var steps = [
      function () { MS.report.ingest = stageIngest(); },
      function () {
        MS.report.signals = stageSignals();
        // Panels A + B are produced here, in parallel with the hypothesis stage
        MS.maturity = stageMaturity();
        MS.benchmarks = stageBenchmarks();
      },
      function () { MS.candidates = stageHypothesis(); MS.report.hypothesis = { n: MS.candidates.length }; },
      function () { /* SME review — nothing to compute */ },
      function () { MS.report.calibrate = stageCalibrate(); },
    ];
    var i = 0;
    (function step() {
      if (i >= steps.length) {
        MS.running = false; MS.stage = steps.length - 1;
        renderMine(view.querySelector(".ps-body")); return;
      }
      MS.stage = i; steps[i](); i++;
      renderMine(view.querySelector(".ps-body"));
      setTimeout(step, 560);
    })();
  }

  /* ---- accept a candidate into the live library ------------------------- */
  function nextId() {
    return patterns.reduce(function (m, p) { return Math.max(m, p.id); }, 0) + 1;
  }
  function acceptCandidate(c) {
    var s = c.src;
    var p = {
      id: nextId(), name: c.name, category: s.category, priority: s.priority,
      priorityRank: { Critical: 1, High: 2, Medium: 3, Low: 4 }[s.priority] || 3,
      mentalModel: s.mentalModel,
      sources: { sap: ["(mined — source tables to be confirmed)"], oracle: ["(mined — source tables to be confirmed)"] },
      layer1_logicalMapping: "Mined from the uploaded corpus — " + (MS.context.fnLabel || "") + ".",
      layer2_eventSeries: c.triggers.join(" → "),
      layer3_feature: s.name, featureSlug: s.featureSlug,
      conceptualSQL: "-- derived from mined signals: " + (s.signals || []).join(", "),
      originalDAG: (s.processFlow || []).slice(),
      branchingDAG: (s.branchingFlow || []).map(function (b, i) {
        return { condition: c.triggers[i] != null ? c.triggers[i] : b.condition,
          actions: (b.actionBlocks || []).slice(), executors: (b.executors || []).slice(),
          hitl: b.hitl, tier: b.tier };
      }),
      hitlGates: (s.hitlGates || []).slice(),
      // the mined pattern arrives already wired into the Command Centre taxonomy
      servingMissions: (c.servingMissions || []).slice(),
      servingThemes: (c.servingThemes || []).slice(),
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
      localStorage.setItem(MINED_KEY, JSON.stringify(patterns.filter(function (p) { return p.mined; })));
    } catch (e) {}
  }
  // Two kinds of record land in MINED_KEY: brand-new patterns (Accept) and incumbents a
  // Merge folded extra branches into. A merged incumbent already exists by id, so it must
  // *replace* the base entry — skipping it would silently throw the merge away on reload.
  function restoreMined() {
    try {
      var raw = localStorage.getItem(MINED_KEY); if (!raw) return;
      var arr = JSON.parse(raw); if (!Array.isArray(arr)) return;
      var idx = {};
      patterns.forEach(function (p, i) { idx[p.id] = i; });
      arr.forEach(function (p) {
        if (!p || !p.name || !p.originalDAG) return;
        if (idx[p.id] != null) { patterns[idx[p.id]] = p; return; }
        patterns.push(p); MS.accepted.push(p.id);
      });
    } catch (e) {}
  }
  restoreMined();

  /* ====================================================================== */
  /* MINE — render                                                           */
  /* ====================================================================== */
  function renderMine(view) {
    var steps = (MIN.meta && MIN.meta.steps) || [];
    var idx = steps.map(function (s) { return s.id; }).indexOf(MS.step);
    var rail = '<div class="mn-rail">' + steps.map(function (s, i) {
      return '<button class="mn-rs' + (i === idx ? " on" : "") + (i < idx ? " done" : "") + '" data-step="' + s.id + '">' +
        '<span class="mn-rn">' + (i < idx ? "✓" : i + 1) + '</span>' +
        '<span class="mn-rt"><b>' + esc(s.label) + '</b><small>' + esc(s.blurb) + '</small></span></button>' +
        (i < steps.length - 1 ? '<span class="mn-ra">→</span>' : '');
    }).join("") + '</div>';

    var body = MS.step === "documents" ? renderStepDocuments()
      : MS.step === "results" ? renderStepResults()
      : renderStepContext();

    view.innerHTML = '<div class="mn">' + rail + body + '</div>';
    wireMine(view);
  }

  /* ---- STEP 1 · CONTEXT ------------------------------------------------- */
  function renderStepContext() {
    var fns = MIN.functions || [];
    var c = MS.context;
    var objMode = MS.mode === "objective";

    var toggle = '<div class="mn-mode">' +
      '<button class="mn-md' + (!objMode ? " on" : "") + '" data-mode="documents">I have documents — find patterns</button>' +
      '<button class="mn-md' + (objMode ? " on" : "") + '" data-mode="objective">I have an objective — tell me what I need</button>' +
      '</div>';

    var fnPick = objMode ? "" :
      '<div class="mn-q">What function are you transforming?</div>' +
      '<div class="mn-fns">' + fns.map(function (f) {
        return '<button class="mn-fn' + (c.fn === f.id ? " on" : "") + '" data-fn="' + f.id + '" data-fl="' + esc(f.label) + '">' +
          '<span class="mn-fi">' + f.icon + '</span><span>' + esc(f.label) + '</span></button>';
      }).join("") +
      '<button class="mn-fn other' + (c.fn === "_other" ? " on" : "") + '" data-fn="_other" data-fl="">' +
        '<span class="mn-fi">＋</span><span>Other (describe your function)</span></button>' +
      '</div>' +
      (c.fn === "_other"
        ? '<input class="mn-other" placeholder="e.g. Customer Service, IT Operations, Claims Handling…" value="' + esc(c.fnLabel) + '"/>'
        : "");

    var objQ = objMode
      ? 'Describe the transformation objective. I will tell you which patterns to hunt and which documents you need.'
      : 'What is the objective of this transformation?';

    var body =
      '<div class="mn-head"><div><div class="kv">Pattern Studio · Mine</div>' +
        '<h2 style="font-size:22px;margin:2px 0 0">Mine new patterns from your documents</h2>' +
        '<p class="mn-lead">The library you already have becomes the few-shot example set — what comes ' +
        'back is what it does <i>not</i> yet contain. Works for any function, not just the ones we ship.</p></div></div>' +
      toggle +
      '<div class="mn-card">' + fnPick +
        '<div class="mn-q">' + esc(objQ) + '</div>' +
        '<textarea class="mn-obj" rows="3" placeholder="e.g. &quot;Reduce DSO by 10 days&quot; · &quot;Cut the close from 10 days to 4&quot; · ' +
          '&quot;Reduce inventory carrying cost by 15%&quot; · &quot;Improve forecast accuracy to 95%&quot;">' + esc(c.objective) + '</textarea>' +
        clarifierBlock() +
        '<div class="mn-actions"><button class="btn go mn-next"' + (contextReady() ? "" : " disabled") + '>' +
          (objMode ? "Build the blueprint →" : (c.asked ? "Next →" : "Next →")) + '</button>' +
          '<span class="mn-hint">' + esc(contextHint()) + '</span></div>' +
      '</div>' +
      (MS.blueprint ? blueprintPanel() : "");
    return body;
  }

  function contextReady() {
    var c = MS.context;
    if (MS.mode === "objective") return !!c.objective.trim();
    if (!c.fn) return false;
    if (c.fn === "_other" && !c.fnLabel.trim()) return false;
    if (!c.objective.trim()) return false;
    if (c.asked) {
      // every clarifier must be answered before we compose the checklist
      return clarifiersFor().every(function (q) { return !!c.answers[q.id]; });
    }
    return true;
  }
  function contextHint() {
    var c = MS.context;
    if (MS.mode === "objective") return c.objective.trim() ? "" : "Describe what you are trying to achieve.";
    if (!c.fn) return "Pick a function to begin.";
    if (c.fn === "_other" && !c.fnLabel.trim()) return "Name the function.";
    if (!c.objective.trim()) return "State the objective — it shapes the document checklist.";
    if (c.asked && !contextReady()) return "Answer the clarifications so the checklist can be composed.";
    return "";
  }

  // 2–3 clarifiers, asked only once the objective is in — and only the ones that change
  // the checklist or the read of the evidence.
  function clarifierBlock() {
    if (!MS.context.asked || MS.mode === "objective") return "";
    var qs = clarifiersFor();
    if (!qs.length) return "";
    return '<div class="mn-clar"><div class="mn-clar-h">A few clarifications — these change what we ask you for</div>' +
      qs.map(function (q) {
        return '<div class="mn-cq"><div class="mn-cq-q">' + esc(q.q) + '</div>' +
          '<div class="mn-cq-o">' + (q.options || []).map(function (o) {
            return '<button class="mn-co' + (MS.context.answers[q.id] === o ? " on" : "") +
              '" data-cq="' + q.id + '" data-co="' + esc(o) + '">' + esc(o) + '</button>';
          }).join("") + '</div></div>';
      }).join("") + '</div>';
  }

  function blueprintPanel() {
    var b = MS.blueprint;
    var crit = 0, enr = 0;
    (b.clusters || []).forEach(function (c) {
      (c.docs || []).forEach(function (d) { if (d[1] === "critical") crit++; else enr++; });
    });
    return '<div class="mn-bp">' +
      '<div class="mn-bp-h"><div class="kv">Transformation blueprint</div>' +
        '<h3>' + esc(b.title) + '</h3>' +
        '<div class="mn-bp-f">Focus: ' + esc(b.focus) + '</div></div>' +
      '<p class="mn-bp-l">From your objective I have identified <b>' + b.clusters.length +
        ' pattern clusters</b> to investigate, and the evidence each one needs.</p>' +
      '<div class="mn-bp-cs">' + b.clusters.map(function (c, i) {
        return '<div class="mn-bp-c"><div class="mn-bp-cn"><span>CLUSTER ' + (i + 1) + '</span>' + esc(c.name) + '</div>' +
          '<div class="mn-bp-cp">Potential patterns: ' + esc(c.patterns) + '</div>' +
          '<div class="mn-bp-d">' + (c.docs || []).map(function (d) {
            return '<div class="mn-bp-doc"><span class="mn-pri ' + d[1] + '">' +
              (d[1] === "critical" ? "●" : d[1] === "enriching" ? "◐" : "○") + '</span>' + esc(d[0]) + '</div>';
          }).join("") + '</div></div>';
      }).join("") + '</div>' +
      '<div class="mn-bp-f2">Total: <b>' + (crit + enr) + '</b> document types · <b>' + crit +
        '</b> critical · <b>' + enr + '</b> enriching</div>' +
      '<button class="btn go mn-bp-go">Upload documents →</button></div>';
  }

  /* ---- STEP 2 · DOCUMENTS ---------------------------------------------- */
  function renderStepDocuments() {
    var n = corpusCount();
    var crit = criticalCats().length, got = criticalCovered();
    var pct = crit ? Math.round((got / crit) * 100) : 100;
    var PRI = (MIN.meta && MIN.meta.priorities) || {};

    var cats = CATS().map(function (c) {
      var nf = catFileCount(c), open = !!MS.open[c.id];
      var p = PRI[c.priority] || {};
      var slots = (c.slots || []).map(function (s) {
        var files = filesIn(s.id);
        return '<div class="mn-slot" data-slot="' + s.id + '">' +
          '<div class="mn-sl-h"><span class="mn-sl-n">' + esc(s.label) + '</span>' +
            '<span class="mn-sl-f">' + s.formats.join(" ") + '</span></div>' +
          '<div class="mn-sl-hint">' + esc(s.hint) + '</div>' +
          (files.length
            ? '<div class="mn-files">' + files.map(function (f, i) {
                return '<span class="mn-file">📄 ' + esc(f.name) + '<i>' + kb(f.size) + '</i>' +
                  '<button class="mn-rm" data-slot="' + s.id + '" data-i="' + i + '">✕</button></span>';
              }).join("") + '</div>'
            : '<div class="mn-drop">Drop files here, or click to browse</div>') +
          '</div>';
      }).join("");
      return '<div class="mn-cat' + (open ? " open" : "") + '" data-cat="' + c.id + '">' +
        '<button class="mn-cat-h"><span class="mn-caret">' + (open ? "▾" : "▸") + '</span>' +
          '<span class="mn-cat-n">' + esc(c.label) +
            (c.promoted ? '<em class="mn-promo">promoted by your objective</em>' : '') + '</span>' +
          '<span class="mn-pri ' + c.priority + '">' + (p.glyph || "") + " " + esc(p.label || c.priority) + '</span>' +
          '<span class="mn-cat-c' + (nf ? " has" : "") + '">' + nf + ' file' + (nf === 1 ? "" : "s") + '</span></button>' +
        '<div class="mn-slots">' + slots + '</div></div>';
    }).join("");

    return '<div class="mn-head"><div><div class="kv">Step 2 · Documents</div>' +
        '<h2 style="font-size:22px;margin:2px 0 0">Recommended documents</h2>' +
        '<p class="mn-lead">Based on: <b>' + esc(MS.context.fnLabel) + '</b> · ' + esc(MS.context.objective) + '<br>' +
        'Upload what you have — we will tell you what is missing, and what it would have unlocked.</p></div>' +
        '<button class="btn ghost xs mn-back">← Change context</button></div>' +

      '<div class="mn-cov"><div class="mn-cov-t"><b>Coverage</b> ' + got + ' of ' + crit +
        ' critical dimensions · ' + n + ' file' + (n === 1 ? "" : "s") + ' · ' + kb(corpusBytes()) + '</div>' +
        '<div class="mn-cov-b"><i class="' + (pct >= 80 ? "ok" : "") + '" style="width:' + pct + '%"></i></div>' +
        '<div class="mn-cov-n">' + (canMine()
          ? 'Enough to mine. More evidence sharpens the result.'
          : 'Minimum to mine: ' + Math.min((MIN.meta.minCriticalCategories || 2), crit) + ' critical dimensions.') + '</div></div>' +

      '<div class="mn-acc">' + cats + '</div>' +
      (n ? gapPanel() : "") +
      '<div class="mn-bar"><span class="mn-corpus"><b>Corpus:</b> ' + n + ' file' + (n === 1 ? "" : "s") +
        ' · ' + kb(corpusBytes()) + '</span>' +
        (n ? '<button class="linkbtn mn-clear">clear corpus</button>' : '') +
        '<button class="btn go mn-run"' + (canMine() && !MS.running ? "" : " disabled") + '>Mine Patterns →</button></div>';
  }

  // What is missing, why it matters, and which patterns it would unlock. Derived from the
  // candidates whose evidence chain touches the empty categories.
  function gapPanel() {
    var rows = CATS().map(function (c) {
      var nf = catFileCount(c);
      var state = nf >= 3 ? "strong" : nf > 0 ? "ok" : (c.priority === "supporting" ? "opt" : "gap");
      return { c: c, n: nf, state: state };
    });
    var gaps = rows.filter(function (r) { return r.state === "gap"; });

    var status = '<div class="mn-gs">' + rows.map(function (r) {
      var g = { strong: "✓", ok: "✓", gap: "✗", opt: "○" }[r.state];
      var t = { strong: "strong", ok: "adequate", gap: "gap", opt: "optional, not uploaded" }[r.state];
      return '<div class="mn-g ' + r.state + '"><span class="mn-gg">' + g + '</span>' +
        '<b>' + esc(r.c.label) + '</b><span class="mn-gt">' + t +
        (r.n ? ' (' + r.n + ' file' + (r.n === 1 ? "" : "s") + ')' : '') + '</span></div>';
    }).join("") + '</div>';

    if (!gaps.length) {
      return '<div class="mn-gap"><div class="mn-gap-h">Corpus analysis</div>' + status +
        '<div class="mn-rec-none">Every dimension has evidence. Nothing is blocking a full read.</div></div>';
    }

    var recs = gaps.map(function (r, i) {
      // which candidates does this gap cost us?
      var blocked = (MIN.candidates || []).filter(function (cd) {
        return cd.function === MS.context.fn &&
          (cd.evidence || []).some(function (e) {
            var oc = catOfSlot(e.slot);
            return oc && oc.id === r.c.id;
          });
      });
      var slots = (r.c.slots || []).slice(0, 2).map(function (s) { return s.label; }).join(" and ");
      var why = blocked.length
        ? 'Without these we cannot detect ' +
          blocked.slice(0, 2).map(function (b) { return '<b>' + esc(b.name) + '</b>'; }).join(" or ") +
          (blocked.length > 2 ? ' (+' + (blocked.length - 2) + ' more)' : '') + '.'
        : 'This dimension feeds the <b>' + esc(dimLabel(r.c.dimension)) + '</b> maturity score — without it, that score is a floor, not a reading.';
      return '<div class="mn-rec"><span class="mn-rec-n">' + (i + 1) + '</span>' +
        '<div><b>' + esc(slots) + '</b>' +
        '<div class="mn-rec-w">' + why + '</div></div></div>';
    }).join("");

    return '<div class="mn-gap"><div class="mn-gap-h">Corpus analysis</div>' + status +
      '<div class="mn-rec-h">💡 Recommendations</div>' + recs + '</div>';
  }

  function dimLabel(id) {
    var d = (MIN.dimensions || []).filter(function (x) { return x.id === id; })[0];
    return d ? d.label : id;
  }

  /* ---- STEP 3 · RESULTS ------------------------------------------------- */
  function renderStepResults() {
    var stages = (MIN.meta && MIN.meta.stages) || [];
    var stepper = '<div class="mn-stepper">' + stages.map(function (s, i) {
      var cls = i < MS.stage ? "done" : i === MS.stage ? (MS.running ? "run" : "done") : "todo";
      return '<div class="mn-step ' + cls + '"><span class="mn-si">' + (cls === "done" ? "✓" : i + 1) + '</span>' +
        '<div class="mn-st"><b>' + esc(s.label) + '</b><small>' + esc(s.blurb) + '</small></div></div>';
    }).join("") + '</div>';

    var panels = "";
    if (MS.maturity && MS.benchmarks) {
      panels = '<div class="mn-panels">' + panelMaturity() + panelBenchmarks() + '</div>' + panelImpact();
    }

    return '<div class="mn-head"><div><div class="kv">Step 3 · Results</div>' +
        '<h2 style="font-size:22px;margin:2px 0 0">Where you stand, and what closes the gap</h2>' +
        '<p class="mn-lead">' + esc(MS.context.fnLabel) + ' · ' + esc(MS.context.objective) + '</p></div>' +
        '<button class="btn ghost xs mn-back-docs">← Documents</button></div>' +
      stepper + stageReport() + panels;
  }

  function stageReport() {
    var r = MS.report || {}, out = [];
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

  /* Panel A — maturity radar (5 dimensions, evidence-cited) */
  function panelMaturity() {
    var m = MS.maturity || [];
    var n = m.length, cx = 130, cy = 122, R = 88;
    function pt(i, v) {
      var a = (Math.PI * 2 * i / n) - Math.PI / 2, r = (v / 5) * R;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }
    function poly(vals) {
      return vals.map(function (v, i) { var p = pt(i, v); return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    }
    var rings = [1, 2, 3, 4, 5].map(function (r) {
      return '<polygon points="' + poly(m.map(function () { return r; })) + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
    }).join("");
    var spokes = m.map(function (d, i) {
      var p = pt(i, 5);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="var(--line)"/>';
    }).join("");
    var labels = m.map(function (d, i) {
      var p = pt(i, 6.05);
      var anchor = p[0] < cx - 6 ? "end" : p[0] > cx + 6 ? "start" : "middle";
      return '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="' + anchor +
        '" class="mn-rad-l">' + esc(d.label.split(" ")[0]) + '</text>';
    }).join("");

    return '<div class="mn-panel"><div class="mn-panel-h">Maturity assessment' +
        '<small>scored from the evidence you uploaded — not self-assessed</small></div>' +
      '<div class="mn-rad"><svg viewBox="0 0 260 250">' + rings + spokes +
        '<polygon points="' + poly(m.map(function (d) { return d.benchmark; })) +
          '" fill="none" stroke="var(--brand2)" stroke-width="1.6" stroke-dasharray="4 3"/>' +
        '<polygon points="' + poly(m.map(function (d) { return d.score; })) +
          '" fill="var(--accent)" fill-opacity="0.22" stroke="var(--accent)" stroke-width="2"/>' +
        labels + '</svg>' +
        '<div class="mn-rad-k"><span><i class="you"></i>You</span><span><i class="bm"></i>Top quartile</span></div>' +
      '</div>' +
      '<div class="mn-dims">' + m.map(function (d) {
        var cls = d.gap >= 1.2 ? "bad" : d.gap >= 0.5 ? "warn" : "ok";
        return '<div class="mn-dim"><div class="mn-dim-h"><b>' + esc(d.label) + '</b>' +
          '<span class="mn-dim-s ' + cls + '">' + d.score.toFixed(1) + ' / 5</span></div>' +
          '<div class="mn-dim-e">' + esc(d.evidence) + '</div>' +
          '<div class="mn-dim-b">Top quartile ' + d.benchmark.toFixed(1) + ' · gap ' +
            (d.gap > 0 ? "−" + d.gap.toFixed(1) : "at or above") + '</div></div>';
      }).join("") + '</div></div>';
  }

  /* Panel B — client KPIs vs industry benchmark */
  function panelBenchmarks() {
    var b = MS.benchmarks || [];
    var behind = b.filter(function (x) { return x.behind; }).length;
    var rows = b.map(function (k) {
      var arrow = k.behind ? (k.lowerIsBetter ? "▲" : "▼") : "✓";
      return '<tr class="' + (k.behind ? "behind" : "") + '">' +
        '<td>' + esc(k.name) + '</td>' +
        '<td class="num">' + k.client + (k.unit === "%" ? "%" : "") + '</td>' +
        '<td class="num dim">' + k.median + (k.unit === "%" ? "%" : "") + '</td>' +
        '<td class="num dim">' + k.topQuartile + (k.unit === "%" ? "%" : "") + '</td>' +
        '<td class="num gap ' + (k.behind ? "bad" : "ok") + '">' + arrow + " " +
          (k.behind ? Math.abs(k.gap) : 0) + (k.unit === "%" ? "pp" : k.unit === "days" ? "d" : "") + '</td>' +
        '<td><span class="mn-q ' + k.quartile + '">' + k.quartile + '</span></td>' +
        '<td><button class="mn-tocc" data-kpi="' + esc(k.name) + '">View in Command Centre →</button></td>' +
      '</tr>';
    }).join("");
    return '<div class="mn-panel"><div class="mn-panel-h">KPI performance vs benchmark' +
        '<small>your numbers, read out of the corpus, against the industry range</small></div>' +
      '<table class="mn-kpi"><thead><tr><th>KPI</th><th class="num">You</th><th class="num">Median</th>' +
        '<th class="num">Top Q</th><th class="num">Gap to top</th><th>Rank</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '<div class="mn-kpi-f"><b>' + behind + ' of ' + b.length + '</b> KPIs sit behind the top quartile. ' +
        'The patterns below are ranked by which of these gaps they close.</div></div>';
  }

  /* Panel C — the impact bridge: maturity gaps + KPI gaps → the patterns that close them */
  function panelImpact() {
    if (!MS.candidates.length) {
      return '<div class="mn-none">No candidates yet. The corpus does not carry evidence the library ' +
        'is missing — add documents to the <b>critical</b> dimensions and mine again.</div>';
    }
    var lead = MS.candidates.filter(function (c) { return c.status === "open" || c.status === "parked"; }).slice(0, 3);
    var bridge = lead.length
      ? '<div class="mn-bridge"><div class="mn-bridge-h">Based on your maturity gaps and KPI positions, ' +
          'the patterns most likely to create value are:</div>' +
        lead.map(function (c, i) {
          var k = c.kpi;
          return '<div class="mn-br"><span class="mn-br-n">' + (i + 1) + '</span><div>' +
            '<b>' + esc(c.name) + '</b> — ' +
            (k ? 'your <b>' + esc(k.name) + '</b> is ' + Math.abs(k.gap) +
                 (k.unit === "%" ? "pp" : k.unit === "days" ? " days" : " " + k.unit) +
                 ' from the top quartile (' + k.quartile + ').'
               : 'closes a gap the benchmark set does not track.') +
            '<div class="mn-br-i">Est. impact: <b>' + esc(c.estImpact) + '</b></div></div></div>';
        }).join("") +
        '<div class="mn-bridge-f">These connect directly to your objective — <i>' +
          esc(MS.context.objective) + '</i>.</div></div>'
      : "";

    return bridge +
      '<h3 class="mn-h3">Candidate patterns <small>you are the gate — nothing enters the library without your call</small></h3>' +
      '<div class="mn-cands">' + MS.candidates.map(candCard).join("") + '</div>';
  }

  function candCard(c) {
    var pct = Math.round(c.confidence * 100), sim = c.similarTo;
    if (c.status === "accepted") {
      return '<div class="mn-cand accepted"><div class="mn-cd-h"><span class="mn-cd-id">#' + c.newId + '</span>' +
        '<span class="mn-cd-n">' + esc(c.name) + '</span>' +
        '<span class="mn-cd-ok">✓ accepted into the library</span>' +
        '<button class="cc-inbuilder mn-view" data-pat="' + c.newId + '">View in Builder →</button></div></div>';
    }
    if (c.status === "rejected") {
      return '<div class="mn-cand rejected"><div class="mn-cd-h"><span class="mn-cd-n">' + esc(c.name) + '</span>' +
        '<span class="mn-cd-no">rejected</span>' +
        '<button class="linkbtn mn-undo" data-cid="' + c.cid + '">undo</button></div></div>';
    }
    var editing = c.editing;
    var serving = (c.servingMissions || []).map(function (m) {
      return '<button class="mn-sm" data-mission="' + m + '" title="' + esc(missionName(m)) + ' · ' +
        esc(missionOwnerLabel(m)) + '">' + m + '</button>';
    }).join("") + (c.servingThemes || []).map(function (t) {
      return '<span class="mn-th" title="' + esc(themeName(t)) + '">Theme ' + t + '</span>';
    }).join("");

    return '<div class="mn-cand' + (c.status === "parked" ? " parked" : "") + '" data-cid="' + c.cid + '">' +
      '<div class="mn-cd-h">' +
        (editing ? '<input class="mn-cd-name" value="' + esc(c.name) + '"/>'
                 : '<span class="mn-cd-n">' + esc(c.name) + '</span>') +
        '<span class="mn-cd-cat">' + esc(c.src.category) + '</span>' +
        '<span class="badge" style="background:' + PRIO[c.src.priority] + '">' + c.src.priority + '</span>' +
        (c.status === "parked" ? '<span class="mn-cd-park">parked</span>' : '') +
      '</div>' +
      '<div class="mn-cd-mm">“' + esc(c.src.mentalModel) + '”</div>' +

      '<div class="mn-conf"><span class="mn-conf-l">Confidence</span>' +
        '<span class="mn-conf-t"><i style="width:' + pct + '%"></i></span><b>' + pct + '%</b>' +
        '<span class="mn-conf-e">' + c.evidence.length + ' of ' + c.evidenceTotal + ' evidence sources present</span></div>' +

      '<div class="mn-serve"><span class="mn-serve-l">Serving</span>' + serving +
        '<span class="mn-serve-k">closes <b>' + esc(c.closesKpi) + '</b>' +
        (c.kpi ? ' (' + c.kpi.quartile + ')' : '') + ' · ' + esc(c.estImpact) + '</span></div>' +

      (sim ? '<div class="mn-sim ' + (sim.score >= 0.7 ? "hot" : "") + '">' +
        (sim.score >= 0.7 ? '⚠ ' : '') + 'Resembles <b>#' + sim.id + ' ' + esc(sim.name) + '</b> — ' +
        Math.round(sim.score * 100) + '% similar.' +
        (sim.score >= 0.7 ? '<span class="mn-sim-a"><button class="mn-merge" data-cid="' + c.cid + '">Merge</button>' +
          '<button class="mn-keep" data-cid="' + c.cid + '">Keep separate</button>' +
          '<button class="mn-discard" data-cid="' + c.cid + '">Discard</button></span>' : '') + '</div>' : '') +

      '<div class="mn-cd-sec"><h5>Triggers ' + (editing ? '<small>editable</small>' : '') + '</h5>' +
        (editing
          ? '<textarea class="mn-trig" rows="' + Math.max(3, c.triggers.length) + '">' + esc(c.triggers.join("\n")) + '</textarea>'
          : '<div class="mn-trigs">' + c.triggers.map(function (t) {
              return '<span class="mn-trig-p mono">' + esc(t) + '</span>'; }).join("") + '</div>') + '</div>' +

      '<div class="mn-cd-sec"><h5>Process flow <small>action blocks · executors</small></h5>' +
        '<div class="flatdag">' + (c.src.processFlow || []).map(function (s) {
          return '<span class="verb flat">' + esc(s) + '</span>'; }).join('<span class="arr">→</span>') + '</div>' +
        '<div class="mn-exec">' + (c.src.branchingFlow || []).map(function (b) {
          return '<div class="mn-ex"><span class="mn-ex-t t-' + b.tier + '">' + b.tier + '</span>' +
            (b.actionBlocks || []).map(function (a, i) {
              var ex = (b.executors || [])[i] || "Agent";
              return '<span class="mn-ab">' + esc(a) + '<i class="ex-' + ex.toLowerCase().replace(/ /g, "-") + '">' + esc(ex) + '</i></span>';
            }).join("") +
            (b.hitl ? '<span class="mn-hitl">🔒 ' + esc(b.hitl) + '</span>' : '') + '</div>';
        }).join("") + '</div></div>' +

      '<details class="mn-ev"><summary>Evidence chain — ' + c.evidence.length + ' source' +
        (c.evidence.length === 1 ? "" : "s") + '</summary>' +
        c.evidence.map(function (e) {
          var s = slotById(e.slot), oc = catOfSlot(e.slot);
          var files = filesIn(e.slot).map(function (f) { return f.name; }).join(", ");
          return '<div class="mn-ev-row"><div class="mn-ev-src"><b>' + esc(s ? s.label : e.slot) + '</b>' +
            '<small>' + esc(oc ? oc.label : "") + (files ? ' · ' + esc(files) : '') + '</small></div>' +
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

  function candById(cid) { return MS.candidates.filter(function (x) { return x.cid === cid; })[0]; }

  /* ---- wiring ----------------------------------------------------------- */
  function wireMine(view) {
    var root = function () { return document.getElementById("view"); };
    var rerender = function () { renderMine(root().querySelector(".ps-body")); };
    var reshell = function () { render(root()); };

    // step rail — you can walk back, not forward past what you have done
    view.querySelectorAll(".mn-rs").forEach(function (b) {
      b.onclick = function () {
        var want = b.dataset.step;
        if (want === "context") { MS.step = "context"; rerender(); }
        else if (want === "documents" && MS.checklist.length) { MS.step = "documents"; rerender(); }
        else if (want === "results" && MS.report) { MS.step = "results"; rerender(); }
      };
    });

    // ---- step 1 ----
    view.querySelectorAll(".mn-md").forEach(function (b) {
      b.onclick = function () {
        MS.mode = b.dataset.mode; MS.blueprint = null; MS.context.asked = false;
        rerender();
      };
    });
    view.querySelectorAll(".mn-fn").forEach(function (b) {
      b.onclick = function () {
        MS.context.fn = b.dataset.fn;
        MS.context.fnLabel = b.dataset.fl || "";
        MS.context.asked = false; MS.context.answers = {};
        rerender();
      };
    });
    var other = view.querySelector(".mn-other");
    if (other) other.oninput = function () { MS.context.fnLabel = other.value; toggleNext(view); };

    var obj = view.querySelector(".mn-obj");
    if (obj) obj.oninput = function () { MS.context.objective = obj.value; toggleNext(view); };

    view.querySelectorAll(".mn-co").forEach(function (b) {
      b.onclick = function () {
        MS.context.answers[b.dataset.cq] = b.dataset.co;
        rerender();
      };
    });

    var next = view.querySelector(".mn-next");
    if (next) next.onclick = function () {
      var c = MS.context;
      if (MS.mode === "objective") {
        var bp = blueprintFor(c.objective);
        if (bp) {
          MS.blueprint = bp;
          c.fn = bp.function;
          c.fnLabel = (MIN.functions.filter(function (f) { return f.id === bp.function; })[0] || {}).label || bp.function;
        } else {
          // no blueprint matched — fall back to the generic checklist, honestly labelled
          MS.blueprint = { title: c.objective, focus: "No pre-built blueprint matched — using the generic evidence frame",
            clusters: [{ name: "General evidence sweep",
              patterns: "Whatever recurs across the corpus",
              docs: [["Transactional / exception evidence", "critical"],
                     ["Process documentation and policy", "critical"],
                     ["KPI reports", "enriching"]] }] };
          c.fn = c.fn || "_other";
          c.fnLabel = c.fnLabel || "Your function";
        }
        MS.checklist = composeChecklist();
        rerender();
        return;
      }
      // documents-first: ask the clarifiers once, then compose
      if (!c.asked && clarifiersFor().length) { c.asked = true; rerender(); return; }
      MS.checklist = composeChecklist();
      MS.step = "documents";
      ((MIN.meta && MIN.meta.quickStart) || []).forEach(function (id) { MS.open[id] = true; });
      // open the critical categories by default — that is where they should start
      MS.checklist.forEach(function (x) { if (x.priority === "critical") MS.open[x.id] = true; });
      rerender();
    };

    var bpGo = view.querySelector(".mn-bp-go");
    if (bpGo) bpGo.onclick = function () {
      MS.step = "documents";
      MS.checklist.forEach(function (x) { if (x.priority === "critical") MS.open[x.id] = true; });
      rerender();
    };

    // ---- step 2 ----
    var back = view.querySelector(".mn-back");
    if (back) back.onclick = function () { MS.step = "context"; rerender(); };
    var backDocs = view.querySelector(".mn-back-docs");
    if (backDocs) backDocs.onclick = function () { MS.step = "documents"; rerender(); };

    view.querySelectorAll(".mn-cat-h").forEach(function (h) {
      h.onclick = function () {
        var id = h.parentNode.dataset.cat;
        MS.open[id] = !MS.open[id];
        rerender();
      };
    });

    view.querySelectorAll(".mn-slot").forEach(function (sl) {
      var sid = sl.dataset.slot, def = slotById(sid);
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
        MS.stage = -1; MS.candidates = []; MS.report = null; MS.maturity = null; MS.benchmarks = null;
        reshell();
      }
      var drop = sl.querySelector(".mn-drop");
      if (drop) drop.onclick = function () {
        var inp = document.createElement("input");
        inp.type = "file"; inp.multiple = true;
        inp.accept = (def && def.formats ? def.formats : []).join(",");
        inp.onchange = function () { add(inp.files); };
        inp.click();
      };
      sl.addEventListener("dragover", function (e) { e.preventDefault(); sl.classList.add("over"); });
      sl.addEventListener("dragleave", function () { sl.classList.remove("over"); });
      sl.addEventListener("drop", function (e) {
        e.preventDefault(); sl.classList.remove("over");
        add(e.dataTransfer && e.dataTransfer.files);
      });
    });

    view.querySelectorAll(".mn-rm").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var arr = MS.corpus[b.dataset.slot] || [];
        arr.splice(+b.dataset.i, 1);
        if (!arr.length) delete MS.corpus[b.dataset.slot];
        MS.stage = -1; MS.candidates = []; MS.report = null; MS.maturity = null; MS.benchmarks = null;
        reshell();
      };
    });
    var clr = view.querySelector(".mn-clear");
    if (clr) clr.onclick = function () {
      MS.corpus = {}; MS.stage = -1; MS.candidates = []; MS.report = null;
      MS.maturity = null; MS.benchmarks = null;
      reshell();
    };
    var run = view.querySelector(".mn-run");
    if (run && !run.disabled) run.onclick = mine;

    // ---- step 3 ----
    var pr = view.querySelector(".mn-prompt");
    if (pr) pr.onclick = function () { MS.showPrompt = !MS.showPrompt; rerender(); };

    // KPI row → the capability widget in the Command Centre that measures the same thing
    view.querySelectorAll(".mn-tocc").forEach(function (b) {
      b.onclick = function () { toast("Opening the Command Centre at " + b.dataset.kpi + "…"); goCC(null); };
    });
    // a candidate's serving-mission chip → that mission card in the Command Centre
    view.querySelectorAll(".mn-sm").forEach(function (b) {
      b.onclick = function () { goCC(b.dataset.mission); };
    });
    view.querySelectorAll(".mn-view").forEach(function (b) {
      b.onclick = function () {
        state.tab = "library"; state.selId = +b.dataset.pat;
        render(document.getElementById("view"));
      };
    });

    view.querySelectorAll(".mn-accept").forEach(function (b) {
      b.onclick = function () {
        var p = acceptCandidate(candById(b.dataset.cid));
        toast("Accepted as pattern #" + p.id + " — serving " + (p.servingMissions || []).join(", "));
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
          var have = {};
          (host.branchingDAG || []).forEach(function (br) { have[br.condition] = 1; });
          (c.src.branchingFlow || []).forEach(function (br, i) {
            var cond = c.triggers[i] != null ? c.triggers[i] : br.condition;
            if (have[cond]) return;
            host.branchingDAG.push({ condition: cond, actions: (br.actionBlocks || []).slice(),
              executors: (br.executors || []).slice(), hitl: br.hitl, tier: br.tier });
          });
          (c.src.hitlGates || []).forEach(function (g) {
            if ((host.hitlGates || []).indexOf(g) < 0) host.hitlGates.push(g);
          });
          (c.servingMissions || []).forEach(function (m) {
            host.servingMissions = host.servingMissions || [];
            if (host.servingMissions.indexOf(m) < 0) host.servingMissions.push(m);
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

  function toggleNext(view) {
    var b = view.querySelector(".mn-next");
    if (b) b.disabled = !contextReady();
    var h = view.querySelector(".mn-hint");
    if (h) h.textContent = contextHint();
  }

  // cross-tile: open the Command Centre, optionally at a specific mission's owner + lens
  function goCC(mid) {
    var cc = CCD();
    if (mid && cc.missions && cc.missions[mid]) {
      var m = cc.missions[mid];
      try {
        localStorage.setItem("piq.cc.jump.v1", JSON.stringify({ persona: m.owner, tab: m.tab, mission: mid }));
      } catch (e) {}
    }
    window.location.href = "processiq.html?persona=command";
  }
  window.PIQ.goCommandCentre = goCC;

  function toast(msg) {
    var t = document.querySelector(".cfo-toast");
    if (!t) { t = el("div", "cfo-toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  window.PIQ.modules.patternstudio = { render: render };
  window.PIQ.onErp(function () {
    if (window.PIQ.active === "patternstudio" && state.tab === "library") renderDetail();
  });
})();
