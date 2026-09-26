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
