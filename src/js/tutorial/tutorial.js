/* tutorial.js — on-screen tutorial + guided onboarding.
 *
 * A from-scratch replacement for react-joyride: this app has no React, no bundler
 * and no network (it must render from file://), so a spotlight/tooltip driver is
 * implemented here directly. Same feature set: tours, a branded tooltip, hotspots,
 * a help menu, localStorage persistence and analytics events.
 *
 * Public API — window.PIQ.tutorial:
 *   register(tour)          add a tour  (see tours.js / README.md)
 *   registerHotspot(spec)   add a pulsing dot that launches a tour
 *   startTour(id) endTour() nextStep() prevStep()
 *   isTourCompleted(id) resetTour(id) resetAll() dismissHotspot(hid)
 *   state                   { activeTour, currentStepIndex, completedTours, dismissedHotspots }
 *
 * A tour survives a page load. The Command Centre and the Builder are separate
 * page loads (PIQ.goBuilder does a real navigation), so the golden-path tour that
 * crosses between them persists {activeTour, currentStepIndex} and resumes on boot.
 * That is why a step's before() MUST be idempotent — see README.md.
 */
(function () {
  "use strict";
  var PIQ = window.PIQ;
  var LS = "processiq_tutorial_state";
  var MOBILE = 700;          // below this the tooltip becomes a bottom sheet
  var WAIT_MS = 1800;        // how long to wait for a step's target to appear
  var PAD = 6;               // spotlight padding around the target

  var TOURS = {};            // id -> tour
  var HOTSPOTS = [];         // { id, selector, tourId, title }
  var run = null;            // { tour, idx } while a tour is on screen
  var layer = null, dots = null, menu = null;
  var autoChecked = {};      // tourId -> already considered for auto-start this page

  /* ---- state ----------------------------------------------------------- */

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { s = {}; }
    return {
      activeTour: s.activeTour || null,
      currentStepIndex: s.currentStepIndex || 0,
      completedTours: s.completedTours || [],
      dismissedHotspots: s.dismissedHotspots || [],
    };
  }
  var state = load();
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }

  function isTourCompleted(id) { return state.completedTours.indexOf(id) >= 0; }

  /* ---- analytics ------------------------------------------------------- */
  // No analytics vendor is bundled. Events go out as a DOM CustomEvent so a host
  // page can forward them; PIQ.tutorial.track can be reassigned to do otherwise.
  function track(event, props) {
    var detail = { event: event, props: props || {} };
    try { window.dispatchEvent(new CustomEvent("processiq:analytics", { detail: detail })); } catch (e) {}
    if (window.console && console.debug) console.debug("[analytics]", event, detail.props);
  }

  /* ---- helpers --------------------------------------------------------- */

  function q(sel) {
    if (!sel) return null;
    var el;
    try { el = document.querySelector(sel); } catch (e) { return null; }
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return (r.width || r.height) ? el : null;   // must be laid out, not display:none
  }

  function esc(s) {
    return (s == null ? "" : String(s))
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // a step's copy may be a string or a function of the live app state
  function text(v) { return typeof v === "function" ? v() : v; }

  // poll for a selector — a step's target may arrive a frame or a render later
  function waitFor(sel, ms, cb) {
    if (!sel) return cb(null);
    var el = q(sel);
    if (el) return cb(el);
    var t0 = Date.now();
    (function poll() {
      var e = q(sel);
      if (e) return cb(e);
      if (Date.now() - t0 > ms) return cb(null);
      setTimeout(poll, 60);
    })();
  }

  /* ---- the spotlight layer --------------------------------------------- */

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "tut-layer";
    layer.id = "tutLayer";
    layer.innerHTML =
      '<div class="tut-mask t"></div><div class="tut-mask r"></div>' +
      '<div class="tut-mask b"></div><div class="tut-mask l"></div>' +
      '<div class="tut-ring"></div>' +
      '<div class="tut-tip" role="dialog" aria-modal="true" aria-labelledby="tutTipTitle"></div>';
    document.body.appendChild(layer);
    return layer;
  }

  function destroyLayer() {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null;
  }

  // Four rects around the target leave a real, clickable hole. Simpler and more
  // robust across browsers than an SVG mask, and the target stays interactive.
  function placeSpotlight(el, pad) {
    var m = layer.querySelectorAll(".tut-mask"), ring = layer.querySelector(".tut-ring");
    var W = window.innerWidth, H = window.innerHeight;
    if (!el) {                                  // centre step — mask the whole screen
      m[0].style.cssText = "top:0;left:0;right:0;bottom:0";
      m[1].style.cssText = m[2].style.cssText = m[3].style.cssText = "display:none";
      ring.style.display = "none";
      return null;
    }
    m[1].style.display = m[2].style.display = m[3].style.display = "";
    var r = el.getBoundingClientRect();
    var top = Math.max(0, r.top - pad), left = Math.max(0, r.left - pad);
    var right = Math.min(W, r.right + pad), bot = Math.min(H, r.bottom + pad);
    m[0].style.cssText = "top:0;left:0;width:100%;height:" + top + "px";
    m[1].style.cssText = "top:" + top + "px;left:" + right + "px;width:" + (W - right) + "px;height:" + (bot - top) + "px";
    m[2].style.cssText = "top:" + bot + "px;left:0;width:100%;height:" + (H - bot) + "px";
    m[3].style.cssText = "top:" + top + "px;left:0;width:" + left + "px;height:" + (bot - top) + "px";
    ring.style.display = "";
    ring.style.cssText = "display:block;top:" + top + "px;left:" + left + "px;width:" +
      (right - left) + "px;height:" + (bot - top) + "px";
    return { top: top, left: left, right: right, bottom: bot };
  }

  function placeTip(box, placement) {
    var tip = layer.querySelector(".tut-tip");
    var sheet = window.innerWidth <= MOBILE;
    tip.classList.toggle("tut-sheet", sheet);
    tip.classList.remove("tut-center", "up", "down", "left", "right");
    if (sheet) { tip.style.cssText = ""; return; }        // CSS pins the bottom sheet
    if (!box) { tip.classList.add("tut-center"); tip.style.cssText = ""; return; }

    var W = window.innerWidth, H = window.innerHeight;
    var tw = tip.offsetWidth || 380, th = tip.offsetHeight || 200, gap = 14;
    var below = H - box.bottom, above = box.top;
    var pos = placement;
    if (!pos || pos === "auto") pos = below >= th + gap ? "down" : (above >= th + gap ? "up" : (box.left > W / 2 ? "left" : "right"));

    var top, left;
    if (pos === "down" || pos === "up") {
      top = pos === "down" ? box.bottom + gap : box.top - th - gap;
      left = box.left + (box.right - box.left) / 2 - tw / 2;
    } else {
      top = box.top + (box.bottom - box.top) / 2 - th / 2;
      left = pos === "left" ? box.left - tw - gap : box.right + gap;
    }
    top = Math.max(10, Math.min(H - th - 10, top));
    left = Math.max(10, Math.min(W - tw - 10, left));
    tip.classList.add(pos);
    tip.style.cssText = "top:" + top + "px;left:" + left + "px";
  }

  /* ---- rendering a step ------------------------------------------------ */

  function paint(step, el) {
    ensureLayer();
    var tour = run.tour, n = tour.steps.length, i = run.idx;
    var tip = layer.querySelector(".tut-tip");
    var last = i === n - 1;
    tip.innerHTML =
      '<div class="tut-bar"><i style="width:' + Math.round(((i + 1) / n) * 100) + '%"></i></div>' +
      '<div class="tut-body">' +
        '<div class="tut-count">Step ' + (i + 1) + ' of ' + n + '</div>' +
        (step.title ? '<h3 id="tutTipTitle">' + esc(text(step.title)) + '</h3>' : '') +
        '<p>' + text(step.body) + '</p>' +
      '</div>' +
      '<div class="tut-acts">' +
        '<button class="tut-skip" type="button">Skip tour</button>' +
        '<span class="tut-sp"></span>' +
        (i > 0 ? '<button class="tut-back" type="button">Back</button>' : '') +
        '<button class="tut-next" type="button">' + (last ? "Done" : "Next") + '</button>' +
      '</div>';
    tip.querySelector(".tut-next").onclick = function () { last ? complete() : go(i + 1); };
    tip.querySelector(".tut-skip").onclick = skip;
    var back = tip.querySelector(".tut-back");
    if (back) back.onclick = function () { go(i - 1); };

    reposition();
    tip.querySelector(".tut-next").focus();
    track("tutorial_step_viewed", { tourId: tour.id, stepIndex: i });
  }

  function reposition() {
    if (!run || !layer) return;
    var step = run.tour.steps[run.idx];
    var el = step.target ? q(step.target) : null;
    var box = placeSpotlight(el, step.spotlightPadding == null ? PAD : step.spotlightPadding);
    placeTip(box, step.placement);
  }

  function go(i) {
    if (!run) return;
    var tour = run.tour;
    if (i >= tour.steps.length) return complete();
    if (i < 0) i = 0;
    run.idx = i;
    state.activeTour = tour.id;
    state.currentStepIndex = i;
    save();

    var step = tour.steps[i];

    // A step whose target is already on screen never re-runs its before(). That is
    // what makes resuming after a page load safe: the navigation that before() did
    // has already happened, so we paint rather than navigate again.
    if (!step.target || q(step.target)) return show(step);
    if (step.before) {
      try { step.before(); } catch (e) {
        if (window.console) console.warn("[tutorial] before() failed on " + tour.id + " step " + i, e);
      }
    }
    waitFor(step.target, WAIT_MS, function (el) {
      if (!el) {
        if (window.console) console.warn(
          "[tutorial] target not found for " + tour.id + " step " + i +
          ' ("' + step.target + '") — skipping this step');
        return go(i + 1);
      }
      show(step);
    });
  }

  // scroll the target into view, let the smooth-scroll settle, then paint
  function show(step) {
    var el = step.target ? q(step.target) : null;
    if (!el) return paint(step, null);
    var r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 80) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { if (run) paint(step, el); }, 420);
    } else {
      paint(step, el);
    }
  }

  /* ---- lifecycle ------------------------------------------------------- */

  function startTour(id) {
    var tour = TOURS[id];
    if (!tour) { if (window.console) console.warn("[tutorial] unknown tour: " + id); return; }
    if (run) endTour();
    run = { tour: tour, idx: 0 };
    ensureLayer();
    document.body.classList.add("tut-on");
    refreshHotspots();
    track("tutorial_started", { tourId: id });
    go(0);
  }

  function finish(completed) {
    if (!run) return;
    var id = run.tour.id;
    if (completed && !isTourCompleted(id)) state.completedTours.push(id);
    state.activeTour = null;
    state.currentStepIndex = 0;
    save();
    run = null;
    document.body.classList.remove("tut-on");
    destroyLayer();
    refreshHotspots();
    return id;
  }

  function complete() { var id = finish(true); if (id) track("tutorial_completed", { tourId: id }); }
  function skip() {
    if (!run) return;
    var id = run.tour.id, i = run.idx;
    finish(false);
    track("tutorial_skipped", { tourId: id, stepIndex: i });
  }
  function endTour() { finish(false); }

  /* ---- hotspots -------------------------------------------------------- */

  function registerHotspot(spec) { HOTSPOTS.push(spec); }

  function ensureDots() {
    if (dots) return dots;
    dots = document.createElement("div");
    dots.className = "tut-hots";
    dots.id = "tutHotspots";
    document.body.appendChild(dots);
    return dots;
  }

  function refreshHotspots() {
    ensureDots();
    dots.innerHTML = "";
    if (run) return;                                  // no dots while a tour is running
    HOTSPOTS.forEach(function (h) {
      if (h.tourId && isTourCompleted(h.tourId)) return;
      if (state.dismissedHotspots.indexOf(h.id) >= 0) return;
      var el = q(h.selector);
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var b = document.createElement("button");
      b.className = "tut-hot";
      b.type = "button";
      b.title = h.title || "Show me around";
      b.setAttribute("aria-label", b.title);
      b.style.top = (r.top - 5) + "px";
      b.style.left = (r.right - 7) + "px";
      b.innerHTML = '<span class="tut-hot-r"></span><span class="tut-hot-d"></span>';
      b.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        dismissHotspot(h.id);
        if (h.tourId) startTour(h.tourId);
      };
      dots.appendChild(b);
    });
  }

  function dismissHotspot(hid) {
    if (state.dismissedHotspots.indexOf(hid) < 0) state.dismissedHotspots.push(hid);
    save();
    refreshHotspots();
  }

  /* ---- help menu ------------------------------------------------------- */

  function buildMenu() {
    var btn = document.getElementById("helpBtn");
    if (!btn || menu) return;
    menu = document.createElement("div");
    menu.className = "tut-menu";
    menu.id = "tutMenu";
    menu.hidden = true;
    document.body.appendChild(menu);

    btn.onclick = function (e) {
      e.stopPropagation();
      if (!menu.hidden) return closeMenu();
      renderMenu();
      menu.hidden = false;
      var r = btn.getBoundingClientRect();
      menu.style.top = (r.bottom + 8) + "px";
      menu.style.right = Math.max(8, window.innerWidth - r.right) + "px";
    };
    document.addEventListener("click", function (e) {
      if (menu && !menu.hidden && !menu.contains(e.target)) closeMenu();
    });
  }
  function closeMenu() { if (menu) menu.hidden = true; }

  function renderMenu() {
    var items = Object.keys(TOURS).map(function (id) {
      var t = TOURS[id];
      return '<button class="tut-mi" data-tour="' + id + '">' +
        '<span class="tut-mi-n">' + esc(t.menuLabel || t.title) + '</span>' +
        (isTourCompleted(id) ? '<span class="tut-mi-d">done</span>' : '') + '</button>';
    }).join("");
    menu.innerHTML = '<div class="tut-menu-h">Learning</div>' + items +
      '<div class="tut-menu-r"></div>' +
      '<button class="tut-mi reset" data-reset="1">Reset all tutorials</button>';
    menu.querySelectorAll("[data-tour]").forEach(function (b) {
      b.onclick = function () { closeMenu(); startTour(b.dataset.tour); };
    });
    menu.querySelector("[data-reset]").onclick = function () { closeMenu(); resetAll(); };
  }

  function resetTour(id) {
    state.completedTours = state.completedTours.filter(function (t) { return t !== id; });
    save(); autoChecked = {}; refreshHotspots();
  }
  function resetAll() {
    state = { activeTour: null, currentStepIndex: 0, completedTours: [], dismissedHotspots: [] };
    save(); autoChecked = {}; refreshHotspots();
  }

  /* ---- auto-start + wiring --------------------------------------------- */

  // A tour may declare autoStart(): truthy once its surface is on screen for the
  // first time. Checked after every render of the shell.
  function checkAuto() {
    if (run) return;
    for (var id in TOURS) {
      var t = TOURS[id];
      if (!t.autoStart || autoChecked[id] || isTourCompleted(id)) continue;
      var ok = false;
      try { ok = !!t.autoStart(); } catch (e) { ok = false; }
      if (ok) { autoChecked[id] = true; return startTour(id); }
    }
  }

  var pending = null;
  function onRender() {
    clearTimeout(pending);
    pending = setTimeout(function () {
      refreshHotspots();
      checkAuto();
      if (run) reposition();
    }, 140);
  }

  function init() {
    ensureDots();
    buildMenu();

    // The shell replaces #view / #sidebar wholesale on every navigation, and cfo.js
    // re-renders in place on collapse/customise — an observer catches both, where
    // wrapping PIQ.go would miss the in-place ones.
    var host = document.getElementById("shellrow");
    if (host && window.MutationObserver) {
      new MutationObserver(onRender).observe(host, { childList: true, subtree: true });
    }
    window.addEventListener("resize", onRender);
    window.addEventListener("scroll", function () {
      if (run) reposition();
      else refreshHotspots();
    }, true);

    document.addEventListener("keydown", function (e) {
      if (!run) return;
      if (e.key === "Escape") { e.preventDefault(); skip(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(run.idx + 1); }
      else if (e.key === "ArrowLeft" && run.idx > 0) { e.preventDefault(); go(run.idx - 1); }
    });

    // Resume a tour that crossed a page load (Command Centre -> Builder). `run` is
    // claimed synchronously: the observer above can fire first, and checkAuto() must
    // see a tour already in flight or it would start a second one on top.
    if (state.activeTour && TOURS[state.activeTour]) {
      var at = state.currentStepIndex;
      run = { tour: TOURS[state.activeTour], idx: at };
      document.body.classList.add("tut-on");
      ensureLayer();
      setTimeout(function () { go(at); }, 260);
    } else {
      onRender();
    }
  }

  PIQ.tutorial = {
    register: function (t) { TOURS[t.id] = t; },
    registerHotspot: registerHotspot,
    tours: TOURS,
    startTour: startTour,
    endTour: endTour,
    nextStep: function () { if (run) go(run.idx + 1); },
    prevStep: function () { if (run) go(run.idx - 1); },
    isTourCompleted: isTourCompleted,
    resetTour: resetTour,
    resetAll: resetAll,
    dismissHotspot: dismissHotspot,
    track: track,
    init: init,
    get state() { return state; },
  };
})();
