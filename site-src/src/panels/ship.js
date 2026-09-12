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
