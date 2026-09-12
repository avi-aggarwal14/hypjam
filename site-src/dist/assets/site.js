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

/* ---- src/js/20-hero.js ---- */
/* ==========================================================================
   20-hero.js — the hero engine (CONTRACT §7), a port of Lance's scroll
   walkthrough (ref/hero_engine.pretty.js + the helpers in
   ref/hero_chunk.pretty.js, React removed). Variable names from the source
   are kept in comments so the two can be read side by side.

   Departure (CONTRACT §1): Lance's headline beat (G.headline, t$ = 1.4)
   does not exist here; the timeline starts at what Lance calls `g`.

   Drawing mechanics: Lance tweens strokeDashoffset per element with GSAP
   stagger tweens. Here every element is written in the timeline's onUpdate
   from a per-collection segment schedule (in/out windows) — the same
   stagger (amount .45·s, random order), the same eases, but one function
   instead of thousands of tweens, and the state is a pure function of the
   timeline time so scrubbing in either direction is exact. Because Chromium
   interprets stroke-dasharray in screen px under vector-effect:
   non-scaling-stroke, lengths are scaled by the current px-per-unit.

   Exposes window.hypjamHero = { mode, G, cam, timeline, scrollTrigger,
   goToStop(i), skip(), rebuild(), util } — see the report for the list.
   ========================================================================== */
