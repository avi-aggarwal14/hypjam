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
