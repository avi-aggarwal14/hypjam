/* ==========================================================================
   45-book.js — /book: the cal.com embed loads only after the visitor clicks
   "Open the calendar" (CONTRACT §11: no third-party request before a click).
   The iframe src comes from content/book.json (data-src on [data-book-embed]);
   it carries cal.com's own dark theme and is never colour-inverted here.
   cal.com posts its rendered height to the parent ({originator:"CAL",
   method:"__dimensionChanged", arg:{iframeHeight}}); when that arrives the
   frame grows to fit so the calendar never scrolls inside itself.
   window.hypjamBook = { open() }
   ========================================================================== */
(function () {
  'use strict';

  var box = document.querySelector('[data-book-embed]');
  if (!box) return;
  var btn = box.querySelector('[data-book-open]');
  var frame = box.querySelector('[data-book-frame]');
  var src = box.getAttribute('data-src');
  if (!btn || !frame || !src) return;

  /* ~700px is the height the month view needs before cal.com reports its own (see 45-book.css) */
  var MIN = Math.max(700, parseInt(box.getAttribute('data-height'), 10) || 700);
  var MAX = 1600;
  var iframe = null;

  function open() {
    if (iframe) return;
    iframe = document.createElement('iframe');
    iframe.className = 'book-iframe';
    iframe.title = box.getAttribute('data-title') || 'Book a call with hypjam';
    iframe.setAttribute('loading', 'eager');
    iframe.setAttribute('allow', 'payment');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.style.height = MIN + 'px';
    iframe.src = src;
    frame.appendChild(iframe);
    frame.hidden = false;
    box.setAttribute('data-loaded', 'true');
    btn.setAttribute('aria-expanded', 'true');
    btn.hidden = true;
    iframe.addEventListener('load', function () { frame.classList.add('is-ready'); });

    /* bring the calendar into view once it has a box */
    window.requestAnimationFrame(function () {
      var top = frame.getBoundingClientRect().top + (window.pageYOffset || 0) - 24;
      if (frame.getBoundingClientRect().bottom > window.innerHeight && top > 0) {
        if (window.scrollToY) window.scrollToY(top); else window.scrollTo(0, top);
      }
    });
  }

  btn.addEventListener('click', open);

  /* honour cal.com's height messages (only from cal.com, only after we opened it) */
  window.addEventListener('message', function (e) {
    if (!iframe || e.source !== iframe.contentWindow) return;
    var origin = String(e.origin || '');
    if (!/^https:\/\/([a-z0-9-]+\.)*cal\.com$/i.test(origin)) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    var arg = d.arg || d.data || {};
    var h = 0;
    if (d.method === '__dimensionChanged' || d.type === '__dimensionChanged') h = parseFloat(arg.iframeHeight);
    else if (typeof d.iframeHeight === 'number') h = d.iframeHeight;
    if (h && isFinite(h)) iframe.style.height = Math.min(MAX, Math.max(MIN, Math.ceil(h))) + 'px';
  });

  window.hypjamBook = { open: open };
})();