(function () {
  'use strict';

  var section = document.getElementById('hero');
  if (!section) return;

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var CustomEase = window.CustomEase;
  var MOBILE_MQ = '(max-width: 1024px)';

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function getLenis() { return typeof window.getLenis === 'function' ? window.getLenis() : null; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeInOut2(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }   /* power2.inOut */
  function easeOut2(t) { return 1 - (1 - t) * (1 - t); }                                     /* power2.out */
  function easeIn2(t) { return t * t; }                                                      /* power2.in */
  function quintInOut(t) { return t < .5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2; }

  /* ---------- Lance's constants ---------- */
  var K = {
    drawIn: 3.2,          /* tY  the buildings draw in */
    wordDur: .4,          /* tX  each trust word */
    marqueeDur: 1,        /* tJ  marquee fade */
    hold1: .35,           /* tK */
    blurMax: 20,          /* tU */
    trustOut: .5,         /* tQ */
    hold2: .12,           /* t0 */
    overlap: .28,         /* t1  trust-out overlaps the first dive */
    firstDive: 1.65,      /* t2 */
    fly: 2.8,             /* t3  stop-to-stop flight */
    kfSplit: .45,         /* t5  zoom-out keyframe split */
    zoomOut: 1.65,        /* t4  tf() width factor */
    fadeLead: .35,        /* t6 */
    holdStop: 0,          /* t8 */
    holdLast: 0,          /* t9 */
    draw: 1.4,            /* t7  detail draw-in / fade-group fade */
    pullOut: 2.8,         /* et  final pull-out */
    endHold: 1,           /* ee */
    metricsDur: .85,      /* ei */
    metricsTextAt: .5,    /* es */
    metricsNumsAt: .65,   /* er */
    gapA: 12,             /* ea */
    gapB: 24,             /* en */
    hudGap: 36,           /* eo */
    panelFade: .28,       /* eh */
    cardTween: .4,        /* el */
    pinViewports: 11,     /* ep */
    scrub: 1.2,           /* ef */
    stagger: .45,         /* tD: stagger amount = .45 · duration */
    opFrac: .18           /* ty: stroke-opacity ramp = .18 · duration */
  };
  var CAM = {
    bbox: [1800, 400, 40000, 21200],   /* $  the drawing's framed bbox */
    frameW: 1512, frameH: 900,          /* q, G  Lance's Figma frame */
    unitsPerPx: 10.000223943462377,     /* W */
    unitsPerPxY: 10.003878703812246,    /* H */
    initWidth: .3,                      /* Y */
    initCenterX: .75,                   /* X */
    initCenterYMax: .5,                 /* J */
    ref: 1512,                          /* K */
    finalWidth: .27,                    /* te */
    finalCenterY: .83,                  /* ti */
    /* ours: the stop zoom never goes tighter than Lance's constant frame
       (1512px × 10 units/px = 15120 units wide at 16:9; JSON w wins when larger).
       Set to 0 for the literal bbox × 1.25 framing from content/hero.json. */
    stopMinW: 15120,
    hudFrac: .31,                       /* stage fraction the HUD column covers (28 + 560 px at 1920) */
    narrow: { drawingStatsGap: 48, statsFallbackH: 132, statsFallbackHNarrow: 320 }   /* tn */
  };
  var GEO = 'path, line, polyline, polygon, circle, ellipse, rect';   /* tg */
  var DASH = '4px 6px';                                                /* tv */

  /* ---------- content: stops from the HUD buttons (rendered from content/hero.json) ---------- */
  var stopButtons = Array.prototype.slice.call(section.querySelectorAll('[data-hero-stop]'));
  var STOPS = stopButtons.map(function (b) {
    var id = b.dataset.stopId || '';
    return {
      id: id,
      label: b.textContent.trim(),
      fadeId: '#' + (id.split('-')[0] || '') + '-fade',
      detailId: '#' + id,
      cx: +b.dataset.cx, cy: +b.dataset.cy, w: +b.dataset.w,
      bx: +b.dataset.bx, by: +b.dataset.by, bw: +b.dataset.bw, bh: +b.dataset.bh
    };
  });

  /* ======================================================================
     shared utilities (also used by 21-hero-mobile.js)
     ====================================================================== */
  var drawingPromise = null;
  function loadDrawing() {
    if (!drawingPromise) {
      drawingPromise = fetch('/assets/img/hq.svg').then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
    }
    return drawingPromise;
  }

  /* Lance tv(): strip the frame rects, normalise strokes, dash the .2 lines */
  function prepSvg(svg) {
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.querySelectorAll('rect').forEach(function (r) {
      if (parseFloat(r.getAttribute('width') || '0') > 4e4) r.remove();
    });
    var frame = svg.querySelector('[id="Frame 7"]');
    if (frame) { var fr = frame.querySelector(':scope > rect'); if (fr) fr.remove(); }
    svg.querySelectorAll('[stroke]').forEach(function (el) {
      el.setAttribute('vector-effect', 'non-scaling-stroke');
      el.setAttribute('stroke-width', '1');
      if (el.getAttribute('stroke-opacity') === '0.2') el.style.strokeDasharray = DASH;
    });
  }

  /* Lance tS(): collect the stroked / filled geometry of a group */
  function collect(root) {
    var strokes = [], fills = [];
    root.querySelectorAll(GEO).forEach(function (el) {
      var st = el.getAttribute('stroke'), fl = el.getAttribute('fill');
      var hasS = !!st && st !== 'none', hasF = !!fl && fl !== 'none';
      if (hasS && typeof el.getTotalLength === 'function') {
        var len = 0;
        try { len = el.getTotalLength(); } catch (e) { len = 0; }
        if (isFinite(len) && len > 0) {
          el.setAttribute('data-draw-len', String(len));
          var so = el.getAttribute('stroke-opacity') || '1';
          el.setAttribute('data-stroke-opacity', so);
          var da = el.getAttribute('stroke-dasharray');
          var dashed = so === '0.2' || (!!da && da !== 'none');
          var dash = null;
          if (dashed) {
            dash = (da && da !== 'none') ? da : DASH;
            el.setAttribute('data-line-style', 'dashed');
            el.setAttribute('data-visual-dash', dash);
          }
          strokes.push({ el: el, len: len, op: +so || 1, dashed: dashed, dash: dash, r: 0 });
          if (hasF) {
            var fo = el.getAttribute('fill-opacity') || '1';
            el.setAttribute('data-fill-opacity', fo);
            fills.push({ el: el, op: +fo || 1, r: 0 });
          }
          return;
        }
      }
      if (hasF) {
        var fo2 = el.getAttribute('fill-opacity') || '1';
        el.setAttribute('data-fill-opacity', fo2);
        fills.push({ el: el, op: +fo2 || 1, r: 0 });
      }
    });
    rank(strokes); rank(fills);
    return { strokes: strokes, fills: fills, segs: [], lastKey: null, initialDrawn: false, deferInit: false };
  }
  /* GSAP stagger { from: 'random' }: a random permutation of start offsets */
  function rank(items) {
    var n = items.length;
    var idx = items.map(function (_, i) { return i; });
    for (var i = n - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    for (var k = 0; k < n; k++) items[idx[k]].r = n > 1 ? k / (n - 1) : 0;
  }

  /* Lance tM(): the settled state */
  function writeSettled(col, drawn) {
    var i, it, s;
    for (i = 0; i < col.strokes.length; i++) {
      it = col.strokes[i]; s = it.el.style;
      if (drawn) {
        s.strokeOpacity = String(it.op);
        s.strokeDasharray = it.dashed ? it.dash : '';
        s.strokeDashoffset = '0';
      } else {
        s.strokeOpacity = '0';
        if (it.dashed) { s.strokeDasharray = it.dash; s.strokeDashoffset = '0'; }
      }
    }
    for (i = 0; i < col.fills.length; i++) {
      it = col.fills[i];
      it.el.style.fillOpacity = drawn ? String(it.op) : '0';
    }
  }

  /* Lance tD(), evaluated at time T for one segment {t0, dur, dir}.
     Solid strokes: dashoffset over the element's window (power2.inOut) with
     the .45·s random stagger, opacity over .18·s (power2.out in / power2.in
     out at the end). Dashed strokes: opacity over .85·s (stagger .35·s).
     Fills: .7·s (stagger .35·s). Windows are compressed so every element
     settles at t0 + dur (Lance's beats assume that). */
  function writeLive(col, seg, T, scale) {
    var s = seg.dur, r = seg.t0, tin = seg.dir === 'in';
    var o = K.opFrac * s;
    var i, it, st, off, d, p, e, lenPx;
    for (i = 0; i < col.strokes.length; i++) {
      it = col.strokes[i]; st = it.el.style;
      if (it.dashed) {
        off = .35 * s * it.r; d = Math.min(.85 * s, s - off);
        e = easeInOut2(clamp01((T - r - off) / d));
        st.strokeDasharray = it.dash;
        st.strokeDashoffset = '0';
        st.strokeOpacity = String(it.op * (tin ? e : 1 - e));
        continue;
      }
      off = K.stagger * s * it.r; d = s - off;
      p = clamp01((T - r - off) / d); e = easeInOut2(p);
      lenPx = it.len * scale * 1.02 + 1;
      st.strokeDasharray = lenPx + 'px';
      if (tin) {
        st.strokeDashoffset = (lenPx * (1 - e)) + 'px';
        st.strokeOpacity = String(it.op * easeOut2(clamp01((T - r - off) / o)));
      } else {
        st.strokeDashoffset = (lenPx * e) + 'px';
        st.strokeOpacity = String(it.op * (1 - easeIn2(clamp01((T - (r + s - o)) / o))));
      }
    }
    for (i = 0; i < col.fills.length; i++) {
      it = col.fills[i];
      off = .35 * s * it.r; d = Math.min(.7 * s, s - off);
      e = easeInOut2(clamp01((T - r - off) / d));
      it.el.style.fillOpacity = String(it.op * (tin ? e : 1 - e));
    }
  }

  /* marquee: Lance renders six identical groups (one live, five aria-hidden) */
  function fillMarquee(track) {
    var groups = track.querySelectorAll('.marquee__group');
    if (!groups.length) return;
    var src = groups[groups.length - 1];
    var n = groups.length;
    while (n < 6) {
      var c = src.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('img').forEach(function (img) { img.setAttribute('alt', ''); });
      c.querySelectorAll('[role]').forEach(function (el) { el.removeAttribute('role'); });
      track.appendChild(c);
      n++;
    }
  }

  /* the .hero-walk button (Lance's component `c`) */
  function initWalk(btn, onWalk) {
    if (!btn) return;
    var label = btn.querySelector('.hero-walk-label');
    if (label && reduced() && btn.dataset.labelReduced) label.textContent = btn.dataset.labelReduced;
    btn.classList.add('hero-walk--mark');
    window.setTimeout(function () { btn.classList.add('hero-walk--label'); }, 250);
    btn.addEventListener('click', function () { if (onWalk) onWalk(); });
  }

  /* panels (src/panels/SPEC.md §4): mount paused, play while active */
  function panelHeight(host) {
    var pnl = host.querySelector('[data-panel-height]');
    var h = pnl ? parseInt(pnl.getAttribute('data-panel-height'), 10) : NaN;
    return isFinite(h) && h > 0 ? h : 184;
  }
  function mountPanels(root, reduce) {
    root.querySelectorAll('[data-hero-panel]').forEach(function (host) {
      host.style.height = panelHeight(host) + 'px';
      var pnl = host.querySelector('[data-panel]');
      var name = host.dataset.panelName || (pnl && pnl.dataset.panel);
      var reg = window.hypjamPanels && name ? window.hypjamPanels[name] : null;
      host.__pnlTl = null;
      if (pnl && reg && typeof reg.mount === 'function') {
        try { host.__pnlTl = reg.mount(pnl, { autoplay: false, reduced: !!reduce }) || null; }
        catch (e) { host.__pnlTl = null; if (window.console) console.warn('[hero] panel "' + name + '" failed to mount', e); }
      }
    });
  }
  function setPanelActive(host, on) {
    var tl = host && host.__pnlTl;
    if (!tl) return;
    if (reduced()) { tl.pause(); return; }
    if (on) { if (!tl.isActive()) tl.play(); } else { tl.pause(); }
  }

  /* metrics numbers (Lance tz/ek): count up over 1100ms, 160ms per item, cubic out */
  var counters = new WeakMap();
  function countUp(root, active, reduce) {
    root.querySelectorAll('[data-hero-num]').forEach(function (el, i) {
      var raw = String(el.dataset.value || '').trim();
      var target = parseFloat(raw.replace(/[^0-9.]/g, ''));
      var prev = counters.get(el);
      if (prev) { cancelAnimationFrame(prev); counters.delete(el); }
      if (!isFinite(target)) { el.textContent = raw; return; }
      if (!active) { el.textContent = '0'; return; }
      if (reduce) { el.textContent = raw; return; }
      var dur = 1100, delay = 160 * i, start = 0;
      var decimals = (raw.split('.')[1] || '').length;
      var step = function (now) {
        if (!start) start = now;
        var t = now - start - delay;
        if (t < 0) { counters.set(el, requestAnimationFrame(step)); return; }
        var l = Math.min(1, t / dur);
        var v = (1 - Math.pow(1 - l, 3)) * target;
        el.textContent = decimals ? v.toFixed(decimals) : String(Math.round(v));
        if (l < 1) counters.set(el, requestAnimationFrame(step)); else { el.textContent = raw; counters.delete(el); }
      };
      counters.set(el, requestAnimationFrame(step));
    });
  }

  var util = {
    K: K, CAM: CAM, STOPS: STOPS, reduced: reduced, getLenis: getLenis,
    loadDrawing: loadDrawing, prepSvg: prepSvg, collect: collect, writeSettled: writeSettled, writeLive: writeLive,
    fillMarquee: fillMarquee, initWalk: initWalk, mountPanels: mountPanels, setPanelActive: setPanelActive,
    panelHeight: panelHeight, countUp: countUp
  };

  var HERO = window.hypjamHero = window.hypjamHero || {};
  HERO.util = util;
  HERO.mode = '';
  HERO.G = null; HERO.cam = null; HERO.timeline = null; HERO.scrollTrigger = null;

  /* ======================================================================
     desktop engine (Lance ec())
     ====================================================================== */
  var stage = section.querySelector('[data-hero-stage]');
  var els = {
    videoLayer: section.querySelector('[data-hero-video-layer]'),
    video: stage ? stage.querySelector('.hero-video') : null,
    overlay: section.querySelector('[data-hero-overlay]'),
    mapLayer: section.querySelector('[data-hero-map-layer]'),
    map: section.querySelector('[data-hero-map]'),
    grads: section.querySelectorAll('[data-hero-grad]'),
    trust: section.querySelector('[data-hero-trust]'),
    trustP: section.querySelector('[data-hero-trust-p]'),
    walkWrap: section.querySelector('[data-hero-walk-wrap]'),
    walk: section.querySelector('[data-hero-walk]'),
    marquee: section.querySelector('[data-hero-marquee]'),
    hud: section.querySelector('[data-hero-hud]'),
    marker: section.querySelector('[data-hero-marker]'),
    card: section.querySelector('[data-hero-card]'),
    bodies: Array.prototype.slice.call(section.querySelectorAll('[data-hero-body]')),
    skips: section.querySelectorAll('[data-hero-skip]'),
    metrics: section.querySelector('[data-hero-metrics]'),
    metricsNums: section.querySelector('[data-metrics-nums]')
  };

  var D = {                       /* desktop state (the refs in ec()) */
    inited: false,
    svg: null,                    /* R */
    cols: [],                     /* ordered collections: hotel-drawing, fades, details */
    hotel: null,                  /* V */
    fades: [],                    /* z */
    details: [],                  /* B */
    tl: null,                     /* b */
    st: null,                     /* D */
    words: null,                  /* f */
    cam: { x: 0, y: 0, w: 1, h: 1 },   /* q */
    G: null,
    W: { w: 357, h: 354 },        /* card size */
    H: -1,                        /* current card index */
    Y: null,                      /* card tween */
    L: 0, T: [], E: [], F: [], I: [],  /* progress fractions: hudIn, departures, arrivals, hud switches, midpoints */
    j: -1,                        /* active HUD index */
    camSegs: [],                  /* camera schedule: {t0, dur, from, to, mid, ease} evaluated in onTick */
    tPull: 0,                     /* timeline time the final pull-out starts */
    camInit: null,
    metricsActive: false,
    raf: 0,
    keys: []                      /* reduced motion: quantised states */
  };

  function freshG() {
    return { overlay: .4, blur: 0, video: 1, trust: 1, map: 1, vignette: 0, sand: 0, hudOut: 0, metricsText: 0, metricsNums: 0 };
  }

  /* ---------- camera maths (Lance Z / Q / tl / tp / tf / tr / ta / to) ---------- */
  function pageX(w) { return w <= 600 ? 14 : 28; }                                  /* Z */
  function initialCam(w, h) {                                                        /* Q */
    var narrow = w <= 1024;
    var s = Math.min(CAM.initWidth * CAM.ref * (narrow ? .6 : 1) / Math.max(w, 1), .85);
    var r = CAM.bbox[3] / CAM.bbox[2];
    var a = s * w;
    var n = (h - 200 - a * r * .55) / Math.max(h, 1);
    if (narrow) {
      var cx = (pageX(w) + a / 2) / Math.max(w, 1);
      var cy = Math.min(.55, Math.max(.36, n));
      return { widthFraction: s, centerX: cx, centerY: Math.min(n, cy + .07) };
    }
    return { widthFraction: s, centerX: CAM.initCenterX, centerY: Math.min(CAM.initCenterYMax, Math.max(.32, n)) };
  }
  function frameBox(bbox, aspect, wf, cx, cy) {                                      /* tl */
    var w = bbox[2] / wf, h = w / aspect;
    return { x: bbox[0] + bbox[2] / 2 - cx * w, y: bbox[1] + bbox[3] / 2 - cy * h, w: w, h: h };
  }
  function finalWidth(w) { return Math.min(CAM.finalWidth * CAM.ref / Math.max(w, 1), .85); }   /* tr */
  function finalCenterX(w) { var e = finalWidth(w); return (pageX(w) + e * w / 2) / Math.max(w, 1); }   /* ta */
  function stopCam(stop, aspect, stageW) {                                           /* tp, from content/hero.json */
    var minW = CAM.stopMinW * (aspect >= CAM.frameW / CAM.frameH ? 1 : aspect * CAM.frameH / CAM.frameW);
    var w = Math.max(stop.w || 0, minW);
    var h = w / aspect;
    var fx = .5;
    if (stageW > 1024 && stop.bw) {
      /* nudge the room right of centre so its bbox clears the HUD column (Lance's rooms sit .52–.63 across) */
      var half = (stop.bw / w) / 2;
      var shift = Math.max(0, (CAM.hudFrac + .04) - (.5 - half));
      shift = Math.min(shift, Math.max(0, .98 - (.5 + half)), .13);
      fx = .5 + shift;
    }
    return { x: stop.cx - fx * w, y: stop.cy - .5 * h, w: w, h: h };
  }
  function midCam(a, b, k) {                                                         /* tf */
    var cx = (a.x + a.w / 2 + b.x + b.w / 2) / 2, cy = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
    var asp = a.w / a.h, w = Math.max(a.w, b.w) * k, h = w / asp;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }
  function lerpCam(out, a, b, t) {
    out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t;
    out.w = a.w + (b.w - a.w) * t; out.h = a.h + (b.h - a.h) * t;
  }
  /* the camera as a pure function of the timeline time (Lance tweens q; a callback-driven
     camera can be left stale by ScrollTrigger's suppressed refresh renders, this cannot) */
  function camAt(T, out) {
    var seg = null, i;
    for (i = 0; i < D.camSegs.length; i++) if (D.camSegs[i].t0 <= T) seg = D.camSegs[i];
    if (!seg) { if (D.camInit) lerpCam(out, D.camInit, D.camInit, 0); return; }
    var e = seg.ease(clamp01((T - seg.t0) / seg.dur));
    if (seg.mid) {
      if (e < K.kfSplit) lerpCam(out, seg.from, seg.mid, e / K.kfSplit);
      else lerpCam(out, seg.mid, seg.to, (e - K.kfSplit) / (1 - K.kfSplit));
    } else lerpCam(out, seg.from, seg.to, e);
  }
  function easeFn(name, fallback) {
    var f = null;
    try { f = gsap && gsap.parseEase ? gsap.parseEase(name) : null; } catch (e) { f = null; }
    return typeof f === 'function' ? f : fallback;
  }
  function writeViewBox() {                                                          /* ts */
    if (D.svg) D.svg.setAttribute('viewBox', D.cam.x + ' ' + D.cam.y + ' ' + D.cam.w + ' ' + D.cam.h);
  }
  function stageSize() {
    var r = stage.getBoundingClientRect();
    return { w: r.width || window.innerWidth, h: r.height || window.innerHeight };
  }

  /* ---------- G → DOM (Lance tu) ---------- */
  function applyG() {
    var G = D.G;
    if (els.overlay) els.overlay.style.background = 'rgba(0,0,0,' + G.overlay + ')';
    if (els.videoLayer) {
      els.videoLayer.style.opacity = String(G.video);
      els.videoLayer.style.filter = G.blur > 0 ? 'blur(' + G.blur + 'px)' : 'none';
      var hidden = G.video < .02;
      els.videoLayer.style.visibility = hidden ? 'hidden' : 'visible';
      if (els.video) {
        if (hidden && !els.video.paused) els.video.pause();
        else if (!hidden && els.video.paused && !reduced()) { var p = els.video.play(); if (p && p.catch) p.catch(function () {}); }
      }
    }
    if (els.trust) {
      els.trust.style.opacity = String(G.trust);
      els.trust.style.visibility = G.trust < .02 ? 'hidden' : 'visible';
      els.trust.style.pointerEvents = G.trust < .5 ? 'none' : 'auto';
    }
    if (els.mapLayer) {
      els.mapLayer.style.opacity = String(G.map);
      els.mapLayer.style.visibility = G.map < .02 ? 'hidden' : 'visible';
    }
    var vg = G.vignette * (1 - G.sand);
    for (var i = 0; i < els.grads.length; i++) els.grads[i].style.opacity = String(vg);
    var sand = G.sand;
    stage.style.backgroundColor = sand <= 0 ? '#000000' : sand >= 1 ? '#f7f6f4' : 'color-mix(in srgb, #f7f6f4 ' + Math.round(100 * sand) + '%, #000000)';
    stage.dataset.sand = sand > .45 ? '1' : '0';
    var spacer = stage.parentElement;
    if (spacer && spacer !== section) spacer.style.backgroundColor = '#f7f6f4';
    if (els.metrics) {
      els.metrics.style.setProperty('--metrics-text', String(G.metricsText));
      els.metrics.style.setProperty('--metrics-nums', String(G.metricsNums));
      els.metrics.style.visibility = (G.metricsText < .02 && G.metricsNums < .02) ? 'hidden' : 'visible';
    }
    var light = sand > .55;
    var nav = light ? 'light' : 'dark', fill = light ? 'bg-sand-s' : 'bg-transparent';
    if (section.dataset.nav !== nav) section.dataset.nav = nav;
    if (section.dataset.navFill !== fill) section.dataset.navFill = fill;
  }

  /* ---------- HUD (Lance td) ---------- */
  function updateHud(t) {
    applyG();
    var G = D.G;
    var i = D.L, s = D.E[0] != null ? D.E[0] : i + .08;
    var r = (t <= i ? 0 : Math.min(1, (t - i) / Math.max(s - i, 1e-6))) * (1 - G.sand) * (1 - G.hudOut);
    if (els.hud) {
      els.hud.style.opacity = String(r);
      els.hud.style.pointerEvents = r < .5 ? 'none' : 'auto';
    }
    var n = D.F, o = -1;
    for (var e = 0; e < n.length; e++) if (t >= n[e]) o = e;
    if (o < 0 && r > 0 && n.length) o = 0;
    if (o !== D.j) {
      D.j = o;
      stopButtons.forEach(function (b, k) {
        var on = k === o;
        b.dataset.active = on ? 'true' : 'false';
        b.style.transform = on ? 'translateX(24px)' : 'translateX(0px)';
      });
      if (els.marker && o >= 0 && stopButtons[o]) {
        var b2 = stopButtons[o];
        els.marker.style.transform = 'translateY(' + (b2.offsetTop + b2.offsetHeight / 2) + 'px) translateY(-50%)';
      }
    }
  }

  /* ---------- card / panels (Lance X J K U te tg ti) ---------- */
  function applyCardSize() {                                                         /* X */
    if (els.card) { els.card.style.width = D.W.w + 'px'; els.card.style.height = D.W.h + 'px'; }
  }
  function measureBody(t) {                                                          /* J */
    var body = els.bodies[t], card = els.card;
    var w = 357, h = 354;
    if (!body || !card) return { w: w, h: h };
    var pw = card.style.width, ph = card.style.height;
    card.style.width = w + 'px'; card.style.height = 'auto'; card.style.minHeight = '0';
    var wasVis = body.style.visibility;
    body.style.visibility = 'hidden';
    var oh = body.offsetHeight;
    body.style.visibility = wasVis;
    card.style.width = pw; card.style.height = ph; card.style.minHeight = '';
    return { w: w, h: oh || h };
  }
  function setBody(t, e) {                                                           /* K */
    var b = els.bodies[t];
    if (!b) return;
    b.style.opacity = String(e);
    b.style.visibility = e < .02 ? 'hidden' : 'visible';
    b.style.pointerEvents = e < .5 ? 'none' : 'auto';
    var panel = b.querySelector('[data-hero-panel]');
    if (panel) setPanelActive(panel, e >= .5);
  }
  function cardImmediate(t) {                                                        /* U */
    if (D.Y) { D.Y.kill(); D.Y = null; }
    D.H = t;
    els.bodies.forEach(function (_, e) { setBody(e, 0); });
    if (t < 0) { D.W.w = 357; D.W.h = 354; applyCardSize(); return; }
    var m = measureBody(t); D.W.w = m.w; D.W.h = m.h;
    applyCardSize(); setBody(t, 1);
  }
  function cardTo(t, immediate) {                                                    /* te */
    if (t === D.H) return;
    if (immediate || !gsap) { cardImmediate(t); return; }
    var i = D.H;
    D.H = t;
    if (D.Y) D.Y.kill();
    gsap.killTweensOf(D.W);
    els.bodies.forEach(function (b, e) { if (b) { gsap.killTweensOf(b); if (e !== i) setBody(e, 0); } });
    var a = t >= 0 ? measureBody(t) : { w: 357, h: 354 };
    var n = gsap.timeline({ onComplete: function () { D.Y = null; } });
    D.Y = n;
    if (i >= 0) {
      var prev = els.bodies[i];
      if (prev) {
        var prevPanel = prev.querySelector('[data-hero-panel]');
        if (prevPanel) setPanelActive(prevPanel, false);
        n.to(prev, { opacity: 0, duration: K.panelFade, ease: 'power2.inOut', onUpdate: function () {
          var o = parseFloat(prev.style.opacity || '0');
          prev.style.visibility = o < .02 ? 'hidden' : 'visible';
          prev.style.pointerEvents = o < .5 ? 'none' : 'auto';
        } });
      } else n.to({}, { duration: K.panelFade });
    }
    n.to(D.W, { w: a.w, h: a.h, duration: (i < 0 && t === 0) ? 0 : K.cardTween, ease: 'power2.inOut', onUpdate: applyCardSize, onComplete: applyCardSize });
    if (t >= 0) {
      var next = els.bodies[t];
      if (next) {
        next.style.visibility = 'visible';
        var nextPanel = next.querySelector('[data-hero-panel]');
        n.fromTo(next, { opacity: 0 }, { opacity: 1, duration: K.panelFade, ease: 'power2.inOut',
          onStart: function () { if (nextPanel) setPanelActive(nextPanel, true); },
          onUpdate: function () { var o = parseFloat(next.style.opacity || '0'); next.style.pointerEvents = o < .5 ? 'none' : 'auto'; } });
      }
    }
  }
  function stopAt(t) {                                                               /* ti: last midpoint ≤ progress */
    var e = D.I, i = -1;
    for (var s = 0; s < e.length; s++) if (t >= e[s]) i = s;
    return i;
  }
  function syncCard(immediate) {                                                     /* tg */
    var G = D.G;
    if (G.sand > .08 || G.hudOut > .08) cardTo(-1, immediate);
    else cardTo(stopAt(D.st ? D.st.progress : (D.tl ? D.tl.progress() : 0)), immediate);
  }

  /* ---------- drawing render (Lance's tD/tM effect, evaluated per frame) ---------- */
  function renderCol(col, T, scale, force) {
    var seg = null, i;
    for (i = 0; i < col.segs.length; i++) if (col.segs[i].t0 <= T) seg = col.segs[i];
    if (!seg) {
      if (col.deferInit) {                 /* fade groups before their first segment: owned by hotel-drawing */
        if (col.lastKey !== 'init') { col.lastKey = 'init'; if (D.hotel) renderCol(D.hotel, T, scale, true); }
        return;
      }
      if (force || col.lastKey !== 'init') { col.lastKey = 'init'; writeSettled(col, col.initialDrawn); }
      return;
    }
    if (T < seg.t0 + seg.dur) { writeLive(col, seg, T, scale); col.lastKey = 'live'; return; }
    var key = seg.dir;
    if (force || col.lastKey !== key) { col.lastKey = key; writeSettled(col, key === 'in'); }
  }
  function renderDrawing(T, force) {
    if (!D.svg) return;
    var scale = stageSize().w / Math.max(D.cam.w, 1e-6);
    for (var i = 0; i < D.cols.length; i++) renderCol(D.cols[i], T, scale, force);
  }
  function addSeg(col, dir, dur, t0) {
    if (!col) return;
    col.segs.push({ t0: t0, dur: dur, dir: dir });
    col.segs.sort(function (a, b) { return a.t0 - b.t0; });
  }

  /* ---------- the timeline (Lance ty) ---------- */
  function onTick() {
    var tl = D.tl;
    if (!tl) return;
    camAt(tl.time(), D.cam);
    writeViewBox();
    renderDrawing(tl.time(), false);
    updateHud(tl.progress());
    syncCard(false);
    var active = D.G.metricsNums > .15;
    if (active !== D.metricsActive) {
      D.metricsActive = active;
      if (els.metricsNums) els.metricsNums.dataset.active = active ? '1' : '0';
      countUp(els.metrics || section, active, reduced());
    }
  }

  function build() {
    if (!D.svg || !gsap) return;
    var reduce = reduced();
    var sz = stageSize(), n = sz.w, hgt = sz.h;
    var aspect = n / hgt || 16 / 9;

    var q0 = initialCam(n, hgt);
    var camInit = frameBox(CAM.bbox, aspect, q0.widthFraction, q0.centerX, q0.centerY);        /* h */
    var camFinal = frameBox(CAM.bbox, aspect, finalWidth(n), finalCenterX(n), CAM.finalCenterY); /* l */
    var cams = STOPS.map(function (s) { return stopCam(s, aspect, n); });                        /* p */

    /* final camera: sit the drawing under the metrics (Lance's --metrics-gap logic) */
    camFinal.y += ((K.gapA + K.gapB) / hgt) * camFinal.h;
    if (n <= 1200) {
      var c1 = CAM.narrow, r1 = pageX(n);
      var numsH = els.metricsNums ? els.metricsNums.offsetHeight : 0;
      var o1 = hgt - r1 - Math.max(numsH, n <= 600 ? c1.statsFallbackHNarrow : c1.statsFallbackH) - c1.drawingStatsGap;
      var h1 = ((CAM.bbox[1] + CAM.bbox[3] - camFinal.y) / camFinal.h) * hgt;
      camFinal.y += ((h1 - o1) / hgt) * camFinal.h;
      if (els.metrics) els.metrics.style.setProperty('--metrics-gap', r1 + 'px');
    } else {
      var e1 = ((CAM.bbox[1] + CAM.bbox[3] - camFinal.y) / camFinal.h) * hgt;
      var gap = Math.max(hgt - e1 - K.gapB, 16);
      if (els.metrics) els.metrics.style.setProperty('--metrics-gap', gap + 'px');
    }

    /* reset state */
    D.cam.x = camInit.x; D.cam.y = camInit.y; D.cam.w = camInit.w; D.cam.h = camInit.h;
    D.camInit = camInit; D.camSegs = [];
    var easeDive = easeFn('firstCamDive', function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; });
    var easePull = easeFn('power2.inOut', easeInOut2);
    writeViewBox();
    D.G = freshG(); HERO.G = D.G; HERO.cam = D.cam;
    D.metricsActive = false;
    if (els.metricsNums) els.metricsNums.dataset.active = '0';
    countUp(els.metrics || section, false, reduce);
    cardImmediate(-1);
    D.cols.forEach(function (c) { c.segs = []; c.lastKey = null; });
    D.details.forEach(function (c) { if (c) { c.initialDrawn = false; writeSettled(c, false); } });
    D.fades.forEach(function (c) { if (c) { c.initialDrawn = true; c.deferInit = true; writeSettled(c, true); } });
    if (D.hotel) { D.hotel.initialDrawn = false; writeSettled(D.hotel, false); }
    if (D.words && D.words.length) gsap.set(D.words, { opacity: 0 });
    if (els.marquee) gsap.set(els.marquee, { opacity: 0 });

    var c = [], u = [], d = [], m = [];
    var tl;
    if (reduce) {
      tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: onTick });
    } else {
      tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: function () { return '+=' + window.innerHeight * K.pinViewports; },
          scrub: K.scrub,
          pin: stage,
          anticipatePin: 1,
          invalidateOnRefresh: true
        },
        onUpdate: onTick
      });
    }
    D.tl = tl; HERO.timeline = tl;

    /* --- beat 1: blur, buildings draw in, words stagger, marquee fades (Lance g … v) --- */
    var g = 0;                                   /* the headline beat is dropped: g = 0 */
    var y = g + K.drawIn / 2, v = g + K.drawIn;
    tl.fromTo(D.G, { blur: 0 }, { blur: K.blurMax, duration: y, ease: 'none', immediateRender: false }, 0);
    if (D.hotel) addSeg(D.hotel, 'in', K.drawIn, g);
    tl.to({}, { duration: K.drawIn }, g);
    if (D.words && D.words.length) {
      tl.to(D.words, { opacity: 1, duration: K.wordDur, stagger: { amount: Math.max(K.drawIn - K.wordDur, 0), from: 'start' }, ease: 'power2.out' }, g);
    }
    if (els.marquee) tl.to(els.marquee, { opacity: 1, duration: K.marqueeDur, ease: 'power2.out' }, g);
    tl.to({}, { duration: 0 }, v);
    tl.to({}, { duration: K.hold1 });
    tl.to({}, { duration: K.hold2 });

    /* --- trust out, vignette in, first dive (Lance x … _) --- */
    var x = tl.duration();
    tl.fromTo(D.G, { trust: 1 }, { trust: 0, duration: K.trustOut, ease: 'power2.inOut', immediateRender: false }, x);
    var _ = x + K.trustOut - K.overlap;
    var A = _ + .85 * K.firstDive;
    tl.fromTo(D.G, { vignette: 0 }, { vignette: 1, duration: A - _, ease: 'none', immediateRender: false }, _);

    /* --- the five stops --- */
    STOPS.forEach(function (stop, e) {
      var i = cams[e], s = D.fades[e], r = D.details[e];
      var a = e > 0 ? D.fades[e - 1] : null, nn = e > 0 ? D.details[e - 1] : null;
      if (e === 0) {
        D.camSegs.push({ t0: _, dur: K.firstDive, from: camInit, to: i, mid: null, ease: easeDive });
        tl.to({}, { duration: K.firstDive }, _);
        u.push(_ + K.firstDive); d.push(_ + K.firstDive); m.push(_ + K.firstDive / 2);
      } else {
        var t = c[e - 1] + K.holdStop;
        if (nn) addSeg(nn, 'out', K.draw, t);
        var s2 = t + K.draw, r2 = Math.max(t, s2 - K.fadeLead);
        d.push(r2 + K.draw);
        if (a) addSeg(a, 'in', K.draw, r2);
        var mid = midCam(cams[e - 1], i, K.zoomOut), prev = cams[e - 1];
        /* Lance: keyframes [{...mid, .45}, {...i, .55}] with the quintic across the whole tween (linear inside each keyframe) */
        D.camSegs.push({ t0: s2, dur: K.fly, from: prev, to: i, mid: mid, ease: quintInOut });
        tl.to({}, { duration: K.fly }, s2);
        u.push(s2 + K.fly); m.push(s2 + K.fly / 2);
      }
      var o2 = u[u.length - 1], h = e === 0 ? _ : o2 - K.fly;
      var f = s ? Math.max(h, o2 - K.draw) : o2;
      if (s) addSeg(s, 'out', K.draw, f);
      var g2 = o2;
      if (r) addSeg(r, 'in', K.draw, g2);
      c.push(g2 + (r ? K.draw : 0));
      if (e === STOPS.length - 1) {
        var t2 = c[e] + K.holdLast;
        tl.to({}, { duration: K.holdLast }, c[e]);
        var i2 = t2, a2 = i2 + (r ? K.draw : 0);
        if (r) addSeg(r, 'out', K.draw, i2);
        var n2 = a2, o3 = n2 + (s ? K.draw : 0);
        if (s) addSeg(s, 'in', K.draw, n2);
        tl.fromTo(D.G, { hudOut: 0 }, { hudOut: 1, duration: s ? K.draw : .01, ease: 'power2.inOut', immediateRender: false }, n2);
        var h2 = o3;
        D.tPull = h2;
        D.camSegs.push({ t0: h2, dur: K.pullOut, from: i, to: camFinal, mid: null, ease: easePull });
        tl.to({}, { duration: K.pullOut }, h2);
        tl.fromTo(D.G, { sand: 0, overlay: 1 }, { sand: 1, overlay: 0, duration: .55 * K.pullOut, ease: 'power2.out', immediateRender: false }, h2);
        var p2 = h2 + K.pullOut * K.metricsTextAt, f2 = h2 + K.pullOut * K.metricsNumsAt;
        tl.fromTo(D.G, { metricsText: 0 }, { metricsText: 1, duration: K.metricsDur, ease: 'power2.inOut', immediateRender: false }, p2);
        tl.fromTo(D.G, { metricsNums: 0 }, { metricsNums: 1, duration: K.metricsDur, ease: 'power2.inOut', immediateRender: false }, f2);
        tl.to({}, { duration: K.endHold }, Math.max(p2, f2) + K.metricsDur);
        D.keys = [{ at: 0, t: x }];   /* reduced motion: the settled states */
        return;
      }
      tl.to({}, { duration: K.holdStop }, c[e]);
    });

    /* video gone by the dive's midpoint */
    var P = _ + K.firstDive / 2;
    tl.fromTo(D.G, { overlay: .4, video: 1 }, { overlay: 1, video: 0, duration: Math.max(P - v, .01), ease: 'none', immediateRender: false }, v);

    var S = tl.duration();
    D.L = _ / S;
    D.T = c.map(function (t) { return t / S; });
    D.E = u.map(function (t) { return t / S; });
    D.F = d.map(function (t) { return t / S; });
    D.I = m.map(function (t) { return t / S; });
    D.j = -1;
    D.st = tl.scrollTrigger || null;
    HERO.scrollTrigger = D.st;
    HERO.fractions = { hudIn: D.L, departures: D.T, arrivals: D.E, hudSwitch: D.F, midpoints: D.I, duration: S };

    if (reduce) {
      /* quantised: before the dive → the drawn buildings; stop e → c[e]; after the last departure → the end */
      D.keys = [{ at: 0, t: x }];
      u.forEach(function (t, e) { D.keys.push({ at: t / S, t: c[e] }); });
      D.keys.push({ at: (D.tPull + K.pullOut * .3) / S, t: S });   /* the sand beat: once the pull-out is underway */
      D.st = ST.create({
        trigger: section, start: 'top top', end: function () { return '+=' + window.innerHeight * K.pinViewports; },
        pin: stage, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (self) { seekReduced(self.progress); }, onRefresh: function (self) { seekReduced(self.progress); }
      });
      HERO.scrollTrigger = D.st;
      seekReduced(D.st.progress);
    } else {
      onTick();
      syncCard(true);
    }
  }
  function seekReduced(p) {
    var tl = D.tl; if (!tl) return;
    var t = D.keys[0].t;
    for (var i = 0; i < D.keys.length; i++) if (p >= D.keys[i].at) t = D.keys[i].t;
    if (Math.abs(tl.time() - t) > 1e-6) { tl.time(t); }
    camAt(tl.time(), D.cam); writeViewBox(); renderDrawing(tl.time(), false); updateHud(p); syncCard(true);
    var active = D.G.metricsNums > .15;
    if (active !== D.metricsActive) { D.metricsActive = active; if (els.metricsNums) els.metricsNums.dataset.active = active ? '1' : '0'; countUp(els.metrics || section, active, true); }
  }

  /* ---------- scroll helpers (Lance t_ tA R N O) ---------- */
  function setProgress(p) {                                                          /* t_ */
    if (!D.tl) return;
    var e = clamp01(p);
    gsap.killTweensOf(D.tl);
    if (reduced()) seekReduced(e); else { D.tl.progress(e); onTick(); syncCard(true); }
  }
  function scrollToProgress(p) {                                                     /* tA */
    if (!D.tl) return;
    var e = clamp01(p), st = D.st;
    if (st) {
      var y = st.start + (st.end - st.start) * e, l = getLenis();
      if (l) l.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      ST.update();
    }
    setProgress(e);
  }
  function goToStop(e) {                                                             /* R */
    var st = D.st; if (!st || D.T[e] == null) return;
    var y = st.start + (st.end - st.start) * D.T[e], l = getLenis();
    if (l) l.scrollTo(y, { immediate: true }); else st.scroll(y);
  }
  function skip() {                                                                  /* N */
    var st = D.st; if (!st) return;
    var l = getLenis();
    if (l) l.scrollTo(st.end, { immediate: true }); else st.scroll(st.end);
  }
  function walk() {                                                                  /* O */
    var st = D.st, l = getLenis(), r = reduced();
    var span = st ? st.end - st.start : 0;
    var y = st ? st.start + Math.min(.85 * window.innerHeight, .08 * span) : window.scrollY + .85 * window.innerHeight;
    if (l) l.scrollTo(y, { duration: r ? 0 : 1.15 }); else window.scrollTo({ top: y, behavior: r ? 'auto' : 'smooth' });
  }
  function currentScroll() { var l = getLenis(); return (l && l.scroll != null) ? l.scroll : (window.scrollY || 0); }   /* tC */

  /* ---------- resize: kill + rebuild (Lance tT) ---------- */
  function onResize() {
    cancelAnimationFrame(D.raf);
    D.raf = requestAnimationFrame(function () {
      if (!D.inited) return;
      if (matchMedia(MOBILE_MQ).matches !== (HERO.mode === 'mobile')) { applyMode(); return; }
      if (!D.svg || !D.tl) return;
      var st = D.st, e = currentScroll(), i = st ? st.start : 0, s = st ? st.end : 0;
      var inside = !!st && e >= i && e <= s;
      var a = reduced() ? (st ? st.progress : 0) : D.tl.progress();
      var n = e - s;
      var prevEnd = s, prevProg = st ? st.progress : 0;
      teardownTimeline();
      build();
      ST.refresh();
      if (inside) { scrollToProgress(a); return; }
      var h = e;
      if (D.st && e > prevEnd) h = D.st.end + n;
      var l = getLenis();
      if (l) l.scrollTo(h, { immediate: true }); else window.scrollTo(0, h);
      ST.update();
      setProgress(D.st ? D.st.progress : +(h >= prevEnd) * prevProg);
    });
  }
  function teardownTimeline() {
    if (D.Y) { D.Y.kill(); D.Y = null; }
    if (D.st) { D.st.kill(); D.st = null; }
    if (D.tl) { D.tl.kill(); D.tl = null; }
    HERO.timeline = null; HERO.scrollTrigger = null;
  }

  /* ---------- init / destroy ---------- */
  function initDesktop() {
    if (D.inited || !stage) return;
    D.inited = true;
    var reduce = reduced();
    if (CustomEase && gsap && !CustomEase.get('firstCamDive')) CustomEase.create('firstCamDive', 'M0,0 C0.48,0 0.18,1 1,1');

    /* trust words: split at runtime (Lance renders <span><span class="trust-word">w</span> </span>) */
    if (els.trustP && !els.trustP.querySelector('.trust-word')) {
      var words = els.trustP.textContent.trim().split(/\s+/);
      els.trustP.textContent = '';
      words.forEach(function (w, i) {
        var outer = document.createElement('span');
        var inner = document.createElement('span');
        inner.className = 'trust-word';
        inner.textContent = w;
        inner.style.opacity = '0';
        outer.appendChild(inner);
        if (i < words.length - 1) outer.appendChild(document.createTextNode(' '));
        els.trustP.appendChild(outer);
      });
    }
    D.words = els.trustP ? Array.prototype.slice.call(els.trustP.querySelectorAll('.trust-word')) : [];

    section.querySelectorAll('[data-hero-marquee-track]').forEach(fillMarquee);
    initWalk(els.walk, walk);
    if (els.walkWrap) {
      if (reduce || !gsap) els.walkWrap.style.opacity = '1';
      else gsap.fromTo(els.walkWrap, { opacity: 0 }, { opacity: 1, duration: 1, delay: .28, ease: 'power2.out' });
    }
    if (stage) mountPanels(stage, reduce);
    stopButtons.forEach(function (b, e) { b.addEventListener('click', function () { goToStop(e); }); });
    els.skips.forEach(function (b) { b.addEventListener('click', skip); });
    if (els.video) { var p = els.video.play(); if (p && p.catch) p.catch(function () {}); }

    if (!gsap || !ST) {
      /* no GSAP: leave the first frame static and let the page scroll past it */
      if (els.trust) els.trust.style.opacity = '1';
      if (D.words.length) D.words.forEach(function (w) { w.style.opacity = '1'; });
      if (els.marquee) els.marquee.style.opacity = '1';
      return;
    }

    loadDrawing().then(function (text) {
      if (!D.inited || !els.map) return;
      if (!text) { if (window.console) console.warn('[hero] /assets/img/hq.svg missing — the walkthrough runs without the drawing'); }
      else els.map.innerHTML = text;
      D.svg = els.map.querySelector('svg');
      if (D.svg) {
        prepSvg(D.svg);
        var N = STOPS.map(function (s) { return D.svg.querySelector('[id="' + s.detailId + '"]'); });
        var O = STOPS.map(function (s) { return D.svg.querySelector('[id="' + s.fadeId + '"]'); });
        D.details = N.map(function (g) { return g ? collect(g) : null; });
        D.fades = O.map(function (g) { return g ? collect(g) : null; });
        var hotel = D.svg.querySelector('[id="hotel-drawing"]');
        D.hotel = hotel ? collect(hotel) : null;
        D.cols = [];
        if (D.hotel) D.cols.push(D.hotel);
        D.fades.forEach(function (c) { if (c) D.cols.push(c); });
        D.details.forEach(function (c) { if (c) D.cols.push(c); });
        if (window.console) {
          STOPS.forEach(function (s, e) { if (!N[e]) console.warn('[hero] drawing group ' + s.detailId + ' not found'); if (!O[e]) console.warn('[hero] drawing group ' + s.fadeId + ' not found'); });
        }
      } else {
        /* no drawing: a placeholder svg keeps the camera maths alive */
        els.map.innerHTML = '<svg viewBox="0 0 44001 21918" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg>';
        D.svg = els.map.querySelector('svg');
        D.cols = []; D.hotel = null; D.fades = []; D.details = [];
      }
      build();
      requestAnimationFrame(function () { ST.refresh(); if (D.tl) { if (reduced()) seekReduced(D.st ? D.st.progress : 0); else { onTick(); syncCard(true); } } });
    });
    window.addEventListener('resize', onResize);
  }
  function destroyDesktop() {
    if (!D.inited) return;
    D.inited = false;
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(D.raf);
    teardownTimeline();
    if (els.map) els.map.innerHTML = '';
    D.svg = null; D.cols = []; D.hotel = null; D.fades = []; D.details = [];
    if (els.video && !els.video.paused) els.video.pause();
    section.dataset.nav = 'dark'; section.dataset.navFill = 'bg-transparent';
    stage.style.backgroundColor = '';
  }

  /* ---------- mode ---------- */
  function applyMode() {
    var mobile = matchMedia(MOBILE_MQ).matches;
    var next = mobile ? 'mobile' : 'desktop';
    if (next === HERO.mode) return;
    if (HERO.mode === 'desktop') destroyDesktop();
    if (HERO.mode === 'mobile' && HERO.mobile) HERO.mobile.destroy();
    HERO.mode = next;
    section.dataset.mode = next;
    if (next === 'desktop') initDesktop();
    else if (HERO.mobile) HERO.mobile.init();
    if (window.hypjamNav && window.hypjamNav.refresh) window.hypjamNav.refresh();
  }

  HERO.goToStop = goToStop;
  HERO.skip = skip;
  HERO.walk = walk;
  HERO.rebuild = function () { if (HERO.mode === 'desktop') onResize(); };
  HERO.applyMode = applyMode;
  HERO.setProgress = setProgress;
  HERO.scrollToProgress = scrollToProgress;
  HERO.desktop = D;

  function start() {
    applyMode();
    var mq = matchMedia(MOBILE_MQ);
    if (mq.addEventListener) mq.addEventListener('change', function () { applyMode(); });
    else if (mq.addListener) mq.addListener(function () { applyMode(); });
    window.addEventListener('resize', function () { if (HERO.mode === 'mobile' && !matchMedia(MOBILE_MQ).matches) applyMode(); });
  }
  /* site.js is deferred, so this runs while readyState is 'interactive' and 21-hero-mobile.js
     has not registered yet — wait for DOMContentLoaded unless the document is already complete */
  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start);
})();

