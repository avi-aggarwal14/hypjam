
  /* ---- WebGL liquid ("goo") backdrops + halftone plasma field, ported from the reference ---- */
  (() => {
    const lerp = (a, b, t) => a + (b - a) * t, clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const reduceM = matchMedia('(prefers-reduced-motion: reduce)').matches, fineP = matchMedia('(pointer: fine)').matches;
    const parseCol = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (m) { const [r = 0, g = 0, b = 0, a = 1] = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [r / 255, g / 255, b / 255, a]; } const h = (s || '').trim().replace('#', ''); if (/^[0-9a-f]{3,6}$/i.test(h)) { const x = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return [((x >> 16) & 255) / 255, ((x >> 8) & 255) / 255, (x & 255) / 255, 1]; } return [0, 0, 0, 1]; };
    const PLASMA = `
float field(vec2 uv){
  vec2 c = 2.0 * uv - 1.0;
  c.x = c.x * 1.6 + uTime * 0.35;
  float ds = 1.35;
  c += ds * 0.4 * sin(c.yx + vec2(1.2, 3.4) + uTime);
  c += ds * 0.2 * sin(5.2 * c.yx + vec2(3.5, 0.4) + uTime);
  c += ds * 0.3 * sin(3.5 * c.yx + vec2(1.2, 3.1) + uTime);
  c += ds * 1.6 * sin(0.4 * c.yx + vec2(0.8, 2.4) + uTime);
  float L = length(c);
  float v = 0.0;
  for (int i = 0; i < 4; i++) v = mix(v, float(i) / 3.0, cos(float(i) * L));
  return clamp(v, 0.0, 1.0);
}`;
    /* ---------- goo (WebGL1) ---------- */
    const GOO_FS = `
precision highp float;
uniform vec2 uSize; uniform float uDpr;
uniform vec4 uRect[8]; uniform vec3 uRectX[8]; uniform int uNR;
uniform vec4 uBall[40]; uniform int uNB; uniform float uK;
uniform vec4 uGround; uniform float uTexA; uniform vec3 uRim; uniform float uRimA; uniform float uHaloA; uniform vec3 uMint;
uniform float uTime; uniform float uField; uniform vec3 uGrey; uniform vec3 uWhite; uniform float uMode;
${PLASMA}
float halftone(vec2 p){
  float px = 15.0;
  vec2 baseCell = floor(p / px);
  float minDist = 1.0e5;
  for (int dx = -1; dx <= 1; dx++){
    for (int dy = -1; dy <= 1; dy++){
      vec2 cell = baseCell + vec2(float(dx), float(dy));
      if (mod(cell.x + cell.y, 2.0) > 0.5) continue;
      vec2 centre = (cell + 0.5) * px;
      float luma = field((cell + 0.5) * px / (uField > 0.5 ? vec2(uField) : uSize));
      float v = clamp((luma - 0.5) * 1.25 + 0.5, 0.0, 1.0);
      float r = v * px * 0.5 + px * 0.05;
      float d = length(p - centre) - r;
      float k = 0.9 * px; float h = max(k - abs(minDist - d), 0.0) / k;
      minDist = min(minDist, d) - h * h * k * 0.25;
    }
  }
  return 1.0 - smoothstep(-0.8, 0.8, minDist);
}
float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * 0.25; }
void main(){
  vec2 p = gl_FragCoord.xy / uDpr; p.y = uSize.y - p.y;
  float d = 1e5; float heat = 0.;
  for (int i = 0; i < 8; i++){ if (i >= uNR) break; vec4 r = uRect[i]; float sw = uRectX[i].y * uRectX[i].z;
    float di = sdRR(p - r.xy, r.zw + sw, uRectX[i].x + sw); d = smin(d, di, uK); heat = max(heat, uRectX[i].y * (1. - smoothstep(-10., 70., di))); }
  for (int i = 0; i < 40; i++){ if (i >= uNB) break; vec4 b = uBall[i]; d = smin(d, sdRR(p - b.xy, vec2(b.z), b.w), uK); }
  float body = 1. - smoothstep(-0.75, 0.75, d);
  float rim = 1. - smoothstep(0., 1.6, abs(d + 0.6));
  float halo = exp(-max(d, 0.) / 16.) * step(0., d);
  float inner = 1. - smoothstep(0., 30., -d);
  float dot = uMode > 0.5 ? halftone(p) : 0.55 * field(p / (uField > 0.5 ? vec2(uField) : uSize));
  vec3 tex = mix(uGrey, uWhite, dot);
  vec3 col = uGround.rgb * uGround.a; float a = uGround.a;
  col = tex * uTexA + col * (1. - uTexA); a = uTexA + a * (1. - uTexA);
  float vy = p.y / uSize.y;
  vec3 light = vec3(0.98, 0.965, 0.94);
  col += light * (0.07 * (1. - vy) + 0.10 * inner) * a;
  col *= 1. - 0.16 * vy;
  vec3 rimCol = mix(uRim, uMint, heat * 0.9);
  float rimA = uRimA * (1. + heat * 0.9);
  vec3 outCol = col * body + rimCol * (rim * rimA + halo * uHaloA * (1. + heat));
  float outA = a * body + rim * rimA + halo * uHaloA * (1. + heat);
  outA = clamp(outA, 0., 1.);
  gl_FragColor = vec4(min(outCol, vec3(outA)), outA);
}`;
    function mkProgram(gl, vs, fs) {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'shader'); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
      gl.useProgram(p); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      return p;
    }
    function initGoo(host, opts = {}) {
      const canvas = host.querySelector(':scope > canvas.goo'); if (!canvas) return;
      const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) { host.dataset.flat = ''; return; }
      let prog; try { prog = mkProgram(gl, 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }', GOO_FS); } catch (e) { host.dataset.flat = ''; return; }
      const loc = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {}; ['uSize', 'uDpr', 'uRect', 'uRectX', 'uNR', 'uBall', 'uNB', 'uK', 'uGround', 'uTexA', 'uRim', 'uRimA', 'uHaloA', 'uMint', 'uTime', 'uField', 'uGrey', 'uWhite', 'uMode'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
      gl.uniform1f(U.uK, 23); gl.uniform1f(U.uField, opts.fieldPx || 0); gl.uniform1f(U.uMode, opts.mode === 'plasma' ? 0 : 1);
      const items = Array.from(host.querySelectorAll('[data-goo]')), cards = items.filter(e => e.classList.contains('card')), fors = Array.from(host.querySelectorAll('[data-goo-for]'));
      let W = 0, H = 0, dpr = 1, rects = [], channels = [], junctions = [], travellers = [], heat = items.map(() => 0), swell = items.map(e => e.classList.contains('card') ? 10 : 0), radii = items.map(e => parseFloat(getComputedStyle(e).borderTopLeftRadius) || 20);
      let hot = [], px = -999, py = -999, pr = 0, mx = -999, my = -999, inside = false, raf = 0, visible = false, dirty = true, t0 = performance.now();
      const V = new Float32Array(32), Y = new Float32Array(24), G = new Float32Array(160);
      const theme = () => { const cs = getComputedStyle(host); const g = parseCol(cs.getPropertyValue('--goo-ground').trim() || '#121212'); const r = parseCol(cs.getPropertyValue('--goo-rim').trim() || '#f4f4f4'); const m = parseCol(cs.getPropertyValue('--goo-mint').trim() || '#ff6f1f');
        gl.uniform4f(U.uGround, g[0], g[1], g[2], Number(cs.getPropertyValue('--goo-ground-a')) || 0.6); gl.uniform1f(U.uTexA, Number(cs.getPropertyValue('--goo-tex-a')) || 0.35);
        gl.uniform3f(U.uRim, r[0], r[1], r[2]); gl.uniform1f(U.uRimA, Number(cs.getPropertyValue('--goo-rim-a')) || 0.26); gl.uniform1f(U.uHaloA, Number(cs.getPropertyValue('--goo-halo-a')) || 0.07); gl.uniform3f(U.uMint, m[0], m[1], m[2]);
        gl.uniform3f(U.uGrey, 0.11, 0.11, 0.11); gl.uniform3f(U.uWhite, 0.62, 0.62, 0.62); dirty = true; };
      const layout = () => {
        W = host.clientWidth; H = host.clientHeight; dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(U.uSize, W, H); gl.uniform1f(U.uDpr, dpr);
        rects = items.map(e => ({ x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }));
        channels = []; const gapOk = g => g > 4 && g < 100;
        for (let i = 0; i < rects.length; i++) for (let j = 0; j < rects.length; j++) { if (i === j) continue; const a = rects[i], b = rects[j];
          const gx = b.x - (a.x + a.w); if (gapOk(gx)) { const top = Math.max(a.y, b.y), bot = Math.min(a.y + a.h, b.y + b.h); if (bot - top > 40) channels.push({ x1: a.x + a.w + gx / 2, y1: top + 20, x2: a.x + a.w + gx / 2, y2: bot - 20, vertical: true, lo: top - 70, hi: bot + 70, gap: gx }); }
          const gy = b.y - (a.y + a.h); if (gapOk(gy)) { const l = Math.max(a.x, b.x), r = Math.min(a.x + a.w, b.x + b.w); if (r - l > 40) channels.push({ x1: l + 20, y1: a.y + a.h + gy / 2, x2: r - 20, y2: a.y + a.h + gy / 2, vertical: false, lo: l - 70, hi: r + 70, gap: gy }); } }
        junctions = []; const addJ = (x, y, r) => { if (!junctions.some(j => Math.hypot(j.x - x, j.y - y) < 48)) junctions.push({ x, y, r }); };
        for (const v of channels) if (v.vertical) for (const h of channels) if (!h.vertical && v.x1 >= h.lo && v.x1 <= h.hi && h.y1 >= v.lo && h.y1 <= v.hi) addJ(v.x1, h.y1, Math.max(v.gap, h.gap) / 2 + 8);
        channels.forEach((c, i) => { if (Math.hypot(c.x2 - c.x1, c.y2 - c.y1) < 120) return; const s = i % 2 ? 0.62 : 0.38; addJ(lerp(c.x1, c.x2, s), lerp(c.y1, c.y2, s), c.gap / 2 + 4); });
        travellers = []; channels.forEach((c, i) => { const n = Math.max(1, Math.min(2, Math.round(Math.hypot(c.x2 - c.x1, c.y2 - c.y1) / 520))); for (let s = 0; s < n; s++) travellers.push({ channel: i, phase: (s + 0.5) / n + ((0.17 * i) % 1), speed: 0.04 + ((3 * i + s) % 4) * 0.011, r: c.gap / 2 + 4 + ((7 * i + 5 * s) % 3), dir: (i + s) % 2 ? 1 : -1 }); });
        dirty = true; frame(performance.now());
      };
      const frame = now => {
        gl.uniform1f(U.uTime, reduceM ? 2.4 : (now / 1000) * 0.42); const t = (now - t0) / 1000; let animating = !reduceM;
        items.forEach((e, i) => { const target = hot.includes(i) ? 1 : 0; const v = reduceM ? target : lerp(heat[i], target, 0.09); if (Math.abs(v - heat[i]) > 5e-4) dirty = true; heat[i] = Math.abs(v - target) < 0.001 ? target : v; });
        rects.forEach((r, i) => { if (i >= 8) return; V[4 * i] = r.x + r.w / 2; V[4 * i + 1] = r.y + r.h / 2; V[4 * i + 2] = r.w / 2; V[4 * i + 3] = r.h / 2; Y[3 * i] = radii[i] ?? 20; Y[3 * i + 1] = heat[i]; Y[3 * i + 2] = swell[i] ?? 0; });
        let nb = 0; G.fill(0); const ball = (x, y, r) => { if (nb >= 40) return; G[4 * nb] = x; G[4 * nb + 1] = y; G[4 * nb + 2] = r; G[4 * nb + 3] = 0.42 * r; nb++; };
        junctions.forEach((j, i) => ball(j.x, j.y, reduceM ? j.r : j.r * (1 + 0.05 * Math.sin(0.8 * t + 1.7 * i))));
        travellers.forEach((tr, i) => { const c = channels[tr.channel]; const f = reduceM ? tr.phase % 1 : 0.5 + 0.42 * Math.sin((t * tr.speed * tr.dir + tr.phase) * Math.PI * 2); ball(lerp(c.x1, c.x2, f), lerp(c.y1, c.y2, f), tr.r * (reduceM ? 1 : 1 + 0.06 * Math.sin(1.2 * t + i))); });
        if (fineP && !reduceM) { let near = null; if (inside) for (const c of channels) { const ax = c.vertical ? c.x1 : clampN(mx, c.x1, c.x2), ay = c.vertical ? clampN(my, c.y1, c.y2) : c.y1; const d = Math.hypot(mx - ax, my - ay); if (!near || d < near.d) near = { x: ax, y: ay, d, gap: c.gap }; }
          const snap = near && near.d < 110; const nx = lerp(px, snap ? near.x : mx, 0.14), ny = lerp(py, snap ? near.y : my, 0.14), nr = lerp(pr, snap ? near.gap / 2 + 10 : 0, 0.1);
          if (Math.abs(nx - px) > 0.05 || Math.abs(ny - py) > 0.05 || Math.abs(nr - pr) > 0.02) dirty = true; px = nx; py = ny; pr = nr; if (pr > 0.3) ball(px, py, pr); }
        if (reduceM && !dirty) animating = false;
        if (dirty || animating) { gl.uniform4fv(U.uRect, V); gl.uniform3fv(U.uRectX, Y); gl.uniform1i(U.uNR, Math.min(rects.length, 8)); gl.uniform4fv(U.uBall, G); gl.uniform1i(U.uNB, nb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); dirty = false; }
      };
      const loop = now => { cards.forEach(c => c.style.setProperty('--gs', '0')); frame(now); raf = requestAnimationFrame(loop); };
      const schedule = () => { cancelAnimationFrame(raf); raf = 0; if (visible && !document.hidden) raf = requestAnimationFrame(reduceM ? frame : loop); };
      const setHot = list => { if (list.length === hot.length && list.every((v, i) => v === hot[i])) return; hot = list; items.forEach((e, i) => hot.includes(i) ? e.setAttribute('data-hot', '') : e.removeAttribute('data-hot'));
        fors.forEach(f => { const ids = (f.dataset.gooFor || '').split(',').filter(Boolean).map(Number); ids.length && ids.every(i => hot.includes(i)) && hot.length === ids.length ? f.setAttribute('data-hot', '') : f.removeAttribute('data-hot'); }); dirty = true; schedule(); };
      host.addEventListener('pointerover', e => { const f = e.target.closest('[data-goo-for]'); if (f) return setHot((f.dataset.gooFor || '').split(',').filter(Boolean).map(Number)); const g = e.target.closest('[data-goo]'); setHot(g ? [items.indexOf(g)] : []); });
      host.addEventListener('pointerout', e => { const r = e.relatedTarget; if (!(r && host.contains(r))) setHot([]); });
      if (fineP) { addEventListener('pointermove', e => { const b = host.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; inside = mx > -30 && my > -30 && mx < b.width + 30 && my < b.height + 30; if (px < -900) { px = mx; py = my; } }, { passive: true }); addEventListener('blur', () => { inside = false; }); }
      const ro = new ResizeObserver(layout); ro.observe(host); items.forEach(e => ro.observe(e));
      new IntersectionObserver(([en]) => { visible = !!(en && en.isIntersecting); schedule(); }, { rootMargin: '240px' }).observe(host);
      document.addEventListener('visibilitychange', schedule);
      theme(); layout(); schedule();
    }
    /* ---------- halftone plasma field (WebGL2, fixed) ---------- */
    function initHalftoneField(canvas) {
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' }); if (!gl) return false;
      const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
      const FS = `#version 300 es
precision highp float; in vec2 vUv; out vec4 outColor;
uniform vec2 uResolution; uniform float uTime; uniform float uAmplitude; uniform float uPixelSize; uniform float uGooeyness; uniform float uContrast; uniform float uBias; uniform vec3 uBg; uniform vec3 uFg; uniform float uFade;
float field(vec2 uv){ vec2 c = 2.0 * uv - 1.0; c.x = c.x * 1.6 + uTime * 0.35; float ds = uAmplitude;
  c += ds * 0.4 * sin(c.yx + vec2(1.2, 3.4) + uTime); c += ds * 0.2 * sin(5.2 * c.yx + vec2(3.5, 0.4) + uTime); c += ds * 0.3 * sin(3.5 * c.yx + vec2(1.2, 3.1) + uTime); c += ds * 1.6 * sin(0.4 * c.yx + vec2(0.8, 2.4) + uTime);
  float L = length(c); float v = 0.0; for (int i = 0; i < 4; i++) v = mix(v, float(i) / 3.0, cos(float(i) * L)); return clamp(v, 0.0, 1.0); }
float lumaToRadius(float luma, float px){ float v = clamp((luma - 0.5 + uBias) * uContrast + 0.5, 0.0, 1.0); return v * px * 0.6 + px * 0.05; }
float smin(float a, float b, float k){ if (k <= 0.001) return min(a, b); float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
void main(){ vec2 px = vUv * uResolution; vec2 baseCell = floor(px / uPixelSize); float minDist = 1.0e5; float k = uGooeyness * 1.5;
  for (int dx = -1; dx <= 1; dx++){ for (int dy = -1; dy <= 1; dy++){ vec2 cell = baseCell + vec2(float(dx), float(dy)); if (mod(cell.x + cell.y, 2.0) > 0.5) continue; vec2 centre = (cell + 0.5) * uPixelSize; float luma = field((cell + 0.5) * uPixelSize / uResolution); float d = length(px - centre) - lumaToRadius(luma, uPixelSize); minDist = smin(minDist, d, k * uPixelSize); } }
  float aa = max(fwidth(minDist), 0.0001); float shape = 1.0 - smoothstep(-aa, aa, minDist);
  float bottom = smoothstep(0.72, 0.18, vUv.y); float right = smoothstep(0.35, 0.9, vUv.x); float m = clamp(max(bottom, right) * smoothstep(1.0, 0.86, vUv.y), 0.0, 1.0);
  outColor = vec4(mix(uBg, uFg, shape * m * uFade), 1.0); }`;
      let prog; try { prog = mkProgram(gl, VS, FS); } catch (e) { return false; }
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = n => gl.getUniformLocation(prog, n); const uRes = u('uResolution'), uTime = u('uTime'), uFade = u('uFade'), uBg = u('uBg'), uFg = u('uFg');
      gl.uniform1f(u('uAmplitude'), 1.35); gl.uniform1f(u('uPixelSize'), 8); gl.uniform1f(u('uGooeyness'), 0.3); gl.uniform1f(u('uContrast'), 1.45); gl.uniform1f(u('uBias'), 0);
      let raf = 0, time = 0, fade = 0, on = true, last = performance.now();
      const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
      const colours = () => { const cs = getComputedStyle(document.documentElement); const bg = parseCol(cs.getPropertyValue('--ground').trim() || '#0a0a0a'), fg = parseCol(cs.getPropertyValue('--dot').trim() || '#555555'); gl.uniform3f(uBg, bg[0], bg[1], bg[2]); gl.uniform3f(uFg, fg[0], fg[1], fg[2]); if (reduceM) draw(); };
      const size = () => { const b = canvas.getBoundingClientRect(); const w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(uRes, w, h); if (reduceM) draw(); } };
      const tick = now => { const s = Math.min((now - last) / 16.667, 3); last = now; time += 0.0024 * s; fade = Math.min(1, fade + 0.02 * s); gl.uniform1f(uTime, time); gl.uniform1f(uFade, fade); draw(); raf = on && !reduceM ? requestAnimationFrame(tick) : 0; };
      const wake = () => { if (!raf && on && !reduceM) { last = performance.now(); raf = requestAnimationFrame(tick); } };
      colours(); size();
      if (reduceM) { gl.uniform1f(uTime, 2.4); gl.uniform1f(uFade, 1); draw(); } else raf = requestAnimationFrame(tick);
      document.addEventListener('visibilitychange', () => { on = !document.hidden; wake(); });
      new ResizeObserver(() => { size(); wake(); }).observe(canvas);
      return true;
    }
    window.__hypjamGoo = { initGoo, initHalftoneField };
  })();

