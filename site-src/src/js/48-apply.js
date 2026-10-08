/* ==========================================================================
   48-apply.js — /apply, the creator application.

   Three jobs:
   · reveal the conditional fields (links to brand work when they say they
     have made UGC before; a free-text box when they pick "Other");
   · validate, forgivingly: a social account can be an @handle or a link, and
     a link typed without https:// is accepted and completed;
   · submit.

   Submission has no backend behind it. If content/apply.json carries an
   endpoint the form POSTs JSON to it; with the endpoint empty (the shipped
   state) it composes the answers into an email instead, so the page works
   without signing hypjam up to a form service or adding a data processor to
   the privacy policy. Because the email can be long, the status line also
   offers "Copy my answers" in case the email app does not open or cuts it
   short. Swapping in an endpoint is one value in the JSON.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-apply-form]');
  if (!form) return;

  var $ = function (sel) { return form.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(form.querySelectorAll(sel)); };

  var status   = $('[data-apply-status]');
  var msg      = $('[data-apply-msg]');
  var fallbackBox = $('[data-apply-fallback]');
  var copyBtn  = $('[data-apply-copy]');
  var reopen   = $('[data-apply-reopen]');
  var strings  = $('[data-apply-strings]');
  var expYes   = $('[data-exp-yes]');
  var profiles = $('[data-when-experience]');
  var found    = $('#ap-found');
  var other    = $('[data-when-other]');
  var socials  = $$('[data-social]');
  var endpoint = (form.getAttribute('data-endpoint') || '').trim();
  var fallback = (form.getAttribute('data-fallback') || '').trim();
  var lastText = '';

  function str(key, def) { return (strings && strings.getAttribute('data-' + key)) || def; }

  /* ---------- conditional fields ---------- */
  function syncExperience() { if (profiles) profiles.hidden = !(expYes && expYes.checked); }
  function syncOther() { if (other && found) other.hidden = found.value !== 'Other'; }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'experience') syncExperience();
    if (e.target === found) syncOther();
  });
  syncExperience();
  syncOther();

  /* ---------- parsing ---------- */
  var PLATFORM_HOST = /(^|\.)(tiktok\.com|instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|facebook\.com|fb\.com|snapchat\.com|threads\.net|pinterest\.[a-z.]+|linkedin\.com|twitch\.tv)$/i;

  /* "https://…", "www.…" or "domain.tld/…" → a full https link; anything else → null */
  function asUrl(v) {
    v = (v || '').trim();
    if (!v || /\s/.test(v)) return null;
    var candidate = /^https?:\/\//i.test(v) ? v : (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(v) ? 'https://' + v : null);
    if (!candidate) return null;
    try {
      var u = new URL(candidate);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && /\./.test(u.hostname)) return u.href;
    } catch (err) { /* not a link */ }
    return null;
  }

  /* a social field: a link (kept as given, completed with https://) or an @handle
     (turned into the profile link so the application can be checked in one click) */
  function parseSocial(input) {
    var raw = input.value.trim();
    if (!raw) return { empty: true };
    /* LinkedIn's own short form: "in/jamie-rivers" */
    if (input.getAttribute('data-social') === 'linkedin' && /^(in|company)\/[A-Za-z0-9_-]+\/?$/i.test(raw)) {
      var li = 'https://www.linkedin.com/' + raw.replace(/\/$/, '');
      return { url: li, shown: li };
    }
    var looksLikeLink = /^https?:\/\//i.test(raw) || /^www\./i.test(raw) || raw.indexOf('/') > -1;
    if (!looksLikeLink) {
      var host = raw.replace(/^@/, '').toLowerCase();
      if (PLATFORM_HOST.test(host)) looksLikeLink = true;
    }
    if (looksLikeLink) {
      var url = asUrl(raw);
      if (!url) return { bad: true };
      /* "instagram.com" on its own is the site, not their profile */
      var u = new URL(url);
      if (PLATFORM_HOST.test(u.hostname) && (u.pathname === '/' || u.pathname === '') && !u.search) return { bad: true };
      return { url: url, shown: url };
    }
    var handle = raw.replace(/^@+/, '');
    if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return { bad: true };
    return { handle: handle, url: (input.getAttribute('data-base') || '') + handle, shown: '@' + handle };
  }

  function discordOk(v) {
    v = v.trim().replace(/^@/, '');
    return /^[a-z0-9_.]{2,32}$/i.test(v) || /^[^#@:\s][^#@:]{0,31}#\d{4}$/.test(v);
  }

  function checked(name) {
    return $$('input[name="' + name + '"]:checked').map(function (el) { return el.value; });
  }

  /* ---------- validation ---------- */
  function setError(el, key, message) {
    var slot = $('[data-error-for="' + key + '"]');
    if (slot) { slot.textContent = message || ''; slot.hidden = !message; }
    if (el) el.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate() {
    var problems = [];
    function check(el, key, ok, message) {
      setError(el, key, ok ? '' : message);
      if (!ok) problems.push(el);
    }

    var name = $('#ap-name');
    check(name, 'ap-name', name.value.trim().length > 1, 'Please tell us your name.');

    var email = $('#ap-email');
    check(email, 'ap-email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()), 'That email does not look right.');

    var loc = $('#ap-location');
    check(loc, 'ap-location', loc.value.trim().length > 1, 'Tell us roughly where you are, e.g. Manchester, UK.');

    var discord = $('#ap-discord');
    check(discord, 'ap-discord', !discord.value.trim() || discordOk(discord.value),
      'That does not look like a Discord username. It is the name under your profile, e.g. jamie.films.');

    var anySocial = false;
    socials.forEach(function (input) {
      var p = parseSocial(input);
      if (!p.empty && !p.bad) anySocial = true;
      check(input, input.id, !p.bad, 'Paste a link or an @handle.');
    });
    var portfolio = $('#ap-portfolio');
    var pv = portfolio.value.trim();
    check(portfolio, 'ap-portfolio', !pv || !!asUrl(pv), 'That link does not look right. Try yoursite.com.');
    if (pv && asUrl(pv)) anySocial = true;
    if ($('#ap-other').value.trim().length > 3) anySocial = true;
    setError(null, 'socials', anySocial ? '' : 'Add at least one account: an @handle or a link.');
    if (!anySocial && socials[0]) problems.push(socials[0]);

    var exp = $('input[name="experience"]:checked');
    setError(null, 'experience', exp ? '' : 'Pick one. Either answer is fine.');
    if (!exp) problems.push($('input[name="experience"]'));

    var prof = $('#ap-profiles');
    if (expYes && expYes.checked) {
      check(prof, 'ap-profiles', prof.value.trim().length > 3, 'Add at least one link to work you have made for a brand.');
    } else {
      setError(prof, 'ap-profiles', '');
    }

    var ex = $('#ap-example');
    check(ex, 'ap-example', !!asUrl(ex.value), 'Paste a public link to one thing you have made.');

    var content = checked('content');
    setError(null, 'content', content.length ? '' : 'Pick at least one.');
    if (!content.length) problems.push($('input[name="content"]'));

    var niche = checked('niche');
    setError(null, 'niche', niche.length ? '' : 'Pick at least one.');
    if (!niche.length) problems.push($('input[name="niche"]'));

    check(found, 'ap-found', !!found.value, 'Pick one so we know where to keep looking.');

    var age = $('#ap-age');
    check(age, 'ap-age', age.checked, 'Please confirm you are 18 or over.');

    return problems;
  }

  /* a field's error clears as soon as it is edited */
  form.addEventListener('input', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('aria-invalid') === 'true') setError(t, t.id, '');
  });
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' || t.type === 'radio') {
      var key = t.id === 'ap-age' ? 'ap-age' : t.name;
      if (t.checked) setError(t.id === 'ap-age' ? t : null, key, '');
    }
    if (t === found && found.value) setError(found, 'ap-found', '');
  });

  /* ---------- answers ---------- */
  function answers() {
    var src = found.value;
    var oth = $('#ap-found-other');
    if (src === 'Other' && oth && oth.value.trim()) src += ': ' + oth.value.trim();
    var socialList = [];
    socials.forEach(function (input) {
      var p = parseSocial(input);
      if (p.empty || p.bad) return;
      socialList.push({ platform: input.getAttribute('data-label'), value: p.shown, url: p.url });
    });
    var exp = $('input[name="experience"]:checked');
    return {
      name: $('#ap-name').value.trim(),
      email: $('#ap-email').value.trim(),
      location: $('#ap-location').value.trim(),
      discord: $('#ap-discord').value.trim().replace(/^@/, ''),
      age_confirmed: $('#ap-age').checked,
      socials: socialList,
      portfolio: asUrl($('#ap-portfolio').value) || '',
      other_links: $('#ap-other').value.trim(),
      audience: $('#ap-audience').value,
      experience: exp ? (exp.value === 'yes' ? 'Yes' : 'No') : '',
      brand_work: (expYes && expYes.checked) ? $('#ap-profiles').value.trim() : '',
      example: asUrl($('#ap-example').value) || '',
      content: checked('content'),
      niches: checked('niche'),
      kit: checked('kit'),
      times: checked('times'),
      rate: $('#ap-rate').value.trim(),
      found: src,
      extra: $('#ap-extra').value.trim()
    };
  }

  /* the plain-text application: the email body and what "Copy my answers" copies.
     Empty optional answers are left out so the email stays short. */
  function asText(a) {
    function line(k, v) { return v ? k + ': ' + v : null; }
    var socialsText = a.socials.map(function (s) {
      return s.platform + ': ' + s.value + (s.value !== s.url ? ' (' + s.url + ')' : '');
    });
    var blocks = [
      [line('Name', a.name), line('Email', a.email), line('Based in', a.location),
       line('Discord', a.discord), line('18 or over', a.age_confirmed ? 'Yes' : '')],
      ['SOCIALS'].concat(socialsText, [
        line('Portfolio', a.portfolio),
        a.other_links ? 'Other:\n' + a.other_links : null,
        line('Biggest following', a.audience)]),
      ['WORK', line('Made UGC for brands', a.experience),
       a.brand_work ? 'Brand work:\n' + a.brand_work : null,
       line('Example', a.example), line('Makes', a.content.join(', ')),
       line('Niches', a.niches.join(', ')), line('Films with', a.kit.join(', ')),
       line('Free to film', a.times.join(', ')), line('Usual rate', a.rate)],
      [line('Found us via', a.found), a.extra ? 'Anything else:\n' + a.extra : null]
    ];
    return blocks.map(function (b) { return b.filter(Boolean).join('\n'); })
      .filter(function (b) { return b && b !== 'SOCIALS' && b !== 'WORK'; })
      .join('\n\n');
  }

  function mailto(a, text) {
    return 'mailto:' + fallback +
      '?subject=' + encodeURIComponent('Creator application: ' + a.name) +
      '&body=' + encodeURIComponent(text);
  }

  /* ---------- status line ---------- */
  function say(message, tone, withFallback) {
    if (!status) return;
    if (msg) msg.textContent = message;
    status.hidden = false;
    if (tone) status.setAttribute('data-tone', tone); else status.removeAttribute('data-tone');
    if (fallbackBox) fallbackBox.hidden = !withFallback;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (err) { reject(err); }
      document.body.removeChild(ta);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!lastText) return;
      copyText(lastText).then(function () {
        copyBtn.textContent = 'Copied';
        say(str('copied', 'Copied. Paste them into an email to') + ' ' + fallback + '.', null, true);
        setTimeout(function () { copyBtn.textContent = copyBtn.getAttribute('data-label') || 'Copy my answers'; }, 2500);
      }).catch(function () {
        say('Copying did not work here. Email your answers to ' + fallback + '.', 'bad', true);
      });
    });
  }

  /* ---------- submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var problems = validate();
    if (problems.length) {
      say(str('fix', 'Some answers need a look. See the notes above.'), 'bad', false);
      if (problems[0] && problems[0].focus) problems[0].focus();
      return;
    }

    var a = answers();
    lastText = asText(a);
    var href = mailto(a, lastText);
    if (reopen) reopen.setAttribute('href', href);

    if (!endpoint) {
      say(str('mail', 'Your email app should open with everything filled in. Send it and you are done. If nothing opens, copy your answers and email them to') + ' ' + fallback + '.', null, true);
      window.location.href = href;
      return;
    }

    var btn = $('.apply-submit');
    if (btn) btn.disabled = true;
    say('Sending…', null, false);

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(a)
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status ' + r.status);
      form.reset();
      syncExperience();
      syncOther();
      say('Thank you. A person reads every one of these; we will email you at ' + a.email + '.', null, false);
    }).catch(function () {
      say('That did not send. Copy your answers and email them to ' + fallback + '.', 'bad', true);
    }).then(function () {
      if (btn) btn.disabled = false;
    });
  });
})();