/* ---- src/js/21-hero-mobile.js ---- */
/* ==========================================================================
   21-hero-mobile.js — Lance's phone experience for the hero (≤ 1024px).
   Port of the `e_` component in ref/hero_chunk.pretty.js (lines 19391–19680):
     · video screen: paragraph + walk hint fade in on mount (Lance fades its
       h1 / sub / button at .15 / .35 / .5s), the hint scrolls to the body;
     · black body: marquee, the whole drawing (viewBox = bbox + 2% margin,
       details hidden, fades drawn) which draws itself in over 3.2s the
       first time 15% of it is on screen;
     · accordion (`eb`): one open row at a time, grid-template-rows
       transition, the panel mounts and plays while open;
     · outcomes (`ek`): the numbers count up (1100ms, 160ms per item) the
       first time 25% of the section is visible.
   Registers window.hypjamHero.mobile = { init, destroy }; 20-hero.js
   calls init()/destroy() when the mode flips at 1024px.
   ========================================================================== */
(function () {
  'use strict';
  var H = window.hypjamHero;
  if (!H || !H.util) return;
  var U = H.util;

  var root = document.querySelector('[data-hero-mobile]');
  if (!root) return;

  var state = { inited: false, observers: [], intro: null, drawTl: null, drawn: false, open: -1, mounted: false, svg: null };

  function init() {
    if (state.inited) return;
    state.inited = true;
    var reduce = U.reduced();
    var gsap = window.gsap;

    /* video: load lazily (the desktop stage owns the eager one) */
    var vid = root.querySelector('.hero-m-vid');
    if (vid && !vid.getAttribute('src') && vid.dataset.src) {
      vid.setAttribute('src', vid.dataset.src);
      vid.load();
      var p = vid.play(); if (p && p.catch) p.catch(function () {});
    }

    /* intro fades (Lance: h1 .7s @ .15, sub .6s @ .35, button .55s @ .5) */
    var para = root.querySelector('[data-hero-m-p]');
    var walk = root.querySelector('[data-hero-m-walk]');
    U.initWalk(walk, function () {
      var body = root.querySelector('[data-hero-m-body]');
      if (body) body.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    if (reduce || !gsap) {
      if (para) para.style.opacity = '1';
      if (walk) walk.style.opacity = '1';
    } else {
      gsap.set([para, walk].filter(Boolean), { opacity: 0 });
      state.intro = gsap.timeline({ defaults: { ease: 'power2.out' } });
      if (para) state.intro.to(para, { opacity: 1, duration: .7 }, .15);
      if (walk) state.intro.to(walk, { opacity: 1, duration: .55 }, .5);
    }

    /* marquee: six groups like Lance */
    root.querySelectorAll('[data-hero-marquee-track]').forEach(U.fillMarquee);

    /* panels: size the hosts, mount paused */
    U.mountPanels(root, reduce);
    root.querySelectorAll('[data-hero-m-panel-box]').forEach(function (box) {
      var panel = box.querySelector('[data-hero-panel]');
      var h = panel ? U.panelHeight(panel) : 184;
      box.style.aspectRatio = '321 / ' + h;
      if (panel) panel.style.height = h + 'px';
    });
    fitPanels();
    window.addEventListener('resize', fitPanels);

    /* accordion */
    root.querySelectorAll('[data-hero-m-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggle(+btn.dataset.index); });
    });

    /* drawing: fetch, whole-drawing viewBox, draw in when 15% visible */
    var map = root.querySelector('[data-hero-m-map]');
    var stage = root.querySelector('[data-hero-m-drawing]');
    if (map && stage) {
      U.loadDrawing().then(function (text) {
        if (!state.inited || !text) return;
        map.innerHTML = text;
        var svg = map.querySelector('svg');
        if (!svg) return;
        state.svg = svg;
        U.prepSvg(svg);
        var b = U.CAM.bbox, c = .02 * b[2];
        svg.setAttribute('viewBox', (b[0] - c) + ' ' + (b[1] - c) + ' ' + (b[2] + 2 * c) + ' ' + (b[3] + 2 * c));
        U.STOPS.forEach(function (s) {
          var d = svg.querySelector('[id="' + s.detailId + '"]'); if (d) d.style.display = 'none';
          var f = svg.querySelector('[id="' + s.fadeId + '"]'); if (f) U.writeSettled(U.collect(f), true);
        });
        var hotel = svg.querySelector('[id="hotel-drawing"]');
        if (!hotel) return;
        var col = U.collect(hotel);
        U.writeSettled(col, false);
        var scale = function () { var r = stage.getBoundingClientRect(); return r.width / (b[2] + 2 * c); };
        var drawIn = function () {
          if (state.drawn) return;
          state.drawn = true;
          if (reduce || !gsap) { U.writeSettled(col, true); return; }
          var seg = { t0: 0, dur: 3.2, dir: 'in' };
          var prox = { t: 0 };
          state.drawTl = gsap.timeline({ onComplete: function () { U.writeSettled(col, true); } });
          state.drawTl.to(prox, { t: 3.2, duration: 3.2, ease: 'none', onUpdate: function () { U.writeLive(col, seg, prox.t, scale()); } }, 0);
        };
        var io = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting && e.intersectionRatio > .15; })) { drawIn(); io.disconnect(); }
        }, { threshold: [.15, .25] });
        io.observe(stage);
        state.observers.push(io);
      });
    }

    /* outcomes */
    var out = root.querySelector('[data-hero-m-outcomes]');
    if (out) {
      var io2 = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting && e.intersectionRatio > .25; })) {
          out.dataset.active = '1';
          U.countUp(out, true, reduce);
          io2.disconnect();
        }
      }, { threshold: [.25] });
      io2.observe(out);
      state.observers.push(io2);
    }
  }

  function fitPanels() {
    root.querySelectorAll('[data-hero-m-panel-box]').forEach(function (box) {
      var panel = box.querySelector('[data-hero-panel]');
      if (!panel) return;
      var w = box.getBoundingClientRect().width || 321;
      panel.style.setProperty('--pnl-scale', String(w / 321));
    });
  }

  function toggle(i) {
    var rows = root.querySelectorAll('[data-hero-m-toggle]');
    var regions = root.querySelectorAll('.hero-m-region');
    var next = state.open === i ? -1 : i;
    rows.forEach(function (btn, k) {
      var on = k === next;
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (regions[k]) regions[k].dataset.open = on ? 'true' : 'false';
      var panel = regions[k] && regions[k].querySelector('[data-hero-panel]');
      if (panel) U.setPanelActive(panel, on);
    });
    state.open = next;
  }

  function destroy() {
    if (!state.inited) return;
    state.inited = false;
    state.observers.forEach(function (o) { o.disconnect(); });
    state.observers = [];
    if (state.intro) { state.intro.kill(); state.intro = null; }
    if (state.drawTl) { state.drawTl.kill(); state.drawTl = null; }
    window.removeEventListener('resize', fitPanels);
    root.querySelectorAll('[data-hero-panel]').forEach(function (p) { U.setPanelActive(p, false); });
    var map = root.querySelector('[data-hero-m-map]');
    if (map) map.innerHTML = '';
    state.svg = null;
    state.drawn = false;
  }

  H.mobile = { init: init, destroy: destroy, state: state };
  /* if the engine already chose the mobile mode before this file registered, start now */
  if (H.mode === 'mobile') init();
})();

