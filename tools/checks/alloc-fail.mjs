// GPU memory running out (phones): the allocation of the size-dependent render targets is made to
// report running out of memory (WebGPU reports it asynchronously, through the error scope around
// the allocation), (1) once while the page starts and (2) N times on a later resize. The page must
// retry at a smaller size and keep running (no black page, no error note).
//
//   node tools/checks/alloc-fail.mjs [N]
import { launch, openPage, pageURL } from '../lib/browser.mjs';

// make the next n out-of-memory error scopes opened by `allocate` (found by its name in the call
// stack; adjust if that function is renamed) report an out-of-memory error
const forceOOM = n => {
  const D = GPUDevice.prototype, push = D.pushErrorScope, pop = D.popErrorScope;
  let left = n, fake = 0;
  window.__forced = 0;
  D.pushErrorScope = function (filter) {
    if (left > 0 && filter === 'out-of-memory' && /allocate/.test(new Error().stack || '')) { left--; fake++; window.__forced++; }
    return push.call(this, filter);
  };
  D.popErrorScope = function () {
    const r = pop.call(this);
    if (fake > 0) { fake--; return r.then(() => new GPUOutOfMemoryError('forced by tools/checks/alloc-fail.mjs')); }
    return r;
  };
};
const browser = await launch();
// (1) at start
{
  const { ctx, page, logs } = await openPage(browser, { width: 400, height: 240 });
  await page.addInitScript(`(${forceOOM})(1)`);
  await page.goto(pageURL('test&frames=3&w=160&h=90'), { timeout: 0 });
  await page.waitForFunction(() => window.__done || window.__error, null, { timeout: 600000, polling: 500 }).catch(() => {});
  const st = await page.evaluate(() => ({ forced: window.__forced, done: !!window.__done, error: window.__error || null, frame: window.__frame, R: window.__debug ? { w: window.__debug.R.w, h: window.__debug.R.h } : null, note: getComputedStyle(document.getElementById('note')).display, canvasOn: document.getElementById('view').classList.contains('on') }));
  console.log('fail at start :', JSON.stringify(st), logs.filter(l => l.startsWith('[pageerror]')).length, 'page errors');
  await ctx.close();
}
// (2) on resize
{
  const fails = Number(process.argv[2] || 2);
  const { ctx, page, logs } = await openPage(browser, { width: 480, height: 270 });
  await page.goto(pageURL('debug'), { timeout: 0 });
  await page.waitForFunction(() => window.__frame > 3, null, { timeout: 600000, polling: 500 });
  await page.evaluate(`(${forceOOM})(${fails})`);
  await page.setViewportSize({ width: 640, height: 360 });
  const fr = await page.evaluate(() => window.__frame);
  await page.waitForFunction(f => window.__frame > f + 6, fr, { timeout: 600000, polling: 500 });
  const res = await page.evaluate(() => ({ forced: window.__forced, w: window.__debug.R.w, h: window.__debug.R.h, frame: window.__frame, err: window.__error || null, note: getComputedStyle(document.getElementById('note')).display }));
  const f0 = res.frame;
  const f1 = await page.waitForFunction(f => window.__frame > f && window.__frame, f0, { timeout: 600000, polling: 500 }).then(h => h.jsonValue()).catch(() => f0);
  console.log(`fail ${fails}x on resize:`, JSON.stringify(res), 'frames advancing:', f1 > f0, logs.filter(l => l.startsWith('[pageerror]')).length, 'page errors');
  await ctx.close();
}
await browser.close();
