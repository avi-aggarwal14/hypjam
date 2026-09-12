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