/* ---- src/js/30-quotes.js ---- */
/* ==========================================================================
   30-quotes.js — the home quotes section (Lance #testimonials, ported from
   the React component in ref/hero_chunk.pretty.js ~19760–20100).

   Mechanism (Lance's, time-based — it is NOT scroll-scrubbed):
     · every word of the active quote is a <span class="quo-w">;
     · on activation the words are grouped into LINES by offsetTop (words
       within 4px share a line) and each line fades in over 420ms with a
       90ms delay per line; the attribution follows at (lines + k) × 90ms
       (k = data-quo-fade: 0 for signature + name, 1 for role + logo);
     · switching slides first fades everything out over 260ms, then swaps
       the slide, then reveals; backgrounds crossfade over 700ms (CSS);
     · autoplay every 5s (data-quo-interval) while the section is ≥10% in
       view and the card is not hovered/focused; off under reduced motion;
     · thumbnails (57×36) switch slides; a 2px frame slides 65px per slot.
   Ours gates the FIRST reveal on the section entering the viewport (Lance
   reveals on mount, 13k px below the fold, which nobody sees).
   Without JS every word simply stays visible.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-quo]');
  if (!root) return;

  var FADE_OUT = 260, FADE_IN = 420, LINE_STAGGER = 90, THUMB_STEP = 57 + 8;
  var interval = parseInt(root.getAttribute('data-quo-interval'), 10) || 5000;

  var slides = [].slice.call(root.querySelectorAll('[data-quo-slide]'));
  var bgs = [].slice.call(root.querySelectorAll('[data-quo-bg]'));
  var thumbs = [].slice.call(root.querySelectorAll('[data-quo-thumb]'));
  var frame = root.querySelector('[data-quo-frame]');
  var card = root.querySelector('[data-quo-card]');
  if (!slides.length || !card) return;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduce = !!(mq && mq.matches);

  /* ---- split each quote into word spans (Lance: text.split(' '), trailing space inside the span) ---- */
  slides.forEach(function (slide) {
    var p = slide.querySelector('[data-quo-words]');
    if (!p || p.querySelector('.quo-w')) return;
    var text = p.textContent.replace(/\s+/g, ' ').trim();
    var words = text.split(' ');
    p.textContent = '';
    words.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'quo-w';
      span.textContent = w + (i < words.length - 1 ? ' ' : '');
      p.appendChild(span);
    });
  });

  function words(slide) { return [].slice.call(slide.querySelectorAll('.quo-w')); }
  function fades(slide) { return [].slice.call(slide.querySelectorAll('[data-quo-fade]')); }

  function hide(slide, instant) {
    words(slide).concat(fades(slide)).forEach(function (el) {
      el.style.transition = instant ? 'none' : 'opacity ' + FADE_OUT + 'ms ease-in-out 0ms';
      el.style.opacity = '0';
    });
  }
  function showInstant(slide) {
    words(slide).concat(fades(slide)).forEach(function (el) {
      el.style.transition = 'none';
      el.style.opacity = '1';
    });
  }
  function reveal(slide) {
    var ws = words(slide);
    var lines = [];
    var lineOf = ws.map(function (w) {
      var top = w.offsetTop, k = -1;
      for (var i = 0; i < lines.length; i++) { if (Math.abs(lines[i] - top) < 4) { k = i; break; } }
      if (k < 0) { lines.push(top); k = lines.length - 1; }
      return k;
    });
    var n = lines.length || 1;
    ws.forEach(function (w, i) {
      w.style.transition = 'opacity ' + FADE_IN + 'ms ease-in-out ' + (lineOf[i] * LINE_STAGGER) + 'ms';
      w.style.opacity = '1';
    });
    fades(slide).forEach(function (el) {
      var k = parseInt(el.getAttribute('data-quo-fade'), 10) || 0;
      el.style.transition = 'opacity ' + FADE_IN + 'ms ease-in-out ' + ((n + k) * LINE_STAGGER) + 'ms';
      el.style.opacity = '1';
    });
  }

  /* ---- state ---- */
  var cur = 0, started = false, inView = false, paused = false;
  var timer = null, swapTimer = null, raf1 = 0, raf2 = 0;

  function setChrome(i) {
    bgs.forEach(function (b, k) { b.classList.toggle('is-active', k === i); });
    thumbs.forEach(function (t, k) {
      t.classList.toggle('is-active', k === i);
      if (k === i) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
    });
    if (frame) frame.style.transform = 'translateX(' + (i * THUMB_STEP) + 'px)';
    card.classList.toggle('is-reserved', slides[i].hasAttribute('data-quo-reserved'));
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (reduce || paused || !inView || !started) return;
    timer = setTimeout(function () { go((cur + 1) % slides.length); }, interval);
  }

  function swap(i) {
    slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    cur = i;
    var slide = slides[i];
    if (reduce) { showInstant(slide); schedule(); return; }
    hide(slide, true);
    cancelAnimationFrame(raf1); cancelAnimationFrame(raf2);
    raf1 = requestAnimationFrame(function () {
      raf2 = requestAnimationFrame(function () { reveal(slide); schedule(); });
    });
  }

  function go(i) {
    i = ((i % slides.length) + slides.length) % slides.length;
    clearTimeout(timer); timer = null;
    clearTimeout(swapTimer); swapTimer = null;
    setChrome(i);
    if (i === cur && started) { schedule(); return; }
    var prev = slides[cur];
    if (reduce || !started) { swap(i); return; }
    hide(prev, false);
    swapTimer = setTimeout(function () { swap(i); }, FADE_OUT);
  }

  function start() {
    if (started) return;
    started = true;
    swap(cur);
  }

  /* ---- initial state: everything hidden until the section scrolls into view ---- */
  if (reduce) {
    slides.forEach(function (s) { showInstant(s); });
    started = true;
  } else {
    slides.forEach(function (s) { hide(s, true); });
  }
  setChrome(cur);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView && !started) start();
      else schedule();
    }, { threshold: 0.1 });
    io.observe(root);
  } else {
    inView = true;
    start();
  }

  /* ---- interaction ---- */
  thumbs.forEach(function (t, k) {
    t.addEventListener('click', function () { if (!started) start(); go(k); });
  });
  card.addEventListener('mouseenter', function () { paused = true; schedule(); });
  card.addEventListener('mouseleave', function () { paused = false; schedule(); });
  card.addEventListener('focusin', function () { paused = true; schedule(); });
  card.addEventListener('focusout', function () { paused = false; schedule(); });

  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      reduce = e.matches;
      if (reduce) { clearTimeout(timer); slides.forEach(function (s) { showInstant(s); }); }
      else schedule();
    });
  }
})();

