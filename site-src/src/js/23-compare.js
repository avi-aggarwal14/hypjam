/* ==========================================================================
   23-compare.js — the "Compare hypjam with" switch on the comparison table.
   On phones the table shows hypjam beside one alternative; the switch sets
   data-alt on .cmp-wrap (CSS hides the other columns), aria-pressed on the
   buttons, and announces the change in a polite live region. Wider screens
   show every column and ignore it.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('[data-cmp]');
  if (!root) return;
  var wrap = root.querySelector('.cmp-wrap');
  var status = root.querySelector('[data-cmp-status]');
  var btns = Array.prototype.slice.call(root.querySelectorAll('[data-cmp-alt]'));
  if (!wrap || !btns.length) return;
  /* the markup ships the no-JavaScript state (all four columns, switch hidden);
     with scripts on, phones compare hypjam with one route at a time */
  var sw = root.querySelector('[data-cmp-switch]');
  if (sw) sw.hidden = false;
  var first = btns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || btns[0];
  wrap.setAttribute('data-alt', first.getAttribute('data-cmp-alt'));
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      wrap.setAttribute('data-alt', b.getAttribute('data-cmp-alt'));
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      if (status) status.textContent = 'Showing hypjam and ' + (b.getAttribute('data-name') || b.textContent);
    });
  });
})();
