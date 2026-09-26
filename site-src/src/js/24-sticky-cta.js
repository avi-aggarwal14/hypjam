/* ==========================================================================
   24-sticky-cta.js — shows the phone "Book a call" bar (.scta) when it helps.
   Shown when: the viewport is ≤ 760px, the page has scrolled past ~70% of the
   first screen, and nothing that already asks for the call is on screen:
   another booking CTA ([data-cta], e.g. the hero's and the comparison's
   buttons), a closing card (.page-section--closing) or the footer.
   Never on /book. inert + aria-hidden while hidden.
   CTAs inside .nav or any position: fixed ancestor are ignored: they are
   always on screen, so watching them would keep the bar hidden for good.
   ========================================================================== */
(function () {
  'use strict';
  var bar = document.querySelector('[data-scta]');
  if (!bar) return;
  if (/^\/book\/?$/.test(location.pathname) || document.body.classList.contains('page-book')) { bar.remove(); return; }
  var MQ = window.matchMedia('(max-width: 760px)');
  var visible = new Set();
  var past = false;

  function update() {
    var show = MQ.matches && past && visible.size === 0;
    bar.dataset.shown = show ? 'true' : 'false';
    if (show) { bar.removeAttribute('inert'); bar.setAttribute('aria-hidden', 'false'); }
    else { bar.setAttribute('inert', ''); bar.setAttribute('aria-hidden', 'true'); }
    document.body.classList.toggle('has-scta', MQ.matches);
  }
  function onScroll() {
    var p = (window.scrollY || 0) > window.innerHeight * .7;
    if (p !== past) { past = p; update(); }
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      update();
    }, { threshold: 0 });
    // anything fixed (the nav pill, a fixed header) is always "on screen"; watching it would
    // keep the bar hidden for good, so only in-flow CTAs count
    var inFixed = function (el) {
      for (var n = el; n && n !== document.body; n = n.parentElement) {
        if (window.getComputedStyle(n).position === 'fixed') return true;
      }
      return false;
    };
    var watch = function () {
      document.querySelectorAll('[data-cta], .page-section--closing, #footer').forEach(function (el) {
        if (bar.contains(el) || el.closest('.nav') || inFixed(el)) return;
        io.observe(el);
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  if (MQ.addEventListener) MQ.addEventListener('change', update); else if (MQ.addListener) MQ.addListener(update);
  onScroll(); update();
})();
