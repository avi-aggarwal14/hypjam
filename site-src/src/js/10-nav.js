/* ==========================================================================
   10-nav.js — nav behaviour
   1. Theme + fill: every scroll frame, find the deepest element carrying a
      data-nav attribute that sits under the nav's vertical midpoint and copy
      its data-nav ("dark" | "light" | "image") to nav[data-theme] and its
      data-nav-fill ("bg-transparent" | "bg-black" | "bg-white" | "bg-grey-s"
      | "bg-sand-s" | "bg-sand-m") to nav[data-fill]. Pages set these on
      <body> or on sections; the hero engine flips them at runtime, which a
      MutationObserver picks up without a scroll.
   2. Dropdowns: hover / focus / click open, 120ms leave grace, Escape closes.
   3. Mobile: "Menu" opens the full-screen accordion, locks body scroll
      (html.nav-lock + lenis.stop()), "Close" / Escape / a link click closes.
   window.hypjamNav = { refresh, closeMenus, closeMobile }
   ========================================================================== */
(function () {
  'use strict';

  var nav = document.querySelector('.nav');
  if (!nav) return;

  var html = document.documentElement;
  var reduce = html.getAttribute('data-motion') === 'reduced';

  /* ---- 1. theme + fill from the section under the nav -------------------- */
  var current = { theme: null, fill: null };

  function sectionUnderNav() {
    var y = (nav.offsetHeight || 88) / 2;
    var els = document.querySelectorAll('[data-nav]');
    var best = null;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === nav || nav.contains(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.height === 0 && r.width === 0) continue;
      if (r.top <= y && r.bottom > y) best = el; /* later in DOM order = deeper / more specific */
    }
    return best;
  }

  function apply() {
    var el = sectionUnderNav();
    var theme = 'dark';
    var fill = 'bg-transparent';
    if (el) {
      var t = el.getAttribute('data-nav');
      theme = (t === 'light') ? 'light' : 'dark';
      var f = el.getAttribute('data-nav-fill');
      if (f) fill = f;
    }
    if (nav.getAttribute('data-open') === 'true') { theme = 'dark'; fill = 'bg-transparent'; }
    if (theme !== current.theme) { current.theme = theme; nav.setAttribute('data-theme', theme); }
    if (fill !== current.fill) { current.fill = fill; nav.setAttribute('data-fill', fill); }
  }

  var queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () { queued = false; apply(); });
  }

  window.addEventListener('scroll', refresh, { passive: true });
  window.addEventListener('resize', refresh);
  window.addEventListener('load', refresh);
  if (window.MutationObserver) {
    new MutationObserver(refresh).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-nav', 'data-nav-fill'],
      childList: true,
      subtree: true
    });
  }
  apply();

  /* ---- 2. desktop dropdowns ---------------------------------------------- */
  var items = Array.prototype.slice.call(nav.querySelectorAll('.nav-item'));
  var openItem = null;
  var leaveTimer = 0;

  /* the Resources clip: poster until the menu first opens, then a muted loop;
     paused while closed; never started under reduced motion */
  function clip(item, play) {
    var video = item.querySelector('.nav-menu-clip');
    if (!video) return;
    var frame = video.parentElement;
    if (!play) { if (!video.paused) video.pause(); return; }
    if (reduce) return;
    if (!video.getAttribute('src') && video.dataset.src) {
      video.setAttribute('src', video.dataset.src);
      video.addEventListener('playing', function () { frame.classList.add('is-playing'); });
      video.addEventListener('error', function () { frame.classList.remove('is-playing'); video.removeAttribute('src'); }, { once: true });
    }
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function setMenuState(item, open) {
    var trigger = item.querySelector('.nav-trigger');
    var menu = item.querySelector('.nav-menu');
    item.classList.toggle('is-open', open);
    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (menu) {
      if (open) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
    }
    clip(item, open);
  }

  function closeMenus() {
    if (openItem) setMenuState(openItem, false);
    openItem = null;
  }

  function openMenu(item) {
    window.clearTimeout(leaveTimer);
    if (openItem === item) return;
    closeMenus();
    openItem = item;
    setMenuState(item, true);
  }

  items.forEach(function (item) {
    var trigger = item.querySelector('.nav-trigger');
    var menu = item.querySelector('.nav-menu');
    if (menu) menu.setAttribute('inert', '');

    item.addEventListener('mouseenter', function () { openMenu(item); });
    item.addEventListener('mouseleave', function () {
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(function () { if (openItem === item) closeMenus(); }, 120);
    });
    item.addEventListener('focusin', function () { openMenu(item); });
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) closeMenus();
    });
    if (trigger) {
      trigger.addEventListener('click', function () {
        if (openItem === item) closeMenus(); else openMenu(item);
      });
    }
  });

  document.addEventListener('click', function (e) {
    if (openItem && !openItem.contains(e.target)) closeMenus();
  });

  /* ---- 3. mobile menu ---------------------------------------------------- */
  var mobile = nav.querySelector('.nav-mobile');
  var menuBtn = nav.querySelector('.nav-menu-btn');
  var mobileOpen = false;

  function lockScroll(lock) {
    html.classList.toggle('nav-lock', lock);
    var lenis = window.getLenis ? window.getLenis() : null;
    if (lenis) { if (lock) lenis.stop(); else lenis.start(); }
  }

  function setMobile(open) {
    if (open === mobileOpen) return;
    mobileOpen = open;
    nav.setAttribute('data-open', open ? 'true' : 'false');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (mobile) {
      if (open) mobile.removeAttribute('inert'); else mobile.setAttribute('inert', '');
    }
    lockScroll(open);
    if (open) closeMenus();
    apply();
  }

  function closeMobile() { setMobile(false); }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMobile(!mobileOpen); });
  }

  if (mobile) {
    mobile.querySelectorAll('.nav-m-row--toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        mobile.querySelectorAll('.nav-m-row--toggle').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    });
    mobile.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (a) closeMobile();
    });
  }

  var desktopMq = window.matchMedia ? window.matchMedia('(min-width: 1201px)') : null;
  if (desktopMq) {
    var onChange = function (e) { if (e.matches) closeMobile(); else closeMenus(); };
    if (desktopMq.addEventListener) desktopMq.addEventListener('change', onChange);
    else if (desktopMq.addListener) desktopMq.addListener(onChange);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (mobileOpen) { closeMobile(); if (menuBtn) menuBtn.focus(); return; }
    if (openItem) {
      var trigger = openItem.querySelector('.nav-trigger');
      closeMenus();
      if (trigger) trigger.focus();
    }
  });

  /* smooth-scroll in-page anchors through Lenis when it is running */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.getAttribute('href') === '#') return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    var lenis = window.getLenis ? window.getLenis() : null;
    if (!lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0, duration: reduce ? 0 : undefined });
  });

  window.hypjamNav = { refresh: apply, closeMenus: closeMenus, closeMobile: closeMobile };
})();
