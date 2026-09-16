/* ==========================================================================
   48-apply.js — /apply, the creator application.

   Two jobs. Reveal the conditional fields (past work when they say they have
   experience; a free-text box when they pick "Other"), and submit.

   Submission has no backend behind it. If content/apply.json carries an
   endpoint the form POSTs JSON to it; with the endpoint empty — the shipped
   state — it composes the answers into an email instead, so the page works
   today without signing hypjam up to a form service and without adding a new
   data processor to the privacy policy. Swapping in an endpoint is one value
   in the JSON and needs no change here.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-apply-form]');
  if (!form) return;

  var status   = form.querySelector('[data-apply-status]');
  var expYes   = form.querySelector('[data-exp-yes]');
  var profiles = form.querySelector('[data-when-experience]');
  var found    = form.querySelector('#ap-found');
  var other    = form.querySelector('[data-when-other]');
  var endpoint = (form.getAttribute('data-endpoint') || '').trim();
  var fallback = (form.getAttribute('data-fallback') || '').trim();

  /* ---------- conditional fields ---------- */
  function syncExperience() {
    var on = !!(expYes && expYes.checked);
    if (profiles) profiles.hidden = !on;
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'experience') syncExperience();
    if (e.target === found && other) other.hidden = found.value !== 'Other';
  });
  syncExperience();
  if (other && found) other.hidden = found.value !== 'Other';

  /* ---------- validation ---------- */
  function setError(el, key, message) {
    var slot = form.querySelector('[data-error-for="' + key + '"]');
    if (slot) { slot.textContent = message || ''; slot.hidden = !message; }
    if (el) el.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function looksLikeUrl(v) {
    try { var u = new URL(v.trim()); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (err) { return false; }
  }

  function validate() {
    var problems = [];

    var name = form.querySelector('#ap-name');
    var ok = name.value.trim().length > 1;
    setError(name, 'ap-name', ok ? '' : 'Please tell us your name.');
    if (!ok) problems.push(name);

    var email = form.querySelector('#ap-email');
    ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    setError(email, 'ap-email', ok ? '' : 'That email does not look right.');
    if (!ok) problems.push(email);

    var exp = form.querySelector('input[name="experience"]:checked');
    setError(null, 'experience', exp ? '' : 'Pick one — either answer is fine.');
    if (!exp) problems.push(form.querySelector('input[name="experience"]'));

    if (expYes && expYes.checked) {
      var prof = form.querySelector('#ap-profiles');
      ok = prof.value.trim().length > 3;
      setError(prof, 'ap-profiles', ok ? '' : 'Add at least one link to your past work.');
      if (!ok) problems.push(prof);
    } else {
      setError(form.querySelector('#ap-profiles'), 'ap-profiles', '');
    }

    var ex = form.querySelector('#ap-example');
    ok = looksLikeUrl(ex.value);
    setError(ex, 'ap-example', ok ? '' : 'Paste a public link starting with https://');
    if (!ok) problems.push(ex);

    ok = !!found.value;
    setError(found, 'ap-found', ok ? '' : 'Pick one so we know where to keep looking.');
    if (!ok) problems.push(found);

    return problems;
  }

  /* ---------- submit ---------- */
  function answers() {
    var exp = form.querySelector('input[name="experience"]:checked');
    var src = found.value;
    var oth = form.querySelector('#ap-found-other');
    if (src === 'Other' && oth && oth.value.trim()) src += ' — ' + oth.value.trim();
    return {
      name: form.querySelector('#ap-name').value.trim(),
      email: form.querySelector('#ap-email').value.trim(),
      experience: exp ? (exp.value === 'yes' ? 'Yes' : 'No') : '',
      profiles: (expYes && expYes.checked) ? form.querySelector('#ap-profiles').value.trim() : '',
      example: form.querySelector('#ap-example').value.trim(),
      found: src
    };
  }

  function say(message, tone) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    if (tone) status.setAttribute('data-tone', tone); else status.removeAttribute('data-tone');
  }

  function mailto(a) {
    var lines = [
      'Name: ' + a.name,
      'Email: ' + a.email,
      'Made UGC before: ' + a.experience,
      a.profiles ? 'Past work:\n' + a.profiles : null,
      'Example: ' + a.example,
      'Found us via: ' + a.found
    ].filter(Boolean);
    return 'mailto:' + fallback +
      '?subject=' + encodeURIComponent('Creator application — ' + a.name) +
      '&body=' + encodeURIComponent(lines.join('\n\n'));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var problems = validate();
    if (problems.length) {
      say('Some answers need a look — see the notes above.', 'bad');
      if (problems[0] && problems[0].focus) problems[0].focus();
      return;
    }

    var a = answers();

    if (!endpoint) {
      say('Opening your email app with the application filled in. Send it and we will pick it up.');
      window.location.href = mailto(a);
      return;
    }

    var btn = form.querySelector('.apply-submit');
    if (btn) btn.disabled = true;
    say('Sending…');

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(a)
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status ' + r.status);
      form.reset();
      syncExperience();
      if (other) other.hidden = true;
      say('Thank you. A person reads every one of these; we will email you at ' + a.email + '.');
    }).catch(function () {
      say('That did not send. Email it to ' + fallback + ' and we will pick it up.', 'bad');
    }).then(function () {
      if (btn) btn.disabled = false;
    });
  });
})();
