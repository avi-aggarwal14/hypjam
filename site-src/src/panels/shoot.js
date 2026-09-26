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
