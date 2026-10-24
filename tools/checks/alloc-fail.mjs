// GPU memory running out (phones): framebuffer allocation is forced to fail, (1) once while the page
// starts and (2) N times on a later resize. The page must retry at a smaller size and keep running
// (no black page, no error note).
//
//   node tools/checks/alloc-fail.mjs [N]
import { launch, openPage, pageURL } from '../lib/browser.mjs';

const browser = await launch();
// (1) at start: fail the first framebuffer check made while allocating the size-dependent targets
// (found by the function name `allocate` in the call stack; adjust if that function is renamed)
{
  const { ctx, page, logs } = await openPage(browser, { width: 400, height: 240 });
  await page.addInitScript(() => {
    const P = WebGL2RenderingContext.prototype, orig = P.checkFramebufferStatus;
    window.__forced = 0;
    P.checkFramebufferStatus = function (t) {
      const r = orig.call(this, t);
      if (!window.__forced && /allocate/.test(new Error().stack || '')) { window.__forced = 1; return 0x8CD6; }
      return r;
    };
  });
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
  await page.evaluate(n => {
    const P = WebGL2RenderingContext.prototype, orig = P.checkFramebufferStatus;
    let left = n;
    P.checkFramebufferStatus = function (t) { if (left > 0) { left--; return 0x8CD6; } return orig.call(this, t); };
  }, fails);
  await page.setViewportSize({ width: 640, height: 360 });
  const fr = await page.evaluate(() => window.__frame);
  await page.waitForFunction(f => window.__frame > f + 6, fr, { timeout: 600000, polling: 500 });
  const res = await page.evaluate(() => ({ w: window.__debug.R.w, h: window.__debug.R.h, frame: window.__frame, err: window.__error || null, note: getComputedStyle(document.getElementById('note')).display }));
  const f0 = res.frame;
  const f1 = await page.waitForFunction(f => window.__frame > f && window.__frame, f0, { timeout: 600000, polling: 500 }).then(h => h.jsonValue()).catch(() => f0);
  console.log(`fail ${fails}x on resize:`, JSON.stringify(res), 'frames advancing:', f1 > f0, logs.filter(l => l.startsWith('[pageerror]')).length, 'page errors');
  await ctx.close();
}
await browser.close();
