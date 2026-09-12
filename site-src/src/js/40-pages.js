/* ==========================================================================
   40-pages.js — behaviour for the shared sub-page blocks in 40-pages.css.
   - .page-feature__bullets: one <details class="page-bullet"> open per block
   - [data-count]: the four facts count up from 0 when they scroll into view
   - .page-panel: gets .is-in when visible (drives the mock stagger/fill CSS)
   - .mock-phone__tc[data-tc]: running timecode · .mock-ticker: cycling lines
   Reduced motion: no counting, no ticking, everything at its final state.
   Exposes window.hypjamPages = { refresh } for pages that inject blocks later.
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- ↳ bullet accordions: exclusive within a block ---------------------- */
  function initBullets(root) {
    var groups = (root || document).querySelectorAll('.page-feature__bullets');
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].__pagesBound) continue;
      groups[i].__pagesBound = true;
      // toggle does not bubble; listen in the capture phase on the group
      groups[i].addEventListener('toggle', function (e) {
        var d = e.target;
        if (!d.open || !d.classList.contains('page-bullet')) return;
        var open = this.querySelectorAll('details.page-bullet[open]');
        for (var j = 0; j < open.length; j++) if (open[j] !== d) open[j].open = false;
      }, true);
    }
  }

  /* ---- count-up facts ------------------------------------------------------ */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    if (reduce || target === 0) { el.textContent = String(target); return; }
    var dur = 1100 + Math.min(target, 40) * 12;
    var t0 = null;
    el.textContent = '0';
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = String(Math.round(easeOut(p) * target));
      if (p < 1) requestAnimationFrame(frame); else el.textContent = String(target);
    }
    requestAnimationFrame(frame);
  }

  /* ---- timecode + ticker loops -------------------------------------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(s) { return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
  function startTimecode(el) {
    if (el.__pagesTc) return;
    var s = parseInt(el.getAttribute('data-tc'), 10) || 0;
    el.textContent = fmt(s);
    if (reduce) return;
    el.__pagesTc = setInterval(function () {
      s = (s + 1) % 600;
      el.textContent = fmt(s);
    }, 1000);
  }
  function startTicker(el) {
    if (el.__pagesTicker) return;
    var lines = el.querySelectorAll('span');
    if (!lines.length) return;
    var i = 0;
    lines[0].classList.add('is-on');
    if (reduce || lines.length < 2) return;
    el.__pagesTicker = setInterval(function () {
      lines[i].classList.remove('is-on');
      i = (i + 1) % lines.length;
      lines[i].classList.add('is-on');
    }, 1800);
  }

  /* ---- visibility observer ------------------------------------------------ */
  var io = null;
  function onVisible(el) {
    if (el.classList.contains('page-panel')) {
      el.classList.add('is-in');
      var tcs = el.querySelectorAll('.mock-phone__tc[data-tc]');
      for (var i = 0; i < tcs.length; i++) startTimecode(tcs[i]);
      var tks = el.querySelectorAll('.mock-ticker');
      for (var j = 0; j < tks.length; j++) startTicker(tks[j]);
    }
    if (el.hasAttribute('data-count')) countUp(el);
  }
  function observe(el) {
    if (el.__pagesSeen) return;
    el.__pagesSeen = true;
    if (!io) { onVisible(el); return; }
    io.observe(el);
  }
  function initObserver() {
    if (!('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        onVisible(entries[i].target);
        io.unobserve(entries[i].target);
      }
    }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' });
  }

  function refresh(root) {
    root = root || document;
    initBullets(root);
    var panels = root.querySelectorAll('.page-panel');
    for (var i = 0; i < panels.length; i++) observe(panels[i]);
    var counts = root.querySelectorAll('[data-count]');
    for (var j = 0; j < counts.length; j++) observe(counts[j]);
  }

  function boot() {
    if (!document.querySelector('.page')) return;
    initObserver();
    refresh(document);
  }

  window.hypjamPages = { refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
