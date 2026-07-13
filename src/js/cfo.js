/* Command Centre — the consumption surface (one of the two top-level tiles).
 *
 * The inverse of the Transformation Builder: outcomes first, patterns underneath. It is
 * NOT a generic dashboard builder — it is a projection of the CFO Mission-Capability
 * Taxonomy (8 objectives → 21 L2 → 60 missions → 77 capabilities, 11 personas), which
 * arrives fully resolved in window.PROCESSIQ_CC.
 *
 *   sidebar (shell.js)              #view (here)
 *   ────────────────────            ─────────────────────────────────────────
 *   roster of 11 personas     →     the same roster as cards
 *   a persona + its lenses    →     that persona's mission cards for the lens
 *   CFO                       →     8 objective tiles, drill-through to the owner
 *
 * A lens is a cadence bucket (Daily/Weekly → Pulse, Fortnightly/Monthly → Intelligence,
 * Ad hoc → Scenarios, Quarterly/Annual → Trajectory). A persona with no mission at a
 * cadence has no such tab — Tax has no Pulse. The shell reads `activeTabs`; nothing here
 * guesses.
 *
 * Each mission card embeds its capability widgets. A capability is one component with many
 * placements — CAP-61 renders identically for all six personas whose cost mission uses it.
 * Nav state lives in the shell (PIQ.cc); this module renders off it.
 */
