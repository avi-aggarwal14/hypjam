/* ==========================================================================
   00-lenis.js — smooth scroll + GSAP plugin registration (CONTRACT §4)
   Runs first in site.js. Vendor globals (gsap, ScrollTrigger, CustomEase,
   Lenis) are loaded with `defer` before site.js, so they exist here.
   Exposes:
     window.getLenis()          -> the Lenis instance, or null (reduced motion / no lib)
     window.scrollToY(y, opts)  -> scroll via Lenis when present, else native
   Sets <html data-motion="full|reduced"> so CSS/JS can branch on it.
   ========================================================================== */
(function () {
  'use strict';

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduce = !!(mq && mq.matches);
  document.documentElement.setAttribute('data-motion', reduce ? 'reduced' : 'full');

  var g = window.gsap;
  if (g) {
    var plugins = [];
    if (window.ScrollTrigger) plugins.push(window.ScrollTrigger);
    if (window.CustomEase) plugins.push(window.CustomEase);
    if (plugins.length) g.registerPlugin.apply(g, plugins);
  }

  var lenis = null;
  if (!reduce && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 1
    });
    if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);
    if (g) {
      g.ticker.add(function (time) { lenis.raf(time * 1000); });
      g.ticker.lagSmoothing(0);
    } else {
      window.requestAnimationFrame(function raf(time) { lenis.raf(time); window.requestAnimationFrame(raf); });
    }
  }

  window.getLenis = function () { return lenis; };
  window.scrollToY = function (y, opts) {
    if (lenis) { lenis.scrollTo(y, opts || {}); return; }
    window.scrollTo({ top: y, left: 0, behavior: reduce ? 'auto' : 'smooth' });
  };
})();