/* ---- src/js/31-features.js ---- */
/* ==========================================================================
   31-features.js — the home features carousel (Lance #features, ported from
   the React component in ref/hero_chunk.pretty.js ~20106–20420).

   · card width = max(400, (containerWidth − 3 × 24) / 4)  → 448 at 1920, so all
     four fit and both arrows are disabled; below ~1700px the row overflows
     and the track translates by index × (width + 24), clamped to the end;
   · prev/next buttons; pointer drag with an 8px threshold (pointer capture,
     "is-dragging" swaps the cursor); release snaps to the nearest index;
   · transition: transform 450ms cubic-bezier(.22, 1, .36, 1), none while dragging;
   · ≤600px (Lance's max-tp) the cards stack — CSS only, inline styles cleared.
   Lance does not scroll-animate the cards; neither do we.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-feat-carousel]');
  if (!root) return;
  var track = root.querySelector('[data-feat-track]');
  if (!track) return;
  var cards = [].slice.call(track.querySelectorAll('[data-feat-card]'));
  var n = cards.length;
  if (!n) return;
  var prev = document.querySelector('[data-feat-prev]');
  var next = document.querySelector('[data-feat-next]');

  var MIN = 400, GAP = 24, THRESHOLD = 8;
  var EASE = 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)';
  var baseLabel = root.getAttribute('aria-label') || 'Feature cards';
  var titles = cards.map(function (c) { var t = c.querySelector('.feat-title'); return t ? t.textContent.trim() : ''; });

  var mq = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;
  var stacked = !!(mq && mq.matches);

  var w = MIN, maxOff = 0, idx = 0, dragX = 0, dragging = false, ptr = null;

  function clampOff(i) { return Math.max(maxOff, Math.min(0, -i * (w + GAP))); }

  function render() {
    if (stacked) {
      track.style.cssText = '';
      cards.forEach(function (c) { c.style.width = ''; c.removeAttribute('aria-current'); });
      root.setAttribute('aria-label', baseLabel);
      root.classList.remove('is-dragging');
      return;
    }
    var off = clampOff(idx) + dragX;
    track.style.gap = GAP + 'px';
    track.style.width = (n * w + (n - 1) * GAP) + 'px';
    track.style.transform = 'translate3d(' + off + 'px, 0, 0)';
    track.style.transition = dragging ? 'none' : EASE;
    track.style.touchAction = 'pan-y';
    var atStart = clampOff(idx) >= -0.5;
    var atEnd = clampOff(idx) <= maxOff + 0.5;
    if (prev) prev.disabled = atStart && idx <= 0;
    if (next) next.disabled = atEnd;
    cards.forEach(function (c, k) {
      c.style.width = w + 'px';
      if (k === idx) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
    root.setAttribute('aria-label', baseLabel + (titles[idx] ? ', showing ' + titles[idx] : ''));
  }

  function measure() {
    var cw = root.clientWidth;
    w = Math.max(MIN, (cw - (n - 1) * GAP) / n);
    maxOff = -Math.max(0, n * w + (n - 1) * GAP - cw);
    idx = Math.min(n - 1, Math.max(0, idx));
    render();
  }

  function goTo(i) { idx = Math.min(n - 1, Math.max(0, i)); dragX = 0; render(); }

  if (prev) prev.addEventListener('click', function () { goTo(idx - 1); });
  if (next) next.addEventListener('click', function () { goTo(idx + 1); });

  /* ---- drag ---- */
  root.addEventListener('pointerdown', function (e) {
    if (stacked || e.button !== 0) return;
    ptr = { id: e.pointerId, startX: e.clientX, origin: dragX, moved: false };
  });
  root.addEventListener('pointermove', function (e) {
    if (!ptr || ptr.id !== e.pointerId) return;
    var delta = e.clientX - ptr.startX;
    if (!ptr.moved) {
      if (Math.abs(delta) <= THRESHOLD) return;
      ptr.moved = true;
      dragging = true;
      root.classList.add('is-dragging');
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var base = clampOff(idx);
    dragX = Math.min(0, Math.max(maxOff, base + ptr.origin + delta)) - base;
    render();
  });
  function release(e) {
    if (!ptr || ptr.id !== e.pointerId) return;
    var moved = ptr.moved;
    var delta = e.clientX - ptr.startX;
    var travelled = ptr.origin + delta;
    ptr = null;
    dragging = false;
    root.classList.remove('is-dragging');
    if (moved) goTo(idx - Math.round(travelled / (w + GAP)));
    else { dragX = 0; render(); }
  }
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  /* ---- layout ---- */
  if (mq) {
    var onMq = function (e) { stacked = e.matches; if (stacked) render(); else measure(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { if (!stacked) measure(); }).observe(root);
  } else {
    window.addEventListener('resize', function () { if (!stacked) measure(); });
  }
  if (stacked) render(); else measure();
})();

