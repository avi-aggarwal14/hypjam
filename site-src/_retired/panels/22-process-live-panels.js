/* ==========================================================================
   22-process.js — the product-panel stills in "How a sprint runs".
   Each step card shows one of the hero's product panels (src/panels/*.js)
   as a still: mounted once, a screen before it scrolls into view, then
   parked on its finished frame (the timeline's `final` label) so the card
   shows the outcome of that step. Nothing plays, loops or waits on scroll;
   the text never depends on this script. The panel is drawn at its native
   321px and scaled to the card with --pnl-scale.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('[data-p5]');
  if (!root) return;
  var hosts = Array.prototype.slice.call(root.querySelectorAll('[data-p5-panel]'));
  var raf = 0, mounted = false;

  function fit() {
    hosts.forEach(function (h) {
      var w = h.clientWidth;
      if (w) h.style.setProperty('--pnl-scale', String(w / 321));
    });
  }
  function settle(tl) {
    try {
      tl.pause();
      var labels = tl.labels || {};
      if (labels.final != null) tl.seek('final', false);
      else tl.progress(1, false);
    } catch (e) {}
  }
  function mountAll() {
    if (mounted) return;
    mounted = true;
    hosts.forEach(function (h) {
      var pnl = h.querySelector('[data-panel]');
      var ph = pnl ? parseInt(pnl.getAttribute('data-panel-height'), 10) : NaN;
      h.style.setProperty('--p5-ph', isFinite(ph) && ph > 0 ? ph : 184);
      var name = h.dataset.panelName || (pnl && pnl.dataset.panel);
      var reg = window.hypjamPanels && name ? window.hypjamPanels[name] : null;
      if (!pnl || !reg || typeof reg.mount !== 'function' || !window.gsap) return;
      try { var tl = reg.mount(pnl, { autoplay: false, reduced: true }); if (tl) settle(tl); }
      catch (e) { if (window.console) console.warn('[process] panel "' + name + '" failed to mount', e); }
    });
    fit();
  }

  function start() {
    window.addEventListener('resize', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); });
    fit();
    if (!('IntersectionObserver' in window)) { mountAll(); return; }
    var io = new IntersectionObserver(function (en) {
      if (en.some(function (e) { return e.isIntersecting; })) { mountAll(); io.disconnect(); }
    }, { rootMargin: '800px 0px' });
    io.observe(root);
  }
  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
