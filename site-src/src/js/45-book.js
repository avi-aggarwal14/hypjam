/* ==========================================================================
   45-book.js — /book: size the cal.com embed to its own content.

   The iframe is now rendered straight into the page (no click gate), so the
   calendar is there for everyone, including visitors with JavaScript off.
   That is a deliberate change: /book exists to get a call booked, and a
   click-to-load step was one avoidable step in the way. The privacy policy
   states plainly that opening /book loads cal.com.

   cal.com posts its rendered height to the parent
   ({originator:"CAL", method:"__dimensionChanged", arg:{iframeHeight}});
   when that arrives the frame grows to fit so the calendar never scrolls
   inside itself.

   On phones (≤600px) cal.com's event-details block (avatar, title, the
   description, duration, location) stacks above the month grid and pushes
   the first bookable date about a screen down. The page already says all of
   that above the frame, so once the embed reports ready we ask it to hide
   that block (cal.com's own "ui" embed message; the URL parameter is
   ignored). The height floor drops too, so the short layout is not padded.
   ========================================================================== */
(function () {
  'use strict';

  var box = document.querySelector('[data-book-embed]');
  if (!box) return;
  var iframe = box.querySelector('iframe');
  if (!iframe) return;

  var PHONE = window.matchMedia('(max-width: 600px)').matches;
  var MIN = PHONE ? 420 : Math.max(560, parseInt(box.getAttribute('data-height'), 10) || 860);
  var MAX = 2000;

  iframe.addEventListener('load', function () { box.setAttribute('data-loaded', 'true'); });
  if (iframe.complete) box.setAttribute('data-loaded', 'true');

  /* honour cal.com's height messages, and only cal.com's */
  window.addEventListener('message', function (e) {
    if (e.source !== iframe.contentWindow) return;
    var origin = String(e.origin || '');
    if (!/^https:\/\/([a-z0-9-]+\.)*cal\.com$/i.test(origin)) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (PHONE && d.type === '__iframeReady') {
      iframe.contentWindow.postMessage({ originator: 'CAL', method: 'ui', arg: { hideEventTypeDetails: true } }, origin);
    }
    var arg = d.arg || d.data || {};
    var h = 0;
    if (d.method === '__dimensionChanged' || d.type === '__dimensionChanged') h = parseFloat(arg.iframeHeight);
    else if (typeof d.iframeHeight === 'number') h = d.iframeHeight;
    if (h && isFinite(h)) iframe.style.height = Math.min(MAX, Math.max(MIN, Math.ceil(h))) + 'px';
  });
})();
