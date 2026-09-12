/* ==========================================================================
   21-hero-mobile.js — Lance's phone experience for the hero (≤ 1024px).
   Port of the `e_` component in ref/hero_chunk.pretty.js (lines 19391–19680):
     · video screen: paragraph + walk hint fade in on mount (Lance fades its
       h1 / sub / button at .15 / .35 / .5s), the hint scrolls to the body;
     · black body: marquee, the whole drawing (viewBox = bbox + 2% margin,
       details hidden, fades drawn) which draws itself in over 3.2s the
       first time 15% of it is on screen;
     · accordion (`eb`): one open row at a time, grid-template-rows
       transition, the panel mounts and plays while open;
     · outcomes (`ek`): the numbers count up (1100ms, 160ms per item) the
       first time 25% of the section is visible.
   Registers window.hypjamHero.mobile = { init, destroy }; 20-hero.js
   calls init()/destroy() when the mode flips at 1024px.
   ========================================================================== */
(function () {
  'use strict';
  var H = window.hypjamHero;
  if (!H || !H.util) return;
  var U = H.util;

  var root = document.querySelector('[data-hero-mobile]');
  if (!root) return;

  var state = { inited: false, observers: [], intro: null, drawTl: null, drawn: false, open: -1, mounted: false, svg: null };

  function init() {
    if (state.inited) return;
    state.inited = true;
    var reduce = U.reduced();
    var gsap = window.gsap;

    /* video: load lazily (the desktop stage owns the eager one) */
    var vid = root.querySelector('.hero-m-vid');
    if (vid && !vid.getAttribute('src') && vid.dataset.src) {
      vid.setAttribute('src', vid.dataset.src);
      vid.load();
      var p = vid.play(); if (p && p.catch) p.catch(function () {});
    }

    /* intro fades (Lance: h1 .7s @ .15, sub .6s @ .35, button .55s @ .5) */
    var para = root.querySelector('[data-hero-m-p]');
    var walk = root.querySelector('[data-hero-m-walk]');
    U.initWalk(walk, function () {
      var body = root.querySelector('[data-hero-m-body]');
      if (body) body.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    if (reduce || !gsap) {
      if (para) para.style.opacity = '1';
      if (walk) walk.style.opacity = '1';
    } else {
      gsap.set([para, walk].filter(Boolean), { opacity: 0 });
      state.intro = gsap.timeline({ defaults: { ease: 'power2.out' } });
      if (para) state.intro.to(para, { opacity: 1, duration: .7 }, .15);
      if (walk) state.intro.to(walk, { opacity: 1, duration: .55 }, .5);
    }

    /* marquee: six groups like Lance */
    root.querySelectorAll('[data-hero-marquee-track]').forEach(U.fillMarquee);

    /* panels: size the hosts, mount paused */
    U.mountPanels(root, reduce);
    root.querySelectorAll('[data-hero-m-panel-box]').forEach(function (box) {
      var panel = box.querySelector('[data-hero-panel]');
      var h = panel ? U.panelHeight(panel) : 184;
      box.style.aspectRatio = '321 / ' + h;
      if (panel) panel.style.height = h + 'px';
    });
    fitPanels();
    window.addEventListener('resize', fitPanels);

    /* accordion */
    root.querySelectorAll('[data-hero-m-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggle(+btn.dataset.index); });
    });

    /* drawing: fetch, whole-drawing viewBox, draw in when 15% visible */
    var map = root.querySelector('[data-hero-m-map]');
    var stage = root.querySelector('[data-hero-m-drawing]');
    if (map && stage) {
      U.loadDrawing().then(function (text) {
        if (!state.inited || !text) return;
        map.innerHTML = text;
        var svg = map.querySelector('svg');
        if (!svg) return;
        state.svg = svg;
        U.prepSvg(svg);
        var b = U.CAM.bbox, c = .02 * b[2];
        svg.setAttribute('viewBox', (b[0] - c) + ' ' + (b[1] - c) + ' ' + (b[2] + 2 * c) + ' ' + (b[3] + 2 * c));
        U.STOPS.forEach(function (s) {
          var d = svg.querySelector('[id="' + s.detailId + '"]'); if (d) d.style.display = 'none';
          var f = svg.querySelector('[id="' + s.fadeId + '"]'); if (f) U.writeSettled(U.collect(f), true);
        });
        var hotel = svg.querySelector('[id="hotel-drawing"]');
        if (!hotel) return;
        var col = U.collect(hotel);
        U.writeSettled(col, false);
        var scale = function () { var r = stage.getBoundingClientRect(); return r.width / (b[2] + 2 * c); };
        var drawIn = function () {
          if (state.drawn) return;
          state.drawn = true;
          if (reduce || !gsap) { U.writeSettled(col, true); return; }
          var seg = { t0: 0, dur: 3.2, dir: 'in' };
          var prox = { t: 0 };
          state.drawTl = gsap.timeline({ onComplete: function () { U.writeSettled(col, true); } });
          state.drawTl.to(prox, { t: 3.2, duration: 3.2, ease: 'none', onUpdate: function () { U.writeLive(col, seg, prox.t, scale()); } }, 0);
        };
        var io = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting && e.intersectionRatio > .15; })) { drawIn(); io.disconnect(); }
        }, { threshold: [.15, .25] });
        io.observe(stage);
        state.observers.push(io);
      });
    }

    /* outcomes */
    var out = root.querySelector('[data-hero-m-outcomes]');
    if (out) {
      var io2 = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting && e.intersectionRatio > .25; })) {
          out.dataset.active = '1';
          U.countUp(out, true, reduce);
          io2.disconnect();
        }
      }, { threshold: [.25] });
      io2.observe(out);
      state.observers.push(io2);
    }
  }

  function fitPanels() {
    root.querySelectorAll('[data-hero-m-panel-box]').forEach(function (box) {
      var panel = box.querySelector('[data-hero-panel]');
      if (!panel) return;
      var w = box.getBoundingClientRect().width || 321;
      panel.style.setProperty('--pnl-scale', String(w / 321));
    });
  }

  function toggle(i) {
    var rows = root.querySelectorAll('[data-hero-m-toggle]');
    var regions = root.querySelectorAll('.hero-m-region');
    var next = state.open === i ? -1 : i;
    rows.forEach(function (btn, k) {
      var on = k === next;
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (regions[k]) regions[k].dataset.open = on ? 'true' : 'false';
      var panel = regions[k] && regions[k].querySelector('[data-hero-panel]');
      if (panel) U.setPanelActive(panel, on);
    });
    state.open = next;
  }

  function destroy() {
    if (!state.inited) return;
    state.inited = false;
    state.observers.forEach(function (o) { o.disconnect(); });
    state.observers = [];
    if (state.intro) { state.intro.kill(); state.intro = null; }
    if (state.drawTl) { state.drawTl.kill(); state.drawTl = null; }
    window.removeEventListener('resize', fitPanels);
    root.querySelectorAll('[data-hero-panel]').forEach(function (p) { U.setPanelActive(p, false); });
    var map = root.querySelector('[data-hero-m-map]');
    if (map) map.innerHTML = '';
    state.svg = null;
    state.drawn = false;
  }

  H.mobile = { init: init, destroy: destroy, state: state };
  /* if the engine already chose the mobile mode before this file registered, start now */
  if (H.mode === 'mobile') init();
})();
