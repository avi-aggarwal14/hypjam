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
