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
