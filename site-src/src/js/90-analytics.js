/* ==========================================================================
   90-analytics.js — the site's own analytics events.

   PostHog itself is set up in partials/analytics.html (cookieless, EU). This
   file only names the moments that matter, so the dashboard does not have to
   be rebuilt from raw autocapture clicks:

     book_call_clicked     any link to /book or to the cal.com booking page
     apply_clicked         any link to /apply (the creator application)
     email_link_clicked    any mailto: link
     outbound_link_clicked any link that leaves hypjam.com (create.hypjam.com,
                           cal.com/privacy, social profiles ...)
     page_not_found        the 404 page, with the referrer, to find broken links

   cta_location says where on the page the click happened (nav, footer, the
   section's id or first class). No personal data is ever sent: link text and
   destinations only. hjTrack() is a no-op when analytics is off (the owner's
   own browser, local previews, or a content blocker).
   ========================================================================== */
(function () {
  'use strict';

  var track = function (name, props, opts) {
    if (typeof window.hjTrack === 'function') window.hjTrack(name, props, opts);
  };
  /* the click is about to navigate away: send now rather than in the next batch */
  var LEAVING = { send_instantly: true, transport: 'sendBeacon' };

  function cleanText(el) {
    var t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 80);
  }

  function locationOf(el) {
    var n = el;
    while (n && n.nodeType === 1 && n !== document.body) {
      var named = n.getAttribute('data-track-location');
      if (named) return named;
      var tag = n.tagName;
      if (tag === 'NAV') return 'nav';
      if (tag === 'FOOTER') return 'footer';
      if (tag === 'HEADER') return n.className && typeof n.className === 'string' ? n.className.split(/\s+/)[0] : 'header';
      if (tag === 'SECTION' || tag === 'ASIDE' || tag === 'FORM') {
        if (n.id) return n.id;
        if (n.className && typeof n.className === 'string' && n.className.trim()) return n.className.trim().split(/\s+/)[0];
      }
      n = n.parentNode;
    }
    return 'main';
  }

  var isBookingHost = function (u) {
    return /(^|\.)cal\.com$/i.test(u.hostname) && /^\/avi-aggarwal-hypjam(\/|$)/.test(u.pathname);
  };

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var u;
    try { u = new URL(a.href, window.location.href); } catch (err) { return; }

    var base = { cta_location: locationOf(a), cta_text: cleanText(a) };
    var sameSite = u.origin === window.location.origin;
    var path = u.pathname.replace(/\/+$/, '') || '/';

    if (u.protocol === 'mailto:') {
      track('email_link_clicked', base);
      return;
    }
    if ((sameSite && path === '/book') || isBookingHost(u)) {
      base.destination = sameSite ? '/book' : 'cal.com';
      track('book_call_clicked', base, LEAVING);
      return;
    }
    if (sameSite && path === '/apply') {
      track('apply_clicked', base, LEAVING);
      return;
    }
    if (!sameSite && /^https?:$/.test(u.protocol)) {
      base.url_host = u.hostname;
      base.url = u.origin + u.pathname;
      track('outbound_link_clicked', base, LEAVING);
    }
  }, true);

  if (document.body && document.body.classList.contains('page-404')) {
    if (window.posthog && typeof window.posthog.register === 'function') {
      try { window.posthog.register({ page_type: '404' }); } catch (err) { /* analytics off */ }
    }
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).origin + new URL(document.referrer).pathname : ''; } catch (err) { ref = ''; }
    track('page_not_found', { missing_path: window.location.pathname, referrer: ref });
  }
})();