/* ---- src/js/32-stories.js ---- */
/* ==========================================================================
   32-stories.js — the brand-stories carousel (src/partials/home/stories.html)
   A port of Lance's story carousel: a transform-driven track (not native
   scroll) with the four cards cloned before and after so prev/next loop
   without end, pointer drag with an 8px threshold that snaps to the nearest
   card on release (Lance's features carousel, ref/hero_chunk.pretty.js
   ~20180: threshold 8, snap = round(drag / pitch), pointer capture,
   touch-action pan-y), and the 620ms cubic-bezier(.22,1,.36,1) glide that
   Lance's track carries inline. The CSS owns the transition; JS only toggles
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

  var DUR = 620;              /* ms · Lance: transition:transform 620ms cubic-bezier(0.22,1,0.36,1) */
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

  /* ---- pointer drag (Lance: threshold, capture, snap to round(drag/pitch)) --- */
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

/* ---- src/js/45-book.js ---- */
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

/* ---- src/panels/brief.js ---- */
/* ==========================================================================
   Panel 1 — brief. Reference implementation of the SPEC.md JS contract.
   Registers window.hypjamPanels.brief = { name, height, mount(el, opts) }.
   mount() returns a gsap timeline (repeat: -1) with labels `loop` and `final`.
   ========================================================================== */
(function () {
  var P = (window.hypjamPanels = window.hypjamPanels || {});

  // Split a text node into one <span> per character so a typewriter can
  // stagger opacity without ever reflowing the bubble. Spaces stay as text so
  // the line still wraps at word boundaries.
  function splitChars(node) {
    if (node.dataset.split === '1') return node.querySelectorAll('span');
    var text = node.textContent;
    node.textContent = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === ' ') {
        frag.appendChild(document.createTextNode(' '));
      } else {
        var s = document.createElement('span');
        s.textContent = ch;
        frag.appendChild(s);
      }
    }
    node.appendChild(frag);
    node.dataset.split = '1';
    return node.querySelectorAll('span');
  }

  P.brief = {
    name: 'brief',
    height: 184,

    mount: function (el, opts) {
      if (!window.gsap || !el) return null;
      opts = opts || {};
      var gsap = window.gsap;
      var autoplay = opts.autoplay !== false;
      var reduced =
        typeof opts.reduced === 'boolean'
          ? opts.reduced
          : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (el.__pnlTl) {
        el.__pnlTl.kill();
        el.__pnlTl = null;
      }

      var q = function (sel) { return el.querySelector(sel); };
      var qa = function (sel) { return el.querySelectorAll(sel); };

      var msg = q('.pnl-brief__msg');
      var from = q('.pnl-brief__from');
      var bubble = q('.pnl-brief__bubble');
      var chars = splitChars(q('.pnl-brief__text'));
      var cursor = q('.pnl-cursor');
      var status = q('.pnl-brief__status');
      var card = q('.pnl-brief__card');
      var head = q('.pnl-brief__head');
      var hr = q('.pnl-brief__card > .pnl-hr');
      var lines = qa('.pnl-brief__line');
      var chips = qa('.pnl-brief__chip');
      var signed = q('.pnl-brief__signed');
      var tick = q('.pnl-brief__signed .pnl-tick path');

      // Initial (hidden) state. Applied once now so the first frame is right,
      // and again inside the timeline at 0 so every repeat resets cleanly.
      var initial = function (t) {
        var set = t ? function (a, b) { t.set(a, b, 0); } : gsap.set;
        set(msg, { opacity: 1, y: 0 });
        set(from, { opacity: 0 });
        set(bubble, { opacity: 0, y: 10 });
        set(chars, { opacity: 0 });
        set(status, { opacity: 0 });
        set(card, { opacity: 0, y: 6 });
        set(head, { opacity: 0, y: 6 });
        set(hr, { opacity: 0 });
        set(lines, { opacity: 0, x: -8 });
        set(chips, { opacity: 0, scale: 0.92, transformOrigin: '0 50%' });
        set(signed, { opacity: 0 });
        set(tick, { strokeDashoffset: 12 });
        set(cursor, { display: 'none' });
        set(el, { opacity: 1 });
      };
      // The static HTML hides the caret with [hidden]; from here on the
      // timeline owns it via display, so seeking in either direction is exact.
      if (cursor) cursor.hidden = false;
      initial(null);

      var tl = gsap.timeline({
        repeat: -1,
        paused: true,
        defaults: { ease: 'power2.inOut' }
      });
      el.__pnlTl = tl;

      tl.addLabel('loop', 0);
      initial(tl);

      // --- Beat A: the message arrives -----------------------------------
      tl.to(from, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0);
      tl.to(bubble, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.15);
      tl.set(cursor, { display: 'inline-block' }, 0.45);
      tl.to(chars, { opacity: 1, duration: 0.01, ease: 'none', stagger: 0.014 }, 0.45);
      // ≈ 0.45 + 72 × .014 ≈ 1.46 → caret keeps blinking to 1.75
      tl.to(status, { opacity: 1, duration: 0.28 }, 1.75);
      // hold 1.2s so "Reading the brief" reads

      // --- Crossfade to Beat B ---------------------------------------------
      tl.set(cursor, { display: 'none' }, 3.25);
      tl.to(msg, { opacity: 0, y: -6, duration: 0.28 }, 3.25);
      tl.to(card, { opacity: 1, y: 0, duration: 0.28 }, 3.35);
      tl.to(head, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 3.45);
      tl.to(hr, { opacity: 1, duration: 0.35 }, 3.5);
      tl.to(lines, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', stagger: 0.26 }, 3.65);
      // chips pop in just after their row (row 2 lands at 3.65 + .26)
      tl.to(chips, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', stagger: 0.08 }, 4.0);
      tl.to(signed, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 4.95);
      tl.to(tick, { strokeDashoffset: 0, duration: 0.45 }, 5.0);

      // --- Final hold, then out ------------------------------------------------
      tl.addLabel('final', 5.45);
      tl.to(el, { opacity: 0, duration: 0.28 }, 7.75);
      tl.set({}, {}, 8.03); // pins the loop length

      if (reduced) {
        tl.pause();
        tl.seek('final');
        return tl;
      }
      if (autoplay) tl.play();
      return tl;
    }
  };
})();

