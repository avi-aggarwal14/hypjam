/* ---- src/js/00-lenis.js ---- */
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

/* ---- src/js/10-nav.js ---- */
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
    if (!video.getAttribute('poster') && video.dataset.poster) video.setAttribute('poster', video.dataset.poster);
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

/* ---- src/js/23-compare.js ---- */
/* ==========================================================================
   23-compare.js — the "Compare hypjam with" switch on the comparison table.
   On phones the table shows hypjam beside one alternative; the switch sets
   data-alt on .cmp-wrap (CSS hides the other columns), aria-pressed on the
   buttons, and announces the change in a polite live region. Wider screens
   show every column and ignore it.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('[data-cmp]');
  if (!root) return;
  var wrap = root.querySelector('.cmp-wrap');
  var status = root.querySelector('[data-cmp-status]');
  var btns = Array.prototype.slice.call(root.querySelectorAll('[data-cmp-alt]'));
  if (!wrap || !btns.length) return;
  /* the markup ships the no-JavaScript state (all four columns, switch hidden);
     with scripts on, phones compare hypjam with one route at a time */
  var sw = root.querySelector('[data-cmp-switch]');
  if (sw) sw.hidden = false;
  var first = btns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || btns[0];
  wrap.setAttribute('data-alt', first.getAttribute('data-cmp-alt'));
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      wrap.setAttribute('data-alt', b.getAttribute('data-cmp-alt'));
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      if (status) status.textContent = 'Showing hypjam and ' + (b.getAttribute('data-name') || b.textContent);
    });
  });
})();

/* ---- src/js/24-sticky-cta.js ---- */
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

/* ---- src/js/25-hero.js ---- */
/* ==========================================================================
   25-hero.js — the example ads in the first screen (partials/home/hero.html).
   Each card loads only a poster; pressing play swaps in the real video (with
   controls and sound) so nothing heavy downloads until asked, and any other
   hero clip that is playing is paused. On phones the cards are ~115px wide,
   so the video asks for full screen instead of playing at thumbnail size.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('.h2o');
  if (!root) return;
  var phone = window.matchMedia('(max-width: 600px)');
  var playing = [];

  root.querySelectorAll('.h2o-play').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = btn.getAttribute('data-video');
      if (!src) return;
      playing.forEach(function (v) { v.pause(); });
      var img = btn.querySelector('img');
      var v = document.createElement('video');
      v.src = src;
      if (img) { v.poster = img.currentSrc || img.src; v.setAttribute('aria-label', img.alt); }
      v.controls = true;
      v.preload = 'auto';
      if (!phone.matches) { v.playsInline = true; v.setAttribute('playsinline', ''); }
      btn.replaceWith(v);
      playing.push(v);
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      if (phone.matches) {
        try {
          if (v.requestFullscreen) { var f = v.requestFullscreen(); if (f && f.catch) f.catch(function () {}); }
          else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
        } catch (e) { /* inline playback is fine */ }
      }
      v.focus();
    });
  });
})();