(function () {
  "use strict";

  var CC = window.PROCESSIQ_CC || {};
  var OBJ = CC.objectives || {};
  var MIS = CC.missions || {};
  var CAP = CC.capabilities || {};
  var TABS = (CC.meta && CC.meta.tabs) || [];

  function S() { return window.PIQ.cc; }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function tone(t) { return "var(--" + (t || "brand2") + ")"; }
  function personaById(id) { return (CC.personas || []).filter(function (p) { return p.id === id; })[0] || null; }
  function tabDef(id) { return TABS.filter(function (t) { return t.id === id; })[0] || {}; }

  function toast(msg) {
    var t = document.querySelector(".cfo-toast");
    if (!t) { t = el("div", "cfo-toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove("show"); }, 1900);
  }

  /* ---- per-persona widget layout (localStorage) ------------------------
     The layout is an ordered list of capability ids. A mission card renders its own
     capabilities filtered through it; capabilities the SME adds from *other* missions
     collect in a "Added widgets" block at the foot of the lens. An empty layout is
     honoured — "Reset to default" is the way back to the taxonomy baseline. */
  function storeKey(pid) { return "piq.cc." + pid + ".v1"; }
  function layout(p) {
    try {
      var raw = localStorage.getItem(storeKey(p.id));
      if (raw) {
        var ids = JSON.parse(raw);
        if (Array.isArray(ids)) return ids.filter(function (i) { return CAP[i]; });
      }
    } catch (e) {}
    return (p.defaultWidgets || []).slice();
  }
  function saveLayout(p, ids) {
    try { localStorage.setItem(storeKey(p.id), JSON.stringify(ids)); } catch (e) {}
  }
  function resetLayout(p) { try { localStorage.removeItem(storeKey(p.id)); } catch (e) {} }

  /* ====================================================================== */
  /* SVG helpers                                                             */
  /* ====================================================================== */
  function sx(i, n, w, pad) { return pad + (n <= 1 ? 0 : (i / (n - 1)) * (w - 2 * pad)); }
  function sy(v, mn, mx, h, pad) { return h - pad - (mx === mn ? 0 : ((v - mn) / (mx - mn)) * (h - 2 * pad)); }
  function gapped(vals, mn, mx, w, h, pad) {
    var n = vals.length, d = "", pen = false;
    for (var i = 0; i < n; i++) {
      var v = vals[i];
      if (v == null) { pen = false; continue; }
      d += (pen ? "L" : "M") + sx(i, n, w, pad).toFixed(1) + "," + sy(v, mn, mx, h, pad).toFixed(1) + " ";
      pen = true;
    }
    return d.trim();
  }
  function polar(cx, cy, r, deg) { var a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  function arcPath(cx, cy, r, a0, a1) {
    var s = polar(cx, cy, r, a0), e = polar(cx, cy, r, a1), lg = (a1 - a0) > 180 ? 1 : 0;
    return "M" + s[0].toFixed(1) + "," + s[1].toFixed(1) + " A" + r + "," + r + " 0 " + lg + " 1 " + e[0].toFixed(1) + "," + e[1].toFixed(1);
  }
  function mnmx() {
    var a = [].concat.apply([], arguments).filter(function (v) { return v != null && isFinite(v); });
    return [Math.min.apply(null, a), Math.max.apply(null, a)];
  }

  /* ====================================================================== */
  /* WIDGET ENGINE — one renderer per kind, driven by capability.data.kind   */
  /* ====================================================================== */
  var KIND = {};

  KIND.series = function (d) {
    var w = 560, h = 170, pad = 26;
    var all = [];
    (d.series || []).forEach(function (s) { all = all.concat(s.values); });
    if (d.target != null) all.push(d.target);
    var mm = mnmx(all), sp = (mm[1] - mm[0]) || 1;
    var mn = mm[0] - sp * 0.15, mx = mm[1] + sp * 0.15;
    var n = (d.labels || []).length;
    var paths = (d.series || []).map(function (s) {
      return '<path d="' + gapped(s.values, mn, mx, w, h, pad) + '" fill="none" stroke="' + tone(s.color) +
        '" stroke-width="2.4"' + (s.dash ? ' stroke-dasharray="5 4" opacity="0.8"' : '') + '/>';
    }).join("");
    var tgt = d.target != null ? '<line x1="' + pad + '" y1="' + sy(d.target, mn, mx, h, pad).toFixed(1) +
      '" x2="' + (w - pad) + '" y2="' + sy(d.target, mn, mx, h, pad).toFixed(1) +
      '" stroke="var(--muted)" stroke-dasharray="2 3"/>' : '';
    var lbl = (d.labels || []).map(function (L, i) {
      return '<text x="' + sx(i, n, w, pad).toFixed(1) + '" y="' + (h - 7) + '" text-anchor="middle" class="ax">' + esc(L) + '</text>';
    }).join("");
    var lg = (d.series || []).map(function (s) {
      return '<span class="cw-lg"><i style="background:' + tone(s.color) + '"></i>' + esc(s.name) + '</span>';
    }).join("");
    return '<div class="cw-legend">' + lg + '</div>' +
      '<svg class="cw-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + tgt + paths + lbl + '</svg>';
  };

  KIND.gauge = function (d) {
    var cx = 90, cy = 84, r = 60;
    var f = Math.max(0, Math.min(1, d.value)), t = Math.max(0, Math.min(1, d.target));
    var bg = arcPath(cx, cy, r, -90, 90);
    var val = arcPath(cx, cy, r, -90, -90 + 180 * f);
    var tick = polar(cx, cy, r + 9, -90 + 180 * t), tin = polar(cx, cy, r - 9, -90 + 180 * t);
    return '<div class="cw-gauge"><svg viewBox="0 0 180 108">' +
      '<path d="' + bg + '" fill="none" stroke="var(--line)" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="' + val + '" fill="none" stroke="' + (f >= t ? "var(--act)" : "var(--accent)") + '" stroke-width="13" stroke-linecap="round"/>' +
      '<line x1="' + tick[0].toFixed(1) + '" y1="' + tick[1].toFixed(1) + '" x2="' + tin[0].toFixed(1) + '" y2="' + tin[1].toFixed(1) +
        '" stroke="var(--brand2)" stroke-width="2.5"/>' +
      '<text x="90" y="80" text-anchor="middle" class="cw-gv">' + Math.round(f * 100) + '%</text></svg>' +
      '<div class="cw-gm">target <b>' + Math.round(t * 100) + '%</b></div></div>';
  };

  KIND.bars = function (d) {
    return '<div class="cw-bars">' + (d.items || []).map(function (it) {
      return '<div class="cw-bar"><span class="cwb-lbl">' + esc(it.label) + '</span>' +
        '<span class="cwb-track"><i style="width:' + Math.max(2, it.pct) + '%;background:' + tone(it.tone) + '"></i></span>' +
        '<span class="cwb-val">' + esc(it.value) + '</span></div>';
    }).join("") + '</div>';
  };

  KIND.list = function (d) {
    return '<div class="cw-list">' + (d.items || []).map(function (it) {
      return '<div class="cw-row"><div class="cwr-txt"><b>' + esc(it.primary) + '</b>' +
        '<small>' + esc(it.secondary || "") + '</small></div>' +
        (it.badge ? '<span class="cwr-badge" style="color:' + tone(it.tone) + ';border-color:' + tone(it.tone) + '">' +
          esc(it.badge) + '</span>' : '') + '</div>';
    }).join("") + '</div>';
  };

  KIND.table = function (d) {
    return '<table class="cw-table"><thead><tr>' +
      (d.cols || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join("") +
      '</tr></thead><tbody>' + (d.rows || []).map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          var st = /on-track|attention|off-track/.test(c);
          return '<td>' + (st ? '<span class="mc-dot ' + c + '"></span>' : '') + esc(c) + '</td>';
        }).join("") + '</tr>';
      }).join("") + '</tbody></table>';
  };

  KIND.heat = function (d) {
    var flat = [].concat.apply([], d.cells || []);
    var mx = Math.max.apply(null, flat.concat([0.0001]));
    return '<table class="cw-heat"><tr><th></th>' +
      (d.cols || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join("") + '</tr>' +
      (d.rows || []).map(function (r, i) {
        return '<tr><th>' + esc(r) + '</th>' + (d.cells[i] || []).map(function (v) {
          var a = v / mx;
          return '<td style="background:rgba(212,96,15,' + (0.06 + a * 0.7).toFixed(2) + ');color:' +
            (a > 0.55 ? "#fff" : "inherit") + '">' + v + '</td>';
        }).join("") + '</tr>';
      }).join("") + '</table>';
  };

  KIND.donut = function (d) {
    var segs = d.segments || [], total = segs.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var cx = 80, cy = 80, r = 58, a = 0;
    var arcs = segs.map(function (s) {
      var sweep = (s.value / total) * 359.9, p = arcPath(cx, cy, r, a, a + sweep);
      a += sweep;
      return '<path d="' + p + '" fill="none" stroke="' + tone(s.color) + '" stroke-width="18"/>';
    }).join("");
    return '<div class="cw-donut"><svg viewBox="0 0 160 160">' + arcs +
      '<text x="80" y="78" text-anchor="middle" class="cw-dc">' + esc(d.centre || "") + '</text>' +
      '<text x="80" y="95" text-anchor="middle" class="cw-dcs">' + esc(d.centreSub || "") + '</text></svg>' +
      '<div class="cw-dlegend">' + segs.map(function (s) {
        return '<div class="cw-dl"><i style="background:' + tone(s.color) + '"></i>' + esc(s.label) +
          '<b>' + s.value + '%</b></div>';
      }).join("") + '</div></div>';
  };

  KIND.funnel = function (d) {
    var steps = d.steps || [], mx = Math.max.apply(null, steps.map(function (s) { return s.value; }).concat([1]));
    return '<div class="cw-funnel">' + steps.map(function (s, i) {
      var t = i === 0 ? "act" : i < steps.length - 1 ? "high" : "crit";
      return '<div class="cw-fs"><span class="cwf-lbl">' + esc(s.label) + '</span>' +
        '<span class="cwf-bar" style="width:' + Math.max(10, (s.value / mx) * 100) + '%;background:' + tone(t) + '">' +
        s.value + '</span></div>';
    }).join("") + '</div>';
  };

  KIND.waterfall = function (d) {
    var b = d.buckets || [], mx = Math.max.apply(null, b.map(function (x) { return x.value; }).concat([1]));
    return '<div class="cw-wf">' + b.map(function (x) {
      return '<div class="cw-wfc"><div class="cwf-col"><i style="height:' + ((x.value / mx) * 100).toFixed(1) +
        '%;background:' + tone(x.tone) + '"></i></div>' +
        '<div class="cwf-v">' + x.value + '</div><div class="cwf-l">' + esc(x.label) + '</div></div>';
    }).join("") + '</div>' + (d.unit ? '<div class="cw-unit-foot">' + esc(d.unit) + '</div>' : '');
  };

  // one capability = one widget. Same component wherever it is placed.
  function capWidget(cid, hostMission) {
    var c = CAP[cid];
    if (!c) return "";
    var d = c.data || {};
    var body = (KIND[d.kind] || function () { return '<div class="cfo-empty">no renderer for ' + esc(d.kind) + '</div>'; })(d);
    var shared = (c.usedByMissions || []).length > 1;
    return '<div class="cw ' + (c.defaultSize === "wide" ? "wide" : "") + '" data-cap="' + c.id + '">' +
      '<div class="cw-head"><span class="cw-title">' + esc(c.label) + '</span>' +
        '<span class="cw-cat">' + c.id + (shared ? ' · ' + c.usedByMissions.length + '×' : '') + '</span></div>' +
      '<div class="cw-body">' + body + '</div></div>';
  }

  /* ====================================================================== */
  /* PERSONA PICKER (mirrors the sidebar roster)                             */
  /* ====================================================================== */
  function renderPicker(view) {
    var order = (CC.meta && CC.meta.groupOrder) || [];
    var byGroup = {}, groups = [];
    (CC.personas || []).forEach(function (p) {
      if (!byGroup[p.group]) { byGroup[p.group] = []; groups.push(p.group); }
      byGroup[p.group].push(p);
    });
    groups.sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var c = (CC.meta && CC.meta.counts) || {};
    var html = groups.map(function (g) {
      return '<div class="cc-tier"><span class="cc-tier-lbl">' + esc(g === "top" ? "CFO" : g) + '</span></div>' +
        '<div class="cc-pgrid">' + byGroup[g].map(function (p) {
          return '<button class="cc-pcard' + (p.isOverview ? " overview" : "") + '" data-p="' + p.id + '">' +
            '<span class="cc-pic">' + p.icon + '</span>' +
            '<span class="cc-pname">' + esc(p.label) + '</span>' +
            '<span class="cc-ptag">' + esc(p.headline) + '</span>' +
            '<span class="cc-pmeta">' + (p.isOverview
              ? c.objectives + ' objectives · ' + c.missions + ' missions'
              : p.missionCount + ' missions · ' + p.capabilityCount + ' capabilities') + '</span></button>';
        }).join("") + '</div>';
    }).join("");

    view.innerHTML = '<div class="cfo-wrap">' +
      '<div class="cfo-section"><h3>Command Centre</h3><div class="cfo-sub">' +
        'Your outcomes surface. ' + c.objectives + ' objectives · ' + c.l2 + ' sub-objectives · ' +
        c.missions + ' missions · ' + c.capabilities + ' capabilities. Choose your role — every persona ' +
        'gets a mission-driven view organised by cadence, with the power to customise.' +
      '</div></div>' + html + '</div>';

    view.querySelectorAll(".cc-pcard").forEach(function (b) {
      b.onclick = function () {
        S().persona = b.dataset.p; S().custom = false;
        var p = personaById(b.dataset.p);
        S().tab = (p.activeTabs || ["pulse"])[0];
        window.PIQ.go("cc");
      };
    });
  }

  /* ====================================================================== */
  /* CFO — the objective-level roll-up (A–H), not individual missions        */
  /* ====================================================================== */
  var HEALTH = { "on-track": 2, "attention": 1, "off-track": 0 };
  function objMissions(oid) {
    return Object.keys(MIS).filter(function (m) { return MIS[m].objective === oid; })
      .sort(function (a, b) { return +a.slice(1) - +b.slice(1); });
  }
  function objHealth(oid) {
    var ms = objMissions(oid);
    if (!ms.length) return { pct: 100, status: "on-track", counts: {} };
    var c = { "on-track": 0, "attention": 0, "off-track": 0 };
    ms.forEach(function (m) { c[MIS[m].status]++; });
    var score = ms.reduce(function (a, m) { return a + HEALTH[MIS[m].status]; }, 0) / (ms.length * 2);
    return { pct: Math.round(score * 100), counts: c, n: ms.length,
      status: score >= 0.8 ? "on-track" : score >= 0.55 ? "attention" : "off-track" };
  }

  function renderCFO(view, p) {
    var tab = window.PIQ.ccTab(p);
    var td = tabDef(tab);
    var body;

    if (tab === "pulse") {
      // aggregate exception/alert count across all 60 missions
      var all = Object.keys(MIS);
      var att = all.filter(function (m) { return MIS[m].status === "attention"; });
      var off = all.filter(function (m) { return MIS[m].status === "off-track"; });
      body =
        '<h4 class="cc-h4">What is burning right now — ' + (off.length + att.length) +
          ' of ' + all.length + ' missions flagged, most severe first</h4>' +
        '<div class="cc-alerts">' + off.concat(att).slice(0, 12).map(function (m) {
          var mm = MIS[m], own = personaById(mm.owner);
          return '<div class="cc-alert ' + mm.status + '" data-owner="' + mm.owner + '">' +
            '<span class="mc-dot ' + mm.status + '"></span>' +
            '<span class="cc-al-id">' + m + '</span>' +
            '<span class="cc-al-n">' + esc(mm.name) + '</span>' +
            '<span class="cc-al-cad">' + esc(mm.cadence) + '</span>' +
            '<span class="cc-al-own">' + (own ? own.icon + " " + esc(own.label) : "") + ' →</span></div>';
        }).join("") + '</div>';
    } else if (tab === "scenarios") {
      // cross-functional what-if: a shock, and the missions across personas it lands on
      var SHOCKS = [
        { q: "What if FX moves 5% against us?", ms: ["M30", "M6", "M36"] },
        { q: "What if rates rise 200bps?", ms: ["M31", "M25", "M24"] },
        { q: "What if a top-5 customer defaults?", ms: ["M19", "M43", "M56"] },
        { q: "What if we pull forward the buyback?", ms: ["M35", "M27", "M32"] },
        { q: "What if input costs rise 10%?", ms: ["M5", "M2", "M10"] },
      ];
      body = '<div class="cc-shocks">' + SHOCKS.map(function (s) {
        var hits = s.ms.filter(function (m) { return MIS[m]; }).map(function (m) {
          var mm = MIS[m], own = personaById(mm.owner);
          return '<button class="cc-shock-m" data-owner="' + mm.owner + '">' +
            '<span class="mc-dot ' + mm.status + '"></span><b>' + m + '</b> ' + esc(mm.name) +
            '<i>' + (own ? own.icon + " " + esc(own.label) : "") + '</i></button>';
        }).join("");
        return '<div class="cc-shock"><div class="cc-shock-q">' + esc(s.q) + '</div>' +
          '<div class="cc-shock-ms">' + hits + '</div></div>';
      }).join("") + '</div>';

    } else if (tab === "trajectory") {
      // the 8-objective scorecard: targets vs actuals at the strategic level
      body = '<table class="board-table cc-score"><thead><tr><th>Objective</th><th>Missions</th>' +
        '<th>Health</th><th>Off / Attention / On</th><th>Status</th></tr></thead><tbody>' +
        Object.keys(OBJ).map(function (oid) {
          var h = objHealth(oid);
          return '<tr data-owner-none><td><b>' + oid + '</b> ' + esc(OBJ[oid].name) + '</td>' +
            '<td>' + h.n + '</td>' +
            '<td><span class="cc-obj-bar sm"><i style="width:' + h.pct + '%"></i></span> ' + h.pct + '%</td>' +
            '<td>' + h.counts["off-track"] + ' / ' + h.counts["attention"] + ' / ' + h.counts["on-track"] + '</td>' +
            '<td><span class="board-status ' + h.status + '">' + h.status.replace("-", " ") + '</span></td></tr>';
        }).join("") + '</tbody></table>';

    } else {
      // Intelligence — A–H objective tiles, each drilling through to the owning personas
      body = '<div class="cc-objs">' + Object.keys(OBJ).map(function (oid) {
        var o = OBJ[oid], h = objHealth(oid);
        var owners = {}, ms = objMissions(oid);
        ms.forEach(function (m) { owners[MIS[m].owner] = 1; });
        var l2 = Object.keys(o.l2).map(function (k) {
          return '<div class="cc-l2"><span class="cc-l2-id">' + k + '</span>' +
            '<span class="cc-l2-n">' + esc(o.l2[k].name) + '</span>' +
            '<span class="cc-l2-c">' + o.l2[k].missions.length + '</span></div>';
        }).join("");
        var chips = Object.keys(owners).map(function (pid) {
          var pp = personaById(pid);
          return pp ? '<button class="cc-own" data-owner="' + pid + '">' + pp.icon + ' ' + esc(pp.label) + '</button>' : "";
        }).join("");
        return '<div class="cc-obj ' + h.status + '">' +
          '<div class="cc-obj-h"><span class="cc-obj-id">' + oid + '</span>' +
            '<span class="cc-obj-n">' + esc(o.name) + '</span>' +
            '<span class="cc-obj-p ' + h.status + '">' + h.pct + '%</span></div>' +
          '<div class="cc-obj-bar"><i style="width:' + h.pct + '%"></i></div>' +
          '<div class="cc-obj-m">' + h.n + ' missions · ' +
            (h.counts["off-track"] ? h.counts["off-track"] + ' off track · ' : '') +
            (h.counts["attention"] ? h.counts["attention"] + ' attention · ' : '') +
            h.counts["on-track"] + ' on track</div>' +
          '<div class="cc-l2s">' + l2 + '</div>' +
          '<div class="cc-owns">' + chips + '</div></div>';
      }).join("") + '</div>';
    }

    view.innerHTML = '<div class="cfo-wrap">' +
      renderHero(p) + renderScorecard(p) + renderHeatmap(p) + renderAttention(p) +
      '<div class="cc-fold"><span>Enterprise detail</span></div>' +
      tabBar(p, tab) +
      '<div class="cc-body"><div class="cc-blurb">' + esc(td.blurb || "") + '</div>' + body + '</div>' +
      (S().custom ? customiseOverlay(p) : '') + '</div>';

    view.querySelectorAll("[data-owner]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var pid = b.dataset.owner, pp = personaById(pid);
        if (!pp) return;
        S().persona = pid; S().tab = (pp.activeTabs || ["pulse"])[0]; S().custom = false;
        window.PIQ.go("cc");
      };
    });
    bindDashboard(view, p);
  }

  /* ====================================================================== */
  /* ABOVE THE FOLD — the strategic command strip                            */
  /*   hero · KPI scorecard · health heatmap · attention strip               */
  /* Every number here is derived from the persona's own missions and        */
  /* capabilities in the generator — nothing is hardcoded per persona.       */
  /* ====================================================================== */
  var COLLAPSED = {};   // missionId -> collapsed?

  function renderHero(p) {
    var caps = p.isOverview ? (CC.meta.counts.capabilities) : p.capabilityCount;
    var miss = p.isOverview ? (CC.meta.counts.missions) : p.missionCount;
    return '<div class="cc-hero">' +
      '<div class="cc-hero-l">' +
        '<div class="cc-hero-n">' + esc(p.label) + '</div>' +
        '<div class="cc-hero-h">' + esc(p.headline) + '</div>' +
        '<div class="cc-hero-m">' +
          (p.isOverview ? '<b>' + CC.meta.counts.objectives + '</b> objectives · ' : '') +
          '<b>' + miss + '</b> missions · <b>' + caps + '</b> capabilities' +
        '</div>' +
      '</div>' +
      '<div class="cc-hero-r"><span>As of</span><b>' + esc(CC.meta.asOfDate) + '</b></div>' +
      '</div>';
  }

  // the arrow is direction of travel; the colour is whether that is good. A count or a
  // ratio (health, automation) has no direction of travel, so it gets no arrow at all.
  function statTile(t) {
    var dir = t.direction === "worse" ? "bad" : t.direction === "flat" ? "flat" : "good";
    var glyph = t.noArrow ? "" : t.direction === "flat" ? "→ "
      : /^-|^−|^▼/.test(String(t.delta)) ? "▼ " : "▲ ";
    return '<div class="cc-st ' + (t.cls || "") + '">' +
      '<b>' + esc(t.value) + '</b>' +
      '<span class="cc-st-l">' + esc(t.label) + '</span>' +
      (t.delta ? '<span class="cc-st-d ' + dir + '">' + glyph + esc(t.delta) + '</span>' : '') +
      (t.sub ? '<span class="cc-st-s">' + esc(t.sub) + '</span>' : '') +
      '</div>';
  }

  // first tile is ALWAYS mission health; last is ALWAYS the automation ratio.
  function renderScorecard(p) {
    var h = p.health, a = p.automation;
    var tiles = [{
      value: h.onTrack + "/" + h.total, label: "On track", cls: "health", noArrow: true,
      delta: (h.attention + h.offTrack) ? (h.attention + h.offTrack) + " flagged" : "all healthy",
      direction: (h.attention + h.offTrack) ? "worse" : "better",
      sub: h.pct + "% healthy",
    }];

    if (p.isOverview) {
      (CC.meta.enterpriseKPIs || []).forEach(function (k) { tiles.push(k); });
    } else {
      (p.headlineCaps || []).forEach(function (cid) {
        var c = CAP[cid];
        if (!c || !c.metric) return;
        tiles.push({ value: c.metric.value, label: c.label, sub: c.metric.sub,
          delta: c.metric.delta, direction: c.metric.direction });
      });
    }

    tiles.push({
      value: a.covered + "/" + a.total, label: "Agent covered", cls: "auto", noArrow: true,
      delta: Math.round((a.covered / (a.total || 1)) * 100) + "% coverage",
      direction: "flat", sub: "missions with agent coverage",
    });
    return '<div class="cc-scorecard">' + tiles.map(statTile).join("") + '</div>';
  }

  // one coloured block per mission, rows = lenses (or objectives, for the CFO).
  // Clicking a block scrolls to that mission card below the fold.
  function renderHeatmap(p) {
    var rows;
    if (p.isOverview) {
      rows = Object.keys(OBJ).map(function (oid) {
        return { label: oid + " · " + OBJ[oid].name, ms: objMissions(oid), obj: oid };
      });
    } else {
      rows = TABS.filter(function (t) { return (p.activeTabs || []).indexOf(t.id) >= 0; })
        .map(function (t) {
          return { label: t.label, ms: ((p.tabs || {})[t.id] || {}).missions || [], tab: t.id };
        });
    }

    var grid = rows.map(function (r) {
      return '<div class="cc-hm-row">' +
        '<span class="cc-hm-l">' + esc(r.label) + '</span>' +
        '<span class="cc-hm-blocks">' + r.ms.map(function (m) {
          var mm = MIS[m];
          return '<button class="cc-hm-b ' + mm.status + '" data-jump="' + m + '"' +
            (r.tab ? ' data-tab="' + r.tab + '"' : '') +
            ' title="' + esc(m + " · " + mm.name + " — " + mm.status) + '"></button>';
        }).join("") + '</span></div>';
    }).join("");

    // 12-week % on-track sparkline
    var tr = p.trend12 || [], w = 220, h = 46, pad = 3;
    var mm = mnmx(tr), lo = Math.max(0, mm[0] - 6), hi = Math.min(100, mm[1] + 6);
    var line = gapped(tr, lo, hi, w, h, pad);
    var area = line ? line + " L" + (w - pad) + "," + (h - pad) + " L" + pad + "," + (h - pad) + " Z" : "";

    return '<div class="cc-hm">' +
      '<div class="cc-hm-head"><b>Mission health</b>' +
        '<span class="cc-hm-key"><i class="on-track"></i>On track<i class="attention"></i>Attention' +
        '<i class="off-track"></i>Off track</span></div>' +
      '<div class="cc-hm-body"><div class="cc-hm-grid">' + grid + '</div>' +
        '<div class="cc-hm-spark"><span class="cc-hm-sl">12-week trend<b>' +
          (tr[tr.length - 1] || 0) + '% on track</b></span>' +
          '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
            '<path d="' + area + '" fill="var(--act)" opacity="0.12"/>' +
            '<path d="' + line + '" fill="none" stroke="var(--act)" stroke-width="2"/>' +
          '</svg></div>' +
      '</div></div>';
  }

  // conditional — only rendered when at least one mission is flagged
  function renderAttention(p) {
    var f = p.flagged || [];
    if (!f.length) return "";
    var top = f.slice(0, 3).map(function (m) {
      var mm = MIS[m], own = personaById(mm.owner);
      return '<button class="cc-at-m" data-jump="' + m + '" data-tab="' + mm.tab + '">' +
        '<b>' + m + '</b> ' + esc(mm.name) +
        (p.isOverview && own ? ' <i>' + own.icon + " " + esc(own.label) + '</i>' : '') + '</button>';
    }).join('<span class="cc-at-sep">·</span>');
    return '<div class="cc-attention">' +
      '<span class="cc-at-w">⚠ ' + f.length + ' mission' + (f.length > 1 ? "s" : "") + ' need attention</span>' +
      '<span class="cc-at-list">' + top + '</span>' +
      '<button class="cc-at-all" data-jump="' + f[0] + '" data-tab="' + MIS[f[0]].tab + '">View all →</button>' +
      '</div>';
  }

  /* ====================================================================== */
  /* BELOW THE FOLD — sticky tab bar + mission cards                         */
  /* ====================================================================== */
  function tabBar(p, active) {
    return '<div class="cc-tabbar" id="ccTabbar">' +
      TABS.filter(function (t) { return (p.activeTabs || []).indexOf(t.id) >= 0; })
        .map(function (t) {
          var n = p.isOverview ? 0 : (((p.tabs || {})[t.id] || {}).missions || []).length;
          return '<button class="cc-tb' + (active === t.id ? " on" : "") + '" data-t="' + t.id + '">' +
            esc(t.label) + (n ? ' <span class="cc-tb-n">' + n + '</span>' : '') + '</button>';
        }).join("") +
      '<span class="cc-tb-cad">' + esc((tabDef(active).cadences) || "") + '</span></div>';
  }

  function missionCard(mid, lay) {
    var m = MIS[mid];
    if (!m) return "";
    var col = !!COLLAPSED[mid];
    var caps = (m.capabilities || []).filter(function (c) { return lay.indexOf(c) >= 0; });
    caps.sort(function (a, b) { return lay.indexOf(a) - lay.indexOf(b); });
    var l2name = (OBJ[m.objective] && OBJ[m.objective].l2[m.l2]) ? OBJ[m.objective].l2[m.l2].name : m.l2;

    var body = col ? "" : (caps.length
      ? '<div class="mc-caps">' + caps.map(function (c) { return capWidget(c, mid); }).join("") + '</div>'
      : '<div class="mc-empty">All of this mission\'s capabilities were removed from your layout. ' +
        'Add them back from <b>Customize</b>.</div>');

    var foot = col ? "" :
      '<div class="mc-act">' +
        '<span class="mc-a"><i>Last action</i>' + esc(m.lastAction) + '</span>' +
        '<span class="mc-a"><i>Next action</i>' + esc(m.nextAction) + '</span>' +
        '<button class="cc-inbuilder" data-view="fitment">View in Builder →</button>' +
      '</div>';

    return '<div class="mc ' + m.status + (col ? " collapsed" : "") + '" data-m="' + mid + '" id="mc-' + mid + '">' +
      '<button class="mc-head" data-toggle="' + mid + '">' +
        '<span class="mc-dot ' + m.status + '" title="' + m.status + '"></span>' +
        '<span class="mc-id">' + mid + '</span>' +
        '<span class="mc-name">' + esc(m.name) + '</span>' +
        (col ? '<span class="mc-sum">' + caps.length + ' capabilit' + (caps.length === 1 ? "y" : "ies") +
          ' · ' + esc(m.cadence) + '</span>' : '') +
        '<span class="mc-caret">' + (col ? "▸" : "▾") + '</span>' +
      '</button>' +
      (col ? "" : '<div class="mc-meta"><span class="mc-cad">' + esc(m.cadence) + '</span>' +
        '<span class="mc-obj">Obj ' + m.objective + ' · ' + esc(l2name) + '</span>' +
        (m.agentCoverage ? '<span class="mc-agent">⚡ agent covered</span>' : '') +
        '</div>') +
      body + foot + '</div>';
  }

  function renderPersona(view, p) {
    var tab = window.PIQ.ccTab(p);
    var td = tabDef(tab);
    var lay = layout(p);

    // flagged missions sort to the top of the lens
    var mids = (((p.tabs || {})[tab] || {}).missions || []).slice();
    var SEV = { "off-track": 0, "attention": 1, "on-track": 2 };
    mids.sort(function (a, b) {
      var d = SEV[MIS[a].status] - SEV[MIS[b].status];
      return d !== 0 ? d : (+a.slice(1) - +b.slice(1));
    });

    // capabilities the SME added that belong to none of this persona's missions
    var own = {};
    (p.missions || []).forEach(function (m) {
      (MIS[m].capabilities || []).forEach(function (c) { own[c] = 1; });
    });
    var extra = lay.filter(function (c) { return !own[c]; });

    var cards = mids.length
      ? mids.map(function (m) { return missionCard(m, lay); }).join("")
      : '<div class="cc-soon"><span class="cc-soon-ic">' + p.icon + '</span><h3>No missions at this cadence</h3>' +
        '<p>' + esc(p.label) + ' owns no ' + esc((td.cadences || "").toLowerCase()) + ' mission.</p></div>';

    if (extra.length) {
      cards += '<div class="mc added"><div class="mc-head static"><span class="mc-id">+</span>' +
        '<span class="mc-name">Added widgets</span></div>' +
        '<div class="mc-meta"><span class="mc-cad">from other missions</span></div>' +
        '<div class="mc-caps">' + extra.map(function (c) { return capWidget(c, null); }).join("") + '</div></div>';
    }

    view.innerHTML = '<div class="cfo-wrap">' +
      renderHero(p) + renderScorecard(p) + renderHeatmap(p) + renderAttention(p) +
      '<div class="cc-fold"><span>Mission detail</span></div>' +
      tabBar(p, tab) +
      '<div class="cc-body"><div class="cc-blurb">' + esc(td.blurb || "") + '</div>' + cards + '</div>' +
      (S().custom ? customiseOverlay(p) : '') + '</div>';

    bindDashboard(view, p);
  }

  /* shared wiring for both the persona dashboard and the CFO roll-up */
  function bindDashboard(view, p) {
    // sticky tab bar
    view.querySelectorAll(".cc-tb").forEach(function (b) {
      b.onclick = function () { S().tab = b.dataset.t; S().custom = false; window.PIQ.go("cc"); };
    });
    // collapse / expand a mission card
    view.querySelectorAll(".mc-head[data-toggle]").forEach(function (h) {
      h.onclick = function () {
        var id = h.dataset.toggle;
        COLLAPSED[id] = !COLLAPSED[id];
        render(view);
      };
    });
    view.querySelectorAll(".cc-inbuilder").forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); window.PIQ.goBuilder(b.dataset.view || "fitment"); };
    });
    // heatmap block / attention chip → scroll to the mission card, switching lens if needed
    view.querySelectorAll("[data-jump]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var mid = b.dataset.jump, want = b.dataset.tab || MIS[mid].tab;
        if (p.isOverview) {   // the CFO has no mission cards — go to the owner instead
          var own = personaById(MIS[mid].owner);
          if (!own) return;
          S().persona = own.id; S().tab = MIS[mid].tab; S().custom = false;
          window.PIQ.go("cc");
          setTimeout(function () { scrollToMission(mid); }, 60);
          return;
        }
        if (want !== window.PIQ.ccTab(p)) {
          S().tab = want;
          window.PIQ.go("cc");
          setTimeout(function () { scrollToMission(mid); }, 60);
        } else {
          scrollToMission(mid);
        }
      };
    });
    if (S().custom) bindCustomise(view, p);
  }

  function scrollToMission(mid) {
    var el = document.getElementById("mc-" + mid);
    if (!el) return;
    COLLAPSED[mid] = false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
    setTimeout(function () { el.classList.remove("flash"); }, 1400);
  }

  /* ====================================================================== */
  /* CUSTOMISE — browse capabilities by objective, reorder by drag           */
  /* ====================================================================== */
  function customiseOverlay(p) {
    var cur = layout(p);

    // catalogue grouped by the 8 L1 objectives
    var byObj = {};
    Object.keys(CAP).forEach(function (cid) {
      var o = CAP[cid].objective || "?";
      (byObj[o] = byObj[o] || []).push(CAP[cid]);
    });
    var cats = Object.keys(OBJ).map(function (oid) {
      var list = (byObj[oid] || []).sort(function (a, b) { return +a.id.slice(4) - +b.id.slice(4); });
      if (!list.length) return "";
      return '<div class="cx-cat">' + oid + ' · ' + esc(OBJ[oid].name) + '</div>' +
        list.map(function (c) {
          var on = cur.indexOf(c.id) >= 0;
          var others = (c.usedByPersonas || []).filter(function (x) { return x !== p.id; })
            .map(function (x) { var pp = personaById(x); return pp ? pp.label : x; });
          return '<label class="cx-item' + (on ? " on" : "") + '">' +
            '<input type="checkbox" data-w="' + c.id + '"' + (on ? " checked" : "") + '/>' +
            '<span class="cx-lbl">' + esc(c.label) +
              (others.length ? '<small>also used by ' + esc(others.slice(0, 3).join(", ")) +
                (others.length > 3 ? " +" + (others.length - 3) : "") + '</small>' : '') + '</span>' +
            '<span class="cx-kind">' + c.id + ' · ' + esc(c.widgetType) + '</span></label>';
        }).join("");
    }).join("");

    var order = cur.map(function (cid, i) {
      var c = CAP[cid];
      return '<div class="cx-ord" draggable="true" data-w="' + cid + '">' +
        '<span class="cx-grip">⋮⋮</span><span class="cx-on">' + (i + 1) + '</span>' +
        '<span class="cx-olbl">' + esc(c.label) + '<small>' + c.id + '</small></span>' +
        '<span class="cx-obtns"><button data-mv="up" title="Move up">↑</button>' +
        '<button data-mv="down" title="Move down">↓</button>' +
        '<button data-mv="rm" title="Remove">✕</button></span></div>';
    }).join("");

    return '<div class="cx-back"></div><div class="cx-panel">' +
      '<div class="cx-head"><b>Customize · ' + esc(p.label) + '</b>' +
        '<button class="cx-close">✕</button></div>' +
      '<div class="cx-cols">' +
        '<div class="cx-left"><div class="cx-h">Capability catalogue <small>by objective</small></div>' + cats + '</div>' +
        '<div class="cx-right"><div class="cx-h">Your layout <small>' + cur.length + ' widgets · drag to reorder</small></div>' +
          '<div class="cx-orders">' + (order ||
            '<div class="cfo-empty">No widgets. Tick some from the catalogue.</div>') + '</div></div>' +
      '</div>' +
      '<div class="cx-foot"><button class="btn ghost cx-reset">Reset to default</button>' +
        '<button class="btn go cx-done">Done</button></div></div>';
  }

  function bindCustomise(view, p) {
    var ov = view.querySelector(".cx-panel");
    if (!ov) return;
    function close() { S().custom = false; render(view); }
    view.querySelector(".cx-back").onclick = close;
    ov.querySelector(".cx-close").onclick = close;
    ov.querySelector(".cx-done").onclick = close;
    ov.querySelector(".cx-reset").onclick = function () { resetLayout(p); render(view); };

    ov.querySelectorAll(".cx-item input").forEach(function (cb) {
      cb.onchange = function () {
        var ids = layout(p), id = cb.dataset.w, i = ids.indexOf(id);
        if (cb.checked && i < 0) ids.push(id);
        if (!cb.checked && i >= 0) ids.splice(i, 1);
        saveLayout(p, ids);
        render(view);
      };
    });
    ov.querySelectorAll(".cx-ord").forEach(function (row) {
      row.querySelectorAll("button").forEach(function (b) {
        b.onclick = function () {
          var ids = layout(p), id = row.dataset.w, i = ids.indexOf(id);
          if (i < 0) return;
          if (b.dataset.mv === "rm") ids.splice(i, 1);
          else if (b.dataset.mv === "up" && i > 0) { ids.splice(i, 1); ids.splice(i - 1, 0, id); }
          else if (b.dataset.mv === "down" && i < ids.length - 1) { ids.splice(i, 1); ids.splice(i + 1, 0, id); }
          saveLayout(p, ids);
          render(view);
        };
      });

      // drag-and-drop reordering
      row.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", row.dataset.w);
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", function () { row.classList.remove("dragging"); });
      row.addEventListener("dragover", function (e) { e.preventDefault(); row.classList.add("dragover"); });
      row.addEventListener("dragleave", function () { row.classList.remove("dragover"); });
      row.addEventListener("drop", function (e) {
        e.preventDefault(); row.classList.remove("dragover");
        var src = e.dataTransfer.getData("text/plain"), dst = row.dataset.w;
        if (!src || src === dst) return;
        var ids = layout(p), from = ids.indexOf(src), to = ids.indexOf(dst);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1);
        ids.splice(to, 0, src);
        saveLayout(p, ids);
        render(view);
      });
    });
  }

  /* ====================================================================== */
  function render(view) {
    var s = S();
    var p = s.persona && personaById(s.persona);
    if (!p) { s.persona = null; s.custom = false; return renderPicker(view); }
    if (p.isOverview) return renderCFO(view, p);
    return renderPersona(view, p);
  }

  window.PIQ.modules.cc = { render: render };
})();
