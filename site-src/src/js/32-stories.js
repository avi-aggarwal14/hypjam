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