/* ---- src/js/32-stories.js ---- */
/* ==========================================================================
   32-stories.js — the brand-stories carousel (src/partials/home/stories.html)
   A port of the reference site's story carousel: a transform-driven track (not native
   scroll) with the four cards cloned before and after so prev/next loop
   without end, pointer drag with an 8px threshold that snaps to the nearest
   card on release (the reference site's features carousel, ref/hero_chunk.pretty.js
   ~20180: threshold 8, snap = round(drag / pitch), pointer capture,
   touch-action pan-y), and the 620ms cubic-bezier(.22,1,.36,1) glide that
   the reference site's track carries inline. The CSS owns the transition; JS only toggles
   .is-still for the silent wrap jump. Reduced motion: no glide (the base
   stylesheet zeroes transitions), positions still update.

   window.hypjamStories = {
     el, next(), prev(), go(i), index() -> 0..n-1, count() -> n,
     refresh()  // re-measure after a layout change
   }
   Emits "hypjam:stories" on the section: detail { index }.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-sto]');
  if (!root) return;
  var mask = root.querySelector('[data-sto-mask]');
  var track = root.querySelector('[data-sto-track]');
  var prevBtn = root.querySelector('[data-sto-prev]');
  var nextBtn = root.querySelector('[data-sto-next]');
  if (!mask || !track) return;

  var originals = Array.prototype.slice.call(track.children);
  var n = originals.length;
  if (!n) return;

  var DUR = 620;              /* ms · the reference site: transition:transform 620ms cubic-bezier(0.22,1,0.36,1) */
  var THRESHOLD = 8;          /* px before a pointer move counts as a drag */
  var BEFORE = n;             /* clones ahead of the originals */
  var AFTER = n * 2;          /* clones after — enough to fill any viewport up to ~9 cards */
  var reduce = document.documentElement.getAttribute('data-motion') === 'reduced';

  /* ---- clones for the loop ------------------------------------------------- */
  function clone(el) {
    var c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('data-sto-clone', '');
    c.removeAttribute('aria-current');
    var focusable = c.querySelectorAll('a, button, [tabindex]');
    for (var i = 0; i < focusable.length; i++) focusable[i].setAttribute('tabindex', '-1');
    var imgs = c.querySelectorAll('img');
    for (var j = 0; j < imgs.length; j++) imgs[j].setAttribute('loading', 'lazy');
    return c;
  }
  var loop = n > 1;
  if (loop) {
    var head = document.createDocumentFragment();
    var tail = document.createDocumentFragment();
    for (var b = 0; b < BEFORE; b++) head.appendChild(clone(originals[b % n]));
    for (var a = 0; a < AFTER; a++) tail.appendChild(clone(originals[a % n]));
    track.insertBefore(head, track.firstChild);
    track.appendChild(tail);
  }

  /* ---- state ---------------------------------------------------------------- */
  var pos = loop ? BEFORE : 0;   /* physical slot at the left edge */
  var offset = 0;                /* live drag offset in px */
  var pitch = 0;                 /* card width + gap */
  var settleTimer = 0;
  var lastIndex = -1;

  function gapPx() {
    var g = window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap;
    var v = parseFloat(g);
    return isNaN(v) ? 30 : v;
  }
  function measure() {
    var first = track.children[0];
    pitch = first ? first.getBoundingClientRect().width + gapPx() : 0;
  }
  function logical(p) { return loop ? ((p - BEFORE) % n + n) % n : Math.max(0, Math.min(n - 1, p)); }
  function x() { return -(pos * pitch) + offset; }
  function paint() { track.style.transform = 'translate3d(' + x() + 'px, 0, 0)'; }

  function still(on) {
    if (on) track.classList.add('is-still'); else track.classList.remove('is-still');
  }

  function announce() {
    var idx = logical(pos);
    if (idx === lastIndex) return;
    lastIndex = idx;
    for (var i = 0; i < originals.length; i++) {
      if (i === idx) originals[i].setAttribute('aria-current', 'true');
      else originals[i].removeAttribute('aria-current');
    }
    try { root.dispatchEvent(new CustomEvent('hypjam:stories', { detail: { index: idx } })); } catch (e) { /* old engines */ }
  }

  /* after a glide into the clone zone, jump silently to the equivalent original */
  function settle() {
    clearTimeout(settleTimer);
    settleTimer = 0;
    if (!loop) return;
    var target = pos;
    if (pos < BEFORE) target = pos + n;
    else if (pos >= BEFORE + n) target = pos - n;
    if (target === pos) return;
    still(true);
    pos = target;
    paint();
    void track.offsetHeight;         /* commit the jump before the transition returns */
    window.requestAnimationFrame(function () { still(false); });
  }

  function glide(animate) {
    clearTimeout(settleTimer);
    still(!animate || reduce);
    paint();
    if (!animate || reduce) {
      settle();
      window.requestAnimationFrame(function () { still(false); });
    } else {
      settleTimer = window.setTimeout(settle, DUR + 80);   /* fallback if transitionend never fires */
    }
    announce();
  }

  track.addEventListener('transitionend', function (e) {
    if (e.target !== track || e.propertyName !== 'transform') return;
    if (settleTimer) settle();
  });

  function step(delta, animate) {
    if (!pitch) measure();
    offset = 0;
    if (loop) pos += delta;
    else pos = Math.max(0, Math.min(n - 1, pos + delta));
    glide(animate !== false);
  }
  function goTo(i, animate) {
    if (!pitch) measure();
    var target = ((i % n) + n) % n;
    var cur = logical(pos);
    var delta = target - cur;
    if (loop && Math.abs(delta) > n / 2) delta += delta > 0 ? -n : n;   /* shortest way round */
    step(delta, animate);
  }

  /* ---- buttons + keyboard --------------------------------------------------- */
  if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
  root.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  /* ---- pointer drag (the reference site: threshold, capture, snap to round(drag/pitch)) --- */
  var drag = null;
  var suppressClick = false;
  mask.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (!pitch) measure();
    drag = { id: e.pointerId, startX: e.clientX, moved: false };
  });
  /* a press that never crossed the threshold and left the mask is not a drag */
  mask.addEventListener('pointerleave', function (e) {
    if (drag && drag.id === e.pointerId && !drag.moved) drag = null;
  });
  mask.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var dx = e.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(dx) <= THRESHOLD) return;
      drag.moved = true;
      mask.classList.add('is-dragging');
      still(true);
      try { mask.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    offset = dx;
    if (!loop) {                          /* clamp at the ends when there is nothing to loop */
      var min = -((n - 1) * pitch), max = 0;
      var v = -(pos * pitch) + offset;
      if (v > max) offset = max + pos * pitch;
      if (v < min) offset = min + pos * pitch;
    }
    paint();
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var moved = drag.moved;
    var dx = offset;
    drag = null;
    mask.classList.remove('is-dragging');
    try { mask.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!moved) return;
    suppressClick = true;
    var steps = -Math.round(dx / pitch);
    /* keep the drag offset on screen, then glide the remainder */
    still(false);
    step(steps, true);
  }
  mask.addEventListener('pointerup', endDrag);
  mask.addEventListener('pointercancel', endDrag);
  mask.addEventListener('lostpointercapture', function (e) { if (drag && drag.id === e.pointerId) endDrag(e); });
  /* the click that follows a drag must never reach whatever sits under the pointer */
  mask.addEventListener('click', function (e) {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  mask.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* ---- layout ---------------------------------------------------------------- */
  function refresh() {
    measure();
    still(true);
    paint();
    void track.offsetHeight;
    window.requestAnimationFrame(function () { still(false); });
  }
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { refresh(); });
    ro.observe(mask);
  } else {
    window.addEventListener('resize', refresh);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);

  refresh();
  announce();

  window.hypjamStories = {
    el: root,
    next: function () { step(1); },
    prev: function () { step(-1); },
    go: function (i) { goTo(i); },
    index: function () { return logical(pos); },
    count: function () { return n; },
    refresh: refresh
  };
})();