(() => {
  const doc = document.scrollingElement || document.documentElement, root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, fine = matchMedia('(pointer: fine)').matches;
  const isWide = () => innerWidth > 900;
  document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('mouseenter', () => {}));
  /* active nav for sub-pages: highlight the pill matching data-page */
  const pg = document.body.dataset.page; const act = pg && document.querySelector(`.nav-links a[data-id="${pg}"]`);
  if (act) { act.setAttribute('data-active', 'true'); act.setAttribute('aria-current', 'page'); const blob = document.querySelector('.nav-blob'), ghost = document.querySelector('.nav-ghost'); if (blob) { blob.style.opacity = 1; blob.style.width = act.offsetWidth + 'px'; blob.style.transform = `translateX(${act.offsetLeft}px)`; ghost.style.transform = `translateX(${-act.offsetLeft}px)`; } }
  /* faq accordions: animate open/close */
  document.querySelectorAll('details.faq-item').forEach(d => { const s = d.querySelector('summary'); s.addEventListener('click', e => { if (reduce) return; if (!d.open) return; e.preventDefault(); d.classList.add('closing'); setTimeout(() => { d.open = false; d.classList.remove('closing'); }, 260); }); });
  /* reveal on scroll */
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.setAttribute('data-in', ''); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
  /* ---------- dot bands + book dots: a still grid that wakes near the pointer ---------- */
  function dots(canvas) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const GAP = 22, OFF = 11, RAD = 105, PUSH = 35.7, R0 = 1.1, DR = 1.5, A0 = .28, DA = .6;
    const INK = [244, 244, 244], HOT = [255, 111, 31];
    let pts = [], w = 0, h = 0, tick = 0, cx = -9e3, cy = -9e3;
    const size = () => {
      const b = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = b.width; h = b.height; if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = [];
      for (let y = OFF; y < h; y += GAP) for (let x = OFF; x < w; x += GAP) pts.push({ x, y });
    };
    const draw = () => {
      if (!w || !h) { tick = 0; return; }
      const b = canvas.getBoundingClientRect(), mx = cx - b.left, my = cy - b.top;
      ctx.clearRect(0, 0, w, h);
      let awake = false;
      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        let x = p.x, y = p.y, r = R0, a = A0, t = 0;
        if (d < RAD) {
          awake = true; t = (1 - d / RAD) ** 2;
          const k = PUSH * t / (d || 1);
          x += dx * k; y += dy * k; r = R0 + DR * t; a = A0 + DA * t;
        }
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
        ctx.fillStyle = t > 0
          ? `rgba(${Math.round(INK[0] + (HOT[0] - INK[0]) * t)},${Math.round(INK[1] + (HOT[1] - INK[1]) * t)},${Math.round(INK[2] + (HOT[2] - INK[2]) * t)},${a})`
          : `rgba(${INK[0]},${INK[1]},${INK[2]},${a})`;
        ctx.fill();
      }
      tick = (awake && !reduce) ? requestAnimationFrame(draw) : 0;
    };
    const kick = () => { if (!tick) tick = requestAnimationFrame(draw); };
    size(); kick();
    if (fine && !reduce) {
      addEventListener('pointermove', e => { cx = e.clientX; cy = e.clientY; kick(); }, { passive: true });
      document.addEventListener('pointerleave', () => { cx = cy = -9e3; kick(); });
      addEventListener('blur', () => { cx = cy = -9e3; kick(); });
      addEventListener('scroll', kick, { passive: true });
    }
    addEventListener('resize', () => { size(); kick(); });
    if (window.ResizeObserver) new ResizeObserver(() => { size(); kick(); }).observe(canvas);
  }
  document.querySelectorAll('.band canvas').forEach(c => dots(c));
  const bd = document.querySelector('.book-dots canvas'); if (bd) dots(bd);

  /* ---------- fixed field: dots that wake near the pointer ---------- */
  (() => {
    const canvas = document.querySelector('.field'); if (!canvas) return;
    if (window.__hypjamGoo && window.__hypjamGoo.initHalftoneField(canvas)) return;
    const ctx = canvas.getContext('2d'); let w, h, dpr, px = -9e3, py = -9e3, sx = px, sy = py;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); w = innerWidth; h = innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; }, { passive: true });
    addEventListener('pointerleave', () => { px = py = -9e3; });
    const gap = 34;
    const draw = () => {
      sx += (px - sx) * .18; sy += (py - sy) * .18;
      ctx.clearRect(0, 0, w, h);
      const off = (window.scrollX * .12) % gap;
      for (let y = 88; y < h - 96; y += gap) for (let x = -off; x < w + gap; x += gap) {
        const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
        const n = Math.max(0, 1 - d / 190);
        const r = .9 + n * 1.9;
        ctx.fillStyle = n > .02 ? `rgba(${Math.round(244 + (255 - 244) * n)},${Math.round(244 - (244 - 111) * n)},${Math.round(244 - (244 - 31) * n)},${.08 + n * .8})` : 'rgba(244,244,244,.08)';
        ctx.beginPath(); ctx.arc(x - dx * n * .12, y - dy * n * .12, r, 0, 6.283); ctx.fill();
      }
      if (!reduce) requestAnimationFrame(draw);
    };
    draw();
  })();

  /* ---------- booking: google calendar appointment schedule, loaded only when asked for ---------- */
  (() => {
    /* one switch for the whole site: fill CAL in with '<user>/<event>' to move booking to cal.com,
       leave it empty to keep the google calendar appointment schedule. /book in vercel.json follows. */
    const CAL = 'avi-aggarwal-hypjam/intro';
    const GCAL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2RXwUF95RF4StXDvlphdkP8hZGhSSuQUfyHoV8r_igNgn5L-s1g8oYSeiJEDTOfOGGogAyfkir?gv=true';
    const KIND = CAL ? 'cal' : 'gcal';
    const BOOK = CAL ? `https://cal.com/${CAL}?embed=true&theme=dark&layout=month_view` : GCAL;
    const load = host => {
      if (!host) return null; if (host.dataset.live) return host.querySelector('iframe');
      const f = document.createElement('iframe'); f.src = BOOK; f.title = 'book a 30 minute intro call with hypjam'; f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.allow = 'camera; microphone; fullscreen; clipboard-write; payment';
      host.dataset.src = KIND; host.dataset.live = 'loading';
      f.addEventListener('load', () => { host.dataset.live = 'on'; }, { once: true }); host.appendChild(f); return f;
    };
    window.__hypjamBook = load;
    const inline = document.getElementById('cal-embed');
    document.querySelectorAll('[data-book-load]').forEach(b => b.addEventListener('click', () => load(inline)));
  })();

  /* ---------- message sheet ---------- */
  (() => {
    const dlg = document.getElementById('msg'); if (!dlg || !dlg.showModal) return;
    const tabs = [...dlg.querySelectorAll('.msg-tab')], sides = { hire: dlg.querySelector('#msg-side-hire'), book: dlg.querySelector('#msg-side-book'), join: dlg.querySelector('#msg-side-join') }, order = ['hire', 'book', 'join'], form = dlg.querySelector('.msg-form'), done = dlg.querySelector('.msg-done'), err = dlg.querySelector('.msg-err'), send = dlg.querySelector('.msg-foot .btn'); let side = 'hire', last = null;
    const show = which => { side = which; tabs.forEach(t => { const on = t.dataset.cur === which; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; }); Object.entries(sides).forEach(([k, el]) => el.hidden = k !== which); dlg.querySelectorAll('[data-for]').forEach(el => { if (el.classList.contains('msg-blurb') || el.classList.contains('msg-note')) el.hidden = el.dataset.for !== which; }); dlg.querySelector('.msg-tabs').dataset.side = which; dlg.dataset.side = which; dlg.setAttribute('aria-labelledby', 'msg-title-' + which); err.hidden = true; if (which === 'book' && window.__hypjamBook) window.__hypjamBook(dlg.querySelector('.msg-embed')); };
    const open = (which, from) => { last = from || document.activeElement; show(which); form.hidden = false; done.hidden = true; form.reset(); root.classList.add('msg-open'); dlg.showModal(); const f = sides[which].querySelector('input,textarea,select,iframe,a'); f && setTimeout(() => f.focus(), 60); };
    const close = () => { dlg.close(); root.classList.remove('msg-open'); last && last.focus && last.focus(); };
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.cur)));
    dlg.querySelector('.msg-tabs').addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(order[(order.indexOf(side) + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length]); tabs.find(t => t.dataset.cur === side).focus(); } });
    dlg.querySelector('.msg-x').addEventListener('click', close); dlg.querySelector('.msg-back').addEventListener('click', close);
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); }); dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
    const MAIL = 'hello@hypjam.com';
    const compose = () => {
      const box = sides[side], v = n => { const el = box.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
      const picked = n => [...box.querySelectorAll('input[name="' + n + '"]:checked')].map(i => i.value).join(', ');
      const L = []; let subj;
      if (side === 'hire') { subj = 'brief for ' + (v('brand') || 'a new brand');
        L.push('brand: ' + v('brand'), 'site: ' + (v('site') || '-'), 'platforms: ' + (picked('p') || '-'), 'monthly budget: ' + (v('budget') || '-'), '', 'what we need:', v('need'), '', 'reply to: ' + v('email'));
      } else { subj = 'roster application' + (v('handle') ? ' from ' + v('handle') : '');
        L.push('name: ' + (v('name') || '-'), 'handle: ' + (v('handle') || '-'), 'city: ' + (v('city') || '-'), 'niches: ' + (picked('n') || '-'), '', 'videos:', v('links') || '-', '', 'reply to: ' + (v('email2') || '-'));
      }
      L.push('', 'sent from hypjam.vercel.app');
      return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(L.join('\n'));
    };
    form.addEventListener('submit', e => { e.preventDefault(); err.hidden = true; const box = sides[side]; let bad = null;
      box.querySelectorAll('.fld').forEach(f => f.classList.remove('is-bad'));
      box.querySelectorAll('input[required],textarea[required],input[type=email]').forEach(inp => { if (bad) return; const v = inp.value.trim(); const need = inp.required || inp.type === 'email'; if (need && (!v || (inp.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)))) bad = inp; });
      if (bad) { bad.closest('.fld').classList.add('is-bad'); err.textContent = bad.type === 'email' ? 'that email does not look right.' : 'fill in ' + (bad.closest('.fld').querySelector('span')?.textContent || 'that field') + ' first.'; err.hidden = false; bad.focus(); return; }
      const href = compose(); const alt = dlg.querySelector('.msg-done-alt a'); if (alt) alt.href = href;
      form.hidden = true; done.hidden = false;
      dlg.querySelector('.msg-done-copy').textContent = side === 'hire' ? 'your mail app should have opened with the brief already written. press send and it lands with avi — we read every brief ourselves.' : 'your mail app should have opened with your application already written. press send and it lands with avi.';
      dlg.querySelector('.msg-back').focus(); location.href = href;
    });
    document.querySelectorAll('a[data-cur="write"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); open('hire', a); }));
    document.querySelectorAll('[data-book-sheet]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.button) return; e.preventDefault(); open('book', a); }));
    document.querySelectorAll('a[href="#contact"].foot-join, a[data-cur="say hi"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); open(a.classList.contains('foot-join') ? 'join' : 'hire', a); }));
    const joinLink = [...document.querySelectorAll('.foot-links a')].find(a => /join the roster/.test(a.textContent)); if (joinLink) { joinLink.setAttribute('data-cur', 'join'); joinLink.addEventListener('click', e => { e.preventDefault(); open('join', joinLink); }); }
    window.__hypjamMsg = open;
  })();
  /* ---------- route wipe for internal page links (data-wipe) ---------- */
  (() => {
    const w = document.querySelector('.route-wipe'); if (!w || reduce) return;
    document.addEventListener('click', e => { const a = e.target.closest('a[data-wipe]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.button) return; e.preventDefault();
      const r = a.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const rad = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) + 40;
      Object.assign(w.style, { left: (cx - rad) + 'px', top: (cy - rad) + 'px', width: rad * 2 + 'px', height: rad * 2 + 'px' }); w.dataset.state = 'covering';
      setTimeout(() => { location.href = a.href; }, 520); });
    addEventListener('pageshow', () => { if (w.dataset.state) { w.dataset.state = 'leaving'; setTimeout(() => { delete w.dataset.state; w.style.opacity = ''; }, 600); } });
  })();
  /* ---------- custom cursor with labels (reference behaviour) ---------- */
  if (fine && !reduce) (() => {
    const arrow = document.querySelector('.cur-arrow'), pill = document.querySelector('.cur-pill'); let x = -9999, y = -9999, px = -9999, py = -9999;
    root.classList.add('has-cursor');
    const setLabel = t => { const c = t && t.closest ? t.closest('[data-cur]') : null; pill.textContent = c ? (c.dataset.cur || 'scroll') : (t && t.closest && t.closest('a, button, summary') ? 'open' : 'scroll'); };
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; setLabel(e.target); arrow.style.transform = `translate3d(${x}px,${y}px,0)`; arrow.style.opacity = '1'; pill.style.opacity = '1'; if (px < -9000) { px = x; py = y; } }, { passive: true });
    const hide = () => { arrow.style.opacity = '0'; pill.style.opacity = '0'; };
    document.addEventListener('pointerleave', hide); addEventListener('blur', hide);
    document.addEventListener('pointerover', e => { if (e.target && e.target.tagName === 'IFRAME') hide(); }, { passive: true });
    addEventListener('pointerdown', () => arrow.classList.add('is-down')); addEventListener('pointerup', () => arrow.classList.remove('is-down'));
    const loop = () => { px += (x - px) * .18; py += (y - py) * .18; pill.style.transform = `translate3d(${px + 13}px,${py + 11}px,0)`; requestAnimationFrame(loop); }; loop();
  })();


  /* the home-page message sheet hijacks any "join the roster" footer link and the founder
     link into a modal. on sub-pages those are real crawlable pages, so hand them back:
     replaceWith(cloneNode) drops the listener, every other handler here is delegated. */
  document.querySelectorAll('.foot-links a[href="/join"], .founder[href="/hire"]').forEach(a => a.replaceWith(a.cloneNode(true)));
})();