/* ---- src/panels/casting.js ---- */
/* ==========================================================================
   Panel 3 — casting. Follows the SPEC.md JS contract (see brief.js).
   Registers window.hypjamPanels.casting = { name, height, mount(el, opts) }.
   mount() returns a gsap timeline (repeat: -1) with labels `loop` and `final`.

   Five roster rows slide in; three are shortlisted — the city tag fades, then
   yields its width to a slot that opens empty and only then fades in a jam tick
   and chip, so no glyph is ever sliced by a moving edge. The counter dissolves
   0 → 1 → 2 → 3; the two rows that were not picked recede.
   ========================================================================== */
(function () {
  var P = (window.hypjamPanels = window.hypjamPanels || {});

  var PICK_AT = [2.9, 3.5, 4.1];   // SPEC §10.3: CR-014, CR-031, CR-052
  var SLOT_MAX = 160;              // px ceiling the slot opens to; the slot is
                                   // flex:0 0 auto so it settles at its own
                                   // content width — never measured, never
                                   // dependent on when the webfont lands.

  function kids(node) {
    return Array.prototype.slice.call(node.children);
  }

  P.casting = {
    name: 'casting',
    height: 205,

    mount: function (el, opts) {
      if (!window.gsap || !el) return null;
      opts = opts || {};
      var gsap = window.gsap;
      var autoplay = opts.autoplay !== false;
      var reduced =
        typeof opts.reduced === 'boolean'
          ? opts.reduced
          : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (el.__pnlTl) {
        el.__pnlTl.kill();
        el.__pnlTl = null;
      }

      var q = function (sel) { return el.querySelector(sel); };
      var qa = function (sel) { return el.querySelectorAll(sel); };

      var head = q('.pnl-casting__head');
      var digits = qa('.pnl-casting__n > span');   // "0" "1" "2" "3", stacked
      var hr = q('.pnl-casting__hr');
      var rows = qa('.pnl-casting__row');
      var picks = qa('.pnl-casting__row--picked .pnl-casting__pick');
      var ticks = qa('.pnl-casting__row--picked .pnl-tick path');
      var cities = qa('.pnl-casting__row--picked .pnl-casting__tag--city');
      var dimCells = qa('.pnl-casting__row--dim > .pnl-cell');
      var pickKids = [];
      for (var k = 0; k < picks.length; k++) pickKids.push(kids(picks[k]));

      // Initial (hidden) state. Applied once now so the first frame is right,
      // and again inside the timeline at 0 so every repeat resets cleanly.
      var initial = function (t) {
        var set = t ? function (a, b) { t.set(a, b, 0); } : gsap.set;
        set(el, { opacity: 1 });
        set(head, { opacity: 0, y: 6 });
        set(hr, { opacity: 0 });
        set(rows, { opacity: 0, x: -12 });
        set(picks, { maxWidth: 0 });
        set(ticks, { strokeDashoffset: 12 });
        set(cities, { maxWidth: 200, paddingLeft: 7, paddingRight: 7, marginLeft: 0, opacity: 1 });
        set(dimCells, { opacity: 1 });
        set(digits, { opacity: 0 });
        set(digits[0], { opacity: 1 });
        for (var i = 0; i < pickKids.length; i++) set(pickKids[i], { opacity: 0 });
      };
      initial(null);

      var tl = gsap.timeline({
        repeat: -1,
        paused: true,
        defaults: { ease: 'power2.inOut' }
      });
      el.__pnlTl = tl;

      tl.addLabel('loop', 0);
      initial(tl);

      // --- Head, then the five rows slide in -----------------------------------
      tl.to(head, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0);
      tl.to(hr, { opacity: 1, duration: 0.3 }, 0.05);
      tl.to(rows, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', stagger: 0.2 }, 0.3);
      // the last row lands at 1.5; the roster then holds 1.4s to be read

      // --- Three creators are shortlisted --------------------------------------
      for (var i = 0; i < PICK_AT.length; i++) {
        var t = PICK_AT[i];
        // 1. the city tag fades out before it moves, so its rounded edge is
        //    never caught half-clipped by its own collapsing box
        tl.to(cities[i], { opacity: 0, duration: 0.16, ease: 'power2.out' }, t);
        // 2. it collapses and the slot opens by the same amount, together, so
        //    the row's other chips never shuffle
        tl.to(cities[i], { maxWidth: 0, paddingLeft: 0, paddingRight: 0, marginLeft: -4, duration: 0.26 }, t + 0.1);
        tl.to(picks[i], { maxWidth: SLOT_MAX, duration: 0.26 }, t + 0.1);
        // 3. only once the slot is fully open do its contents appear — a plain
        //    fade, so the opening edge can never slice a letterform
        tl.to(pickKids[i], { opacity: 1, duration: 0.28, ease: 'power2.out' }, t + 0.38);
        tl.to(ticks[i], { strokeDashoffset: 0, duration: 0.4 }, t + 0.42);
        // 4. the counter dissolves to the next number — a tween of opacities,
        //    not a callback, so any seek in either direction renders it exactly.
        //    The two digits share one grid cell, so the swap is sequential: the
        //    old one is gone before the new one starts, never superimposed.
        tl.to(digits[i], { opacity: 0, duration: 0.12, ease: 'power2.out' }, t + 0.28);
        tl.to(digits[i + 1], { opacity: 1, duration: 0.12, ease: 'power2.out' }, t + 0.4);
      }
      // last tick finishes at 4.92

      // --- The rest recede -----------------------------------------------------------
      tl.to(dimCells, { opacity: 0.5, duration: 0.4 }, 4.6);

      // --- Final hold, then out -----------------------------------------------------
      tl.addLabel('final', 5.0);
      tl.to(el, { opacity: 0, duration: 0.28 }, 7.4);
      tl.set({}, {}, 7.7); // pins the loop length

      if (reduced) {
        tl.pause();
        tl.seek('final');
        return tl;
      }
      if (autoplay) tl.play();
      return tl;
    }
  };
})();

/* ---- src/panels/hooks.js ---- */
/* ==========================================================================
   Panel 2 — hooks. Follows the SPEC.md JS contract (see brief.js).
   Registers window.hypjamPanels.hooks = { name, height, mount(el, opts) }.
   mount() returns a gsap timeline (repeat: -1) with labels `loop` and `final`.
   Eight hook lines type in one by one into a clipped, scrolling list; the
   counter ticks per line; rows 03 and 06 then take a jam tick, go to ink and
   gain the chip "picked for the shoot".
   ========================================================================== */
(function () {
  var P = (window.hypjamPanels = window.hypjamPanels || {});

  // Split a text node into one <span> per character so a typewriter can
  // stagger opacity without ever reflowing the row. Spaces stay as text.
  function splitChars(node) {
    if (node.dataset.split === '1') return node.querySelectorAll('span');
    var text = node.textContent;
    node.textContent = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === ' ') {
        frag.appendChild(document.createTextNode(' '));
      } else {
        var s = document.createElement('span');
        s.textContent = ch;
        frag.appendChild(s);
      }
    }
    node.appendChild(frag);
    node.dataset.split = '1';
    return node.querySelectorAll('span');
  }

  var ROW = 26;       // row pitch in px (four rows visible in the 104px clip)
  var CHAR = 0.013;   // seconds per character (SPEC §7: .012–.016)
  var GAP = 0.26;     // pause between lines
  var TOTAL = 8;
  // Storyboard marks (SPEC §10.2), held fixed so the panel reads the same
  // whatever the font measures: scroll back, pick 03, pick 06, final, fade.
  var BACK = 6.37, PICK1 = 6.9, PICK2 = 7.5, FINAL = 8.0, OUT = 10.2, END = 10.48;

  P.hooks = {
    name: 'hooks',
    height: 128,

    mount: function (el, opts) {
      if (!window.gsap || !el) return null;
      opts = opts || {};
      var gsap = window.gsap;
      var autoplay = opts.autoplay !== false;
      var reduced =
        typeof opts.reduced === 'boolean'
          ? opts.reduced
          : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (el.__pnlTl) {
        el.__pnlTl.kill();
        el.__pnlTl = null;
      }

      var q = function (sel) { return el.querySelector(sel); };
      var qa = function (sel) { return el.querySelectorAll(sel); };

      var head = q('.pnl-hooks__head');
      var count = q('.pnl-hooks__count');
      var hr = q('.pnl-hooks__hr');
      var track = q('.pnl-hooks__track');
      var rows = qa('.pnl-hooks__row');
      var picked = qa('.pnl-hooks__row--picked');
      var texts = qa('.pnl-hooks__text');
      var picks = qa('.pnl-hooks__pick');
      var ticks = qa('.pnl-hooks__pick .pnl-tick path');

      // Row colours come from the panel tokens, so _panels.css stays the
      // single source: picked rows sit at ink-2 until their pick lands.
      var cs = getComputedStyle(el);
      var INK = (cs.getPropertyValue('--pnl-ink') || '').trim() || '#fff';
      var INK2 = (cs.getPropertyValue('--pnl-ink-2') || '').trim() || '#d9d9d9';

      // Per-character copies are not kerned across the spans, so the plain
      // text stays the settled state and a split overlay types in over it
      // (built once here; a remount reuses it).
      var types = [];
      var lines = [];
      var i;
      for (i = 0; i < texts.length; i++) {
        var cell = texts[i].parentNode;
        var type = cell.querySelector('.pnl-hooks__type');
        if (!type) {
          type = document.createElement('span');
          type.className = 'pnl-hooks__type';
          type.textContent = texts[i].textContent;
          cell.appendChild(type);
        }
        types.push(type);
        lines.push(splitChars(type));
      }

      // Line completion times, filled in while the timeline is built; the
      // counter is derived from them inside a tween's onUpdate so a seek in
      // either direction (and every repeat) writes the right number.
      var lineEnd = [];
      var counter = { t: 0 };
      var writeCount = function (time) {
        var n = 0;
        for (var k = 0; k < lineEnd.length; k++) if (lineEnd[k] <= time) n++;
        var s = n + ' of ' + TOTAL;
        if (count && count.textContent !== s) count.textContent = s;
      };

      // Initial (hidden) state. Applied once now so the first frame is right,
      // and again inside the timeline at 0 so every repeat resets cleanly.
      var initial = function (t) {
        var set = t ? function (a, b) { t.set(a, b, 0); } : gsap.set;
        set(el, { opacity: 1 });
        set(head, { opacity: 0, y: 6 });
        set(hr, { opacity: 0 });
        set(track, { y: 0 });
        set(rows, { opacity: 0 });
        set(picked, { color: INK2 });
        set(texts, { opacity: 0 });
        set(types, { opacity: 1 });
        for (var k = 0; k < lines.length; k++) set(lines[k], { opacity: 0 });
        set(picks, { width: 0, opacity: 0 });
        set(ticks, { strokeDashoffset: 12 });
      };
      initial(null);
      writeCount(0);

      var tl = gsap.timeline({
        repeat: -1,
        paused: true,
        defaults: { ease: 'power2.inOut' }
      });
      el.__pnlTl = tl;

      tl.addLabel('loop', 0);
      initial(tl);

      // --- Head + the empty numbered rows ----------------------------------
      tl.to(head, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0);
      tl.to(hr, { opacity: 1, duration: 0.3 }, 0.05);
      tl.to(rows, { opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.05 }, 0.05);

      // --- Eight lines type in; the list scrolls from line 5 ----------------
      var t = 0.3;
      for (i = 0; i < lines.length; i++) {
        var n = lines[i].length;
        if (i >= 4) {
          // as line 5..8 starts, shift up one row so the newest line is the
          // bottom visible row
          tl.to(track, { y: -ROW * (i - 3), duration: 0.35, ease: 'power2.inOut' }, t);
        }
        tl.to(lines[i], { opacity: 1, duration: 0.01, ease: 'none', stagger: CHAR }, t);
        var end = t + CHAR * (n - 1) + 0.01;
        lineEnd.push(end);
        // line complete: swap the typed overlay for the plain, kerned text
        tl.set(types[i], { opacity: 0 }, end + 0.02);
        tl.set(texts[i], { opacity: 1 }, end + 0.02);
        t = end + GAP;
      }
      // line 08 lands ≈5.3s and holds ≈1.1s before the list scrolls away
      var doneAt = lineEnd[lineEnd.length - 1];
      var back = Math.max(BACK, doneAt + 0.6);
      var shift = back - BACK; // 0 unless the lines ran long

      // --- Scroll back to rows 03–06, pick two ----------------------------------
      tl.to(track, { y: -ROW * 2, duration: 0.45, ease: 'power2.inOut' }, back);
      var pick1 = PICK1 + shift;
      var pick2 = PICK2 + shift;
      tl.to(picks[0], { width: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' }, pick1);
      tl.to(ticks[0], { strokeDashoffset: 0, duration: 0.4 }, pick1 + 0.05);
      tl.to(picked[0], { color: INK, duration: 0.4 }, pick1);
      tl.to(picks[1], { width: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' }, pick2);
      tl.to(ticks[1], { strokeDashoffset: 0, duration: 0.4 }, pick2 + 0.05);
      tl.to(picked[1], { color: INK, duration: 0.4 }, pick2);

      // --- Final hold, then out ---------------------------------------------------
      var finalAt = FINAL + shift;
      tl.addLabel('final', finalAt);
      var outAt = OUT + shift;
      tl.to(el, { opacity: 0, duration: 0.28 }, outAt);
      var endAt = END + shift;
      tl.set({}, {}, endAt); // pins the loop length

      // The counter: one tween spanning the whole loop whose onUpdate derives
      // the count from the timeline clock (seek-safe, repeat-safe).
      tl.to(counter, {
        t: endAt,
        duration: endAt,
        ease: 'none',
        onUpdate: function () { writeCount(tl.time()); }
      }, 0);

      if (reduced) {
        tl.pause();
        // suppressEvents=false so the counter's onUpdate writes "8 of 8"
        tl.seek('final', false);
        writeCount(tl.time());
        return tl;
      }
      if (autoplay) tl.play();
      return tl;
    }
  };
})();

/* ---- src/panels/ship.js ---- */
/* ==========================================================================
   Panel 5 — ship. Follows the SPEC.md JS contract (see brief.js).
   Registers window.hypjamPanels.ship = { name, height, mount(el, opts) }.
   mount() returns a gsap timeline (repeat: -1) with labels `loop` and `final`.
   A playhead runs the timeline strip, the captions toggle flips to jam, the
   export bar fills, then TikTok / Reels / Shorts tick in jam and brighten.
   Loop: 8.4s, `final` at 5.9s (SPEC §10.5).
   ========================================================================== */
(function () {
  var P = (window.hypjamPanels = window.hypjamPanels || {});

  var TICK_AT = [4.7, 5.1, 5.5]; // SPEC §10.5: TikTok, Reels, Shorts

  P.ship = {
    name: 'ship',
    height: 96,

    mount: function (el, opts) {
      if (!window.gsap || !el) return null;
      opts = opts || {};
      var gsap = window.gsap;
      var autoplay = opts.autoplay !== false;
      var reduced =
        typeof opts.reduced === 'boolean'
          ? opts.reduced
          : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (el.__pnlTl) {
        el.__pnlTl.kill();
        el.__pnlTl = null;
      }

      var q = function (sel) { return el.querySelector(sel); };
      var qa = function (sel) { return el.querySelectorAll(sel); };

      var strip = q('.pnl-ship__strip');
      var playhead = q('.pnl-ship__playhead');
      var cc = q('.pnl-ship__cc');
      var toggle = q('.pnl-ship__cc .pnl-toggle');
      var exportRow = q('.pnl-ship__export');
      var bar = q('.pnl-ship__bar');
      var fill = q('.pnl-ship__fill');
      var targets = q('.pnl-ship__targets');
      var chips = qa('.pnl-ship__chip');
      var ticks = qa('.pnl-ship__target .pnl-tick path');

      // The chip colours come from the panel tokens, read once at mount so
      // nothing is hard-coded here and the tween ends exactly on --pnl-ink.
      var cs = window.getComputedStyle(el);
      var MUTE = (cs.getPropertyValue('--pnl-mute') || '').trim() || '#a1a09a';
      var INK = (cs.getPropertyValue('--pnl-ink') || '').trim() || '#fff';

      // Initial (hidden) state. Applied once now so the first frame is right,
      // and again inside the timeline at 0 so every repeat resets cleanly.
      var initial = function (t) {
        var set = t ? function (a, b) { t.set(a, b, 0); } : gsap.set;
        set(el, { opacity: 1 });
        set(strip, { opacity: 0, y: 6 });
        set(playhead, { left: '0%', opacity: 0 });
        set(cc, { opacity: 0, y: 6 });
        set(toggle, { attr: { 'data-on': 'false' } });
        set(exportRow, { opacity: 0, y: 6 });
        set(bar, { opacity: 0 });
        set(fill, { width: '0%' });
        set(targets, { opacity: 0, y: 6 });
        set(chips, { color: MUTE });
        set(ticks, { strokeDashoffset: 12 });
      };
      initial(null);

      var tl = gsap.timeline({
        repeat: -1,
        paused: true,
        defaults: { ease: 'power2.inOut' }
      });
      el.__pnlTl = tl;

      tl.addLabel('loop', 0);
      initial(tl);

      // --- The screen assembles: strip, captions, export row, targets --------
      tl.to(strip, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0);
      tl.to(cc, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0.08);
      tl.to(exportRow, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0.14);
      tl.to(bar, { opacity: 1, duration: 0.35, ease: 'power2.out' }, 0.2);
      tl.to(targets, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0.26);

      // --- The playhead runs the strip; captions switch on mid-way ----------------
      tl.to(playhead, { opacity: 1, duration: 0.15, ease: 'power2.out' }, 0.4);
      tl.to(playhead, { left: '100%', duration: 2.2, ease: 'none' }, 0.4);
      tl.set(toggle, { attr: { 'data-on': 'true' } }, 1.6);

      // --- Export renders -------------------------------------------------------------
      tl.to(fill, { width: '100%', duration: 1.8, ease: 'none' }, 2.8);

      // --- The three platforms tick in jam and their chips brighten -----------------
      for (var i = 0; i < TICK_AT.length; i++) {
        tl.to(ticks[i], { strokeDashoffset: 0, duration: 0.4 }, TICK_AT[i]);
        tl.to(chips[i], { color: INK, duration: 0.35 }, TICK_AT[i]);
      }

      // --- Final hold, then out ---------------------------------------------------------
      tl.addLabel('final', 5.9);
      tl.to(el, { opacity: 0, duration: 0.28 }, 8.1);
      tl.set({}, {}, 8.4); // pins the loop length

      if (reduced) {
        tl.pause();
        tl.seek('final');
        return tl;
      }
      if (autoplay) tl.play();
      return tl;
    }
  };
})();

/* ---- src/panels/shoot.js ---- */
/* ==========================================================================
   Panel 4 — shoot. Follows the SPEC.md JS contract (see brief.js).
   Registers window.hypjamPanels.shoot = { name, height, mount(el, opts) }.
   mount() returns a gsap timeline (repeat: -1) with labels `loop` and `final`.
   A phone frame records a take (REC dot pulses, timecode runs at 25fps),
   the take is cut, HOOK 03 gets its jam tick, and the list moves on to the
   founder cut.
   ========================================================================== */
(function () {
  var P = (window.hypjamPanels = window.hypjamPanels || {});

  var FPS = 25;
  var REC_AT = 0.4;   // timecode starts running
  var CUT_AT = 4.2;   // the take is cut; the timecode freezes here
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  // seconds → hh:mm:ss:ff (frames at 25fps). +1e-6 guards float error at the end value.
  function timecode(sec) {
    var f = Math.floor(sec * FPS + 1e-6);
    var s = Math.floor(f / FPS);
    var m = Math.floor(s / 60);
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60) + ':' + pad2(s % 60) + ':' + pad2(f % FPS);
  }

  P.shoot = {
    name: 'shoot',
    height: 152,

    mount: function (el, opts) {
      if (!window.gsap || !el) return null;
      opts = opts || {};
      var gsap = window.gsap;
      var autoplay = opts.autoplay !== false;
      var reduced =
        typeof opts.reduced === 'boolean'
          ? opts.reduced
          : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (el.__pnlTl) {
        el.__pnlTl.kill();
        el.__pnlTl = null;
      }

      var q = function (sel) { return el.querySelector(sel); };
      var qa = function (sel) { return el.querySelectorAll(sel); };

      var phone = q('.pnl-shoot__phone');
      var dot = q('.pnl-shoot__rec .pnl-dot');
      var tc = q('.pnl-shoot__tc');
      var head = q('.pnl-shoot__head');
      var hr = q('.pnl-shoot__hr');
      var rows = qa('.pnl-shoot__row');
      var tick = q('.pnl-shoot__tick path');
      var takeA = q('.pnl-shoot__take-a');
      var takeB = q('.pnl-shoot__take-b');
      var nextA = q('.pnl-shoot__next-a');
      var nextB = q('.pnl-shoot__next-b');
      var pending = q('.pnl-shoot__val--pending');

      // The timecode is a pure function of the timeline clock, written from a
      // loop-spanning tween's onUpdate, so seeks in either direction and every
      // repeat show the right frame.
      var writeTc = function (time) {
        var s = Math.max(0, Math.min(CUT_AT - REC_AT, time - REC_AT));
        var str = timecode(s);
        if (tc && tc.textContent !== str) tc.textContent = str;
      };

      // Initial (hidden) state. Applied once now so the first frame is right,
      // and again inside the timeline at 0 so every repeat resets cleanly.
      var initial = function (t) {
        var set = t ? function (a, b) { t.set(a, b, 0); } : gsap.set;
        set(el, { opacity: 1 });
        set(phone, { opacity: 0, y: 6 });
        set(dot, { attr: { 'class': 'pnl-dot pnl-dot--still' } });
        set(head, { opacity: 0, y: 6 });
        set(hr, { opacity: 0 });
        set(rows, { opacity: 0, x: -8 });
        set(tick, { strokeDashoffset: 12 });
        set(takeA, { opacity: 1, y: 0 });
        set(takeB, { opacity: 0, y: 6 });
        set(nextA, { opacity: 1, y: 0 });
        set(nextB, { opacity: 0, y: 6 });
        set(pending, { opacity: 0.5 });
      };
      initial(null);
      writeTc(0);

      var tl = gsap.timeline({
        repeat: -1,
        paused: true,
        defaults: { ease: 'power2.inOut' }
      });
      el.__pnlTl = tl;

      tl.addLabel('loop', 0);
      initial(tl);

      // --- Phone and take list arrive ------------------------------------------
      tl.to(phone, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0);
      tl.to(head, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.05);
      tl.to(hr, { opacity: 1, duration: 0.3 }, 0.1);
      tl.to(rows, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', stagger: 0.18 }, 0.1);

      // --- REC: the dot pulses, the timecode runs (from the clock tween below) --
      tl.set(dot, { attr: { 'class': 'pnl-dot' } }, REC_AT);

      // --- Cut: dot goes still, HOOK 03 ticks off ---------------------------------
      tl.set(dot, { attr: { 'class': 'pnl-dot pnl-dot--still' } }, CUT_AT);
      tl.to(tick, { strokeDashoffset: 0, duration: 0.4 }, CUT_AT + 0.05);

      // --- Move on: header → "founder cut · take 1", last row → "up next" ---------
      tl.to(takeA, { opacity: 0, y: -6, duration: 0.28 }, 4.8);
      tl.to(nextA, { opacity: 0, y: -6, duration: 0.28 }, 4.8);
      tl.to(takeB, { opacity: 1, y: 0, duration: 0.28 }, 4.9);
      tl.to(nextB, { opacity: 1, y: 0, duration: 0.28 }, 4.9);
      tl.to(pending, { opacity: 1, duration: 0.28 }, 4.9);

      // --- Final hold, then out ------------------------------------------------------
      tl.addLabel('final', 5.4);
      tl.to(el, { opacity: 0, duration: 0.28 }, 7.8);
      var endAt = 8.1;
      tl.set({}, {}, endAt); // pins the loop length

      // The clock: one tween spanning the whole loop whose onUpdate writes the
      // timecode from the timeline's own time (seek-safe, repeat-safe).
      var clock = { t: 0 };
      tl.to(clock, {
        t: endAt,
        duration: endAt,
        ease: 'none',
        onUpdate: function () { writeTc(tl.time()); }
      }, 0);

      if (reduced) {
        tl.pause();
        tl.seek('final', false);
        writeTc(tl.time());
        return tl;
      }
      if (autoplay) tl.play();
      return tl;
    }
  };
})();
