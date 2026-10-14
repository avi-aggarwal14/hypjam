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

   The same channel carries cal.com's embed events, which feed analytics
   (see 90-analytics.js and README.md): booking_calendar_viewed,
   booking_calendar_failed, call_booked, call_rescheduled, call_cancelled.
   Only timing and status go to analytics, never the booking title or the
   booker's details (cal.com's booking title contains the booker's name).
   ========================================================================== */
(function () {
  'use strict';

  var box = document.querySelector('[data-book-embed]');
  if (!box) return;
  var iframe = box.querySelector('iframe');
  if (!iframe) return;

  var MIN = Math.max(560, parseInt(box.getAttribute('data-height'), 10) || 860);
  var MAX = 2000;

  iframe.addEventListener('load', function () { box.setAttribute('data-loaded', 'true'); });
  if (iframe.complete) box.setAttribute('data-loaded', 'true');

  /* ---------- analytics from cal.com's embed events ---------- */
  var track = function (name, props, opts) {
    if (typeof window.hjTrack === 'function') window.hjTrack(name, props, opts);
  };
  var seen = {};
  var once = function (key) { if (seen[key]) return false; seen[key] = true; return true; };
  var lastBooked = 0;

  function bookingProps(data) {
    var p = {};
    var start = data.startTime || data.date;
    var end = data.endTime;
    var t0 = start ? Date.parse(start) : NaN;
    var t1 = end ? Date.parse(end) : NaN;
    if (isFinite(t0)) {
      p.starts_at = new Date(t0).toISOString();
      p.days_ahead = Math.round((t0 - Date.now()) / 864e5 * 10) / 10;
    }
    if (isFinite(t0) && isFinite(t1)) p.duration_min = Math.round((t1 - t0) / 6e4);
    else if (typeof data.duration === 'number') p.duration_min = data.duration;
    if (data.status) p.status = String(data.status).toLowerCase();
    if (typeof data.confirmed === 'boolean') p.confirmed = data.confirmed;
    if (typeof data.isRecurring === 'boolean') p.is_recurring = data.isRecurring;
    if (typeof data.paymentRequired === 'boolean') p.payment_required = data.paymentRequired;
    return p;
  }

  function calEvent(type, data) {
    data = data || {};
    if (window.hjDebug && window.console) console.log('[cal.com]', type);
    switch (type) {
      /* a plain iframe (no cal.com embed.js on this page) never gets linkReady or
         bookerViewed; availabilityLoaded and navigatedToBooker are what arrive */
      case 'availabilityLoaded':
      case 'bookerReady':
      case 'bookerViewed':
      case 'linkReady':
      case 'navigatedToBooker':
        if (once('viewed')) track('booking_calendar_viewed', { trigger: type, slots_loaded: type === 'navigatedToBooker' ? false : data.slotsLoaded !== false });
        break;
      case 'linkFailed':
        if (once('failed')) track('booking_calendar_failed', { code: String(data.code || '') });
        break;
      case 'bookingSuccessfulV2':
      case 'bookingSuccessful':
        /* cal.com fires both the old and the new event for one booking */
        if (Date.now() - lastBooked < 15000) break;
        lastBooked = Date.now();
        track('call_booked', bookingProps(data), { send_instantly: true });
        break;
      case 'rescheduleBookingSuccessfulV2':
      case 'rescheduleBookingSuccessful':
        if (once('rescheduled')) track('call_rescheduled', bookingProps(data), { send_instantly: true });
        break;
      case 'bookingCancelled':
        if (once('cancelled')) track('call_cancelled', {}, { send_instantly: true });
        break;
    }
  }

  /* honour cal.com's height messages, and only cal.com's */
  window.addEventListener('message', function (e) {
    if (e.source !== iframe.contentWindow) return;
    var origin = String(e.origin || '');
    if (!/^https:\/\/([a-z0-9-]+\.)*cal\.com$/i.test(origin)) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    var arg = d.arg || d.data || {};
    var h = 0;
    if (d.method === '__dimensionChanged' || d.type === '__dimensionChanged') h = parseFloat(arg.iframeHeight);
    else if (typeof d.iframeHeight === 'number') h = d.iframeHeight;
    if (h && isFinite(h)) iframe.style.height = Math.min(MAX, Math.max(MIN, Math.ceil(h))) + 'px';
    var type = typeof d.type === 'string' ? d.type : (typeof d.method === 'string' ? d.method : '');
    if (type && type.charAt(0) !== '_') calEvent(type, arg);
  });
})();
