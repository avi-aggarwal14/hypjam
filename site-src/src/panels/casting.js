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
