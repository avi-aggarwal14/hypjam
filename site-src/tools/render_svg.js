#!/usr/bin/env node
/*
 render_svg.js — render the HQ drawing (or any part file) the way visitors see it.

   node tools/render_svg.js in.svg out.png [x y w h] [--width=2200] [--only=id,id] [--hide=id,id] [--bg=#000]

   in.svg      any SVG with the master viewBox (a part, the assembled hq.svg, or Lance's reference)
   out.png     where to write the PNG
   x y w h     optional viewBox crop in canvas units (default: the file's own viewBox, 0 0 44001 21918)
   --width=N   output width in px (default 2200; height follows the crop's aspect)
   --only=…    comma-separated ids; everything else under the svg root is hidden (matches [id="…"], so "#1-fade" works)
   --hide=…    comma-separated ids to hide (e.g. --hide=#1-fade to see room 1's interior as the camera does)
   --bg=…      background colour (default #000, the hero stage)

 What it does, exactly like the hero engine's tv() loader:
   - strips width/height, sets preserveAspectRatio="xMidYMid meet"
   - removes any <rect> wider than 40000 and Frame 7's own rect
   - every [stroke] element gets vector-effect="non-scaling-stroke" and stroke-width="1"
   - stroke-opacity="0.2" elements get stroke-dasharray 4px 6px
 Runs on the Playwright install in the scratchpad (or a PLAYWRIGHT_DIR you point at).
*/
const fs = require('fs');
const path = require('path');

const PW_DIR = process.env.PLAYWRIGHT_DIR ||
  '/private/tmp/claude-501/-Users-vinee-Desktop-UGC-Agency/5427b9f2-20ea-4225-ae81-cd09121648f3/scratchpad/pw';

function loadPlaywright() {
  const candidates = [path.join(PW_DIR, 'node_modules', 'playwright'), 'playwright'];
  for (const c of candidates) { try { return require(c); } catch (e) { /* next */ } }
  console.error('render_svg.js: playwright not found. Set PLAYWRIGHT_DIR to a folder whose node_modules has playwright.');
  process.exit(2);
}

function parseArgs(argv) {
  const pos = []; const opt = { width: 2200, only: null, hide: null, bg: '#000' };
  for (const a of argv) {
    if (a.startsWith('--width=')) opt.width = parseInt(a.slice(8), 10);
    else if (a.startsWith('--only=')) opt.only = a.slice(7).split(',').filter(Boolean);
    else if (a.startsWith('--hide=')) opt.hide = a.slice(7).split(',').filter(Boolean);
    else if (a.startsWith('--bg=')) opt.bg = a.slice(5);
    else pos.push(a);
  }
  return { pos, opt };
}

(async () => {
  const { pos, opt } = parseArgs(process.argv.slice(2));
  if (pos.length < 2) {
    console.error('usage: node render_svg.js in.svg out.png [x y w h] [--width=2200] [--only=id,id] [--hide=id,id] [--bg=#000]');
    process.exit(1);
  }
  const [inFile, outFile] = pos;
  let crop = null;
  if (pos.length >= 6) {
    crop = pos.slice(2, 6).map(Number);
    if (crop.some(n => !isFinite(n)) || crop[2] <= 0 || crop[3] <= 0) { console.error('bad crop: x y w h must be numbers with w,h > 0'); process.exit(1); }
  }
  let svgText = fs.readFileSync(inFile, 'utf8');
  svgText = svgText.replace(/^\s*<\?xml[^>]*\?>\s*/, '').replace(/<!DOCTYPE[^>]*>/i, '');
  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  const fileVB = vbMatch ? vbMatch[1].trim().split(/[\s,]+/).map(Number) : [0, 0, 44001, 21918];
  const vb = crop || fileVB;
  const width = Math.max(64, opt.width | 0);
  const height = Math.max(1, Math.round(width * vb[3] / vb[2]));

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:${opt.bg};overflow:hidden">` +
      `<div id="stage" style="position:fixed;inset:0;background:${opt.bg}">${svgText}</div></body></html>`);
    const stats = await page.evaluate(({ vb, only, hide }) => {
      const svg = document.querySelector('svg');
      if (!svg) return { error: 'no <svg> element in file' };
      svg.removeAttribute('width'); svg.removeAttribute('height');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      svg.querySelectorAll('rect').forEach(r => { if (parseFloat(r.getAttribute('width') || '0') > 4e4) r.remove(); });
      const f7 = svg.querySelector('[id="Frame 7"]'); if (f7) { const r = f7.querySelector(':scope > rect'); if (r) r.remove(); }
      let stroked = 0, dashed = 0;
      svg.querySelectorAll('[stroke]').forEach(el => {
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('stroke-width', '1');
        stroked++;
        if (el.getAttribute('stroke-opacity') === '0.2') { el.style.strokeDasharray = '4px 6px'; dashed++; }
      });
      if (only) {
        const keep = new Set();
        only.forEach(id => { const el = svg.querySelector(`[id="${id}"]`); if (el) { let n = el; while (n && n !== svg) { keep.add(n); n = n.parentNode; } el.querySelectorAll('*').forEach(x => keep.add(x)); } });
        svg.querySelectorAll('g').forEach(g => { if (!keep.has(g)) g.style.display = 'none'; });
      }
      if (hide) hide.forEach(id => { const el = svg.querySelector(`[id="${id}"]`); if (el) el.style.display = 'none'; });
      svg.setAttribute('viewBox', vb.join(' '));
      return { stroked, dashed, elements: svg.querySelectorAll('path,line,rect,circle,ellipse,polyline,polygon').length };
    }, { vb, only: opt.only, hide: opt.hide });
    if (stats.error) { console.error('render_svg.js:', stats.error); process.exit(1); }
    await page.waitForTimeout(150);
    await page.screenshot({ path: outFile, fullPage: false });
    console.log(`${outFile}  ${width}x${height}px  viewBox=${vb.join(' ')}  elements=${stats.elements} stroked=${stats.stroked} dashed=${stats.dashed}`);
  } finally { await browser.close(); }
})().catch(e => { console.error('render_svg.js failed:', e.message); process.exit(1); });