/* ---- src/js/40-pages.js ---- */
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
    /* the figures are contract terms: show them as they are, no count-up (research:
       sharp numbers read as factual when static; animating adds motion, not information) */
    el.textContent = String(target); return;
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

/* ---- src/js/45-book.js ---- */
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

/* ---- src/js/48-apply.js ---- */
/* ==========================================================================
   48-apply.js — /apply, the creator application.

   Two jobs. Reveal the conditional fields (past work when they say they have
   experience; a free-text box when they pick "Other"), and submit.

   Submission has no backend behind it. If content/apply.json carries an
   endpoint the form POSTs JSON to it; with the endpoint empty — the shipped
   state — it composes the answers into an email instead, so the page works
   today without signing hypjam up to a form service and without adding a new
   data processor to the privacy policy. Swapping in an endpoint is one value
   in the JSON and needs no change here.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-apply-form]');
  if (!form) return;

  var status   = form.querySelector('[data-apply-status]');
  var expYes   = form.querySelector('[data-exp-yes]');
  var profiles = form.querySelector('[data-when-experience]');
  var found    = form.querySelector('#ap-found');
  var other    = form.querySelector('[data-when-other]');
  var endpoint = (form.getAttribute('data-endpoint') || '').trim();
  var fallback = (form.getAttribute('data-fallback') || '').trim();

  /* ---------- conditional fields ---------- */
  function syncExperience() {
    var on = !!(expYes && expYes.checked);
    if (profiles) profiles.hidden = !on;
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'experience') syncExperience();
    if (e.target === found && other) other.hidden = found.value !== 'Other';
  });
  syncExperience();
  if (other && found) other.hidden = found.value !== 'Other';

  /* ---------- validation ---------- */
  function setError(el, key, message) {
    var slot = form.querySelector('[data-error-for="' + key + '"]');
    if (slot) { slot.textContent = message || ''; slot.hidden = !message; }
    if (el) el.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function looksLikeUrl(v) {
    try { var u = new URL(v.trim()); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (err) { return false; }
  }

  function validate() {
    var problems = [];

    var name = form.querySelector('#ap-name');
    var ok = name.value.trim().length > 1;
    setError(name, 'ap-name', ok ? '' : 'Please tell us your name.');
    if (!ok) problems.push(name);

    var email = form.querySelector('#ap-email');
    ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    setError(email, 'ap-email', ok ? '' : 'That email does not look right.');
    if (!ok) problems.push(email);

    var exp = form.querySelector('input[name="experience"]:checked');
    setError(null, 'experience', exp ? '' : 'Pick one — either answer is fine.');
    if (!exp) problems.push(form.querySelector('input[name="experience"]'));

    if (expYes && expYes.checked) {
      var prof = form.querySelector('#ap-profiles');
      ok = prof.value.trim().length > 3;
      setError(prof, 'ap-profiles', ok ? '' : 'Add at least one link to your past work.');
      if (!ok) problems.push(prof);
    } else {
      setError(form.querySelector('#ap-profiles'), 'ap-profiles', '');
    }

    var ex = form.querySelector('#ap-example');
    ok = looksLikeUrl(ex.value);
    setError(ex, 'ap-example', ok ? '' : 'Paste a public link starting with https://');
    if (!ok) problems.push(ex);

    ok = !!found.value;
    setError(found, 'ap-found', ok ? '' : 'Pick one so we know where to keep looking.');
    if (!ok) problems.push(found);

    return problems;
  }

  /* ---------- submit ---------- */
  function answers() {
    var exp = form.querySelector('input[name="experience"]:checked');
    var src = found.value;
    var oth = form.querySelector('#ap-found-other');
    if (src === 'Other' && oth && oth.value.trim()) src += ' — ' + oth.value.trim();
    return {
      name: form.querySelector('#ap-name').value.trim(),
      email: form.querySelector('#ap-email').value.trim(),
      experience: exp ? (exp.value === 'yes' ? 'Yes' : 'No') : '',
      profiles: (expYes && expYes.checked) ? form.querySelector('#ap-profiles').value.trim() : '',
      example: form.querySelector('#ap-example').value.trim(),
      found: src
    };
  }

  function say(message, tone) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    if (tone) status.setAttribute('data-tone', tone); else status.removeAttribute('data-tone');
  }

  function mailto(a) {
    var lines = [
      'Name: ' + a.name,
      'Email: ' + a.email,
      'Made UGC before: ' + a.experience,
      a.profiles ? 'Past work:\n' + a.profiles : null,
      'Example: ' + a.example,
      'Found us via: ' + a.found
    ].filter(Boolean);
    return 'mailto:' + fallback +
      '?subject=' + encodeURIComponent('Creator application — ' + a.name) +
      '&body=' + encodeURIComponent(lines.join('\n\n'));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var problems = validate();
    if (problems.length) {
      say('Some answers need a look — see the notes above.', 'bad');
      if (problems[0] && problems[0].focus) problems[0].focus();
      return;
    }

    var a = answers();

    if (!endpoint) {
      say('Opening your email app with the application filled in. Send it and we will pick it up.');
      window.location.href = mailto(a);
      return;
    }

    var btn = form.querySelector('.apply-submit');
    if (btn) btn.disabled = true;
    say('Sending…');

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(a)
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status ' + r.status);
      form.reset();
      syncExperience();
      if (other) other.hidden = true;
      say('Thank you. A person reads every one of these; we will email you at ' + a.email + '.');
    }).catch(function () {
      say('That did not send. Email it to ' + fallback + ' and we will pick it up.', 'bad');
    }).then(function () {
      if (btn) btn.disabled = false;
    });
  });
})();
