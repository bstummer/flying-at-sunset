// Render every test preset briefly and report errors (page errors, GL errors, a frame that never
// finishes). Two at a time.
//
//   node tools/checks/presets.mjs [preset ...]      EXTRA="&seed=3" for another world
import { launch, openPage, pageURL, waitDone, pool } from '../lib/browser.mjs';

const ALL = ['start', 'sun', 'away', 'side', 'skim', 'high', 'bank', 'fastdive', 'humps', 'high2', 'upward',
  'tower', 'giant', 'anvil', 'close', 'approach', 'inside', 'under'];
const presets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const browser = await launch();
let bad = 0;
await pool(presets, 2, async p => {
  const { ctx, page, logs } = await openPage(browser, { width: 320, height: 180 });
  await page.addInitScript(() => {
    window.__glErr = 0;
    const P = WebGL2RenderingContext.prototype;
    for (const n of ['drawArrays', 'drawArraysInstanced', 'texSubImage2D', 'texImage3D', 'readPixels', 'blitFramebuffer']) {
      const o = P[n];
      P[n] = function (...a) { const r = o.apply(this, a); if (this.getError()) window.__glErr++; return r; };
    }
  });
  const t0 = Date.now();
  await page.goto(pageURL(`test&preset=${p}&frames=4&w=320&h=180&scale=0.5${process.env.EXTRA || ''}`), { timeout: 0 });
  let timeout = false;
  try { await waitDone(page, 900000); } catch (_) { timeout = true; }
  const r = await page.evaluate(() => ({ err: window.__error || null, frame: window.__frame, gl: window.__glErr, pos: window.__debug && window.__debug.bird.pos.map(v => +v.toFixed(0)) }));
  const errs = logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
  const ok = !timeout && !r.err && !r.gl && !errs.length;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${p.padEnd(9)} ${((Date.now() - t0) / 1000).toFixed(0)} s  frame ${r.frame}  bird at ${r.pos}${r.gl ? '  GL errors ' + r.gl : ''}${r.err ? '  error: ' + r.err : ''}${timeout ? '  TIMEOUT' : ''}`);
  for (const l of errs.slice(0, 3)) console.log('      ' + l.slice(0, 300));
  await ctx.close();
});
await browser.close();
console.log(bad ? `${bad} preset(s) failed` : 'all presets ok');
process.exit(bad ? 1 : 0);
