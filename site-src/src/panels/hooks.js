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
