// Run the page and report every WebGL error (with the call and the program that was bound),
// page errors and console messages.
//
//   node tools/checks/gl-errors.mjs ["test&frames=3&w=160&h=90&preset=start"] [screenshot.png]
import { launch, openPage, pageURL, waitDone } from '../lib/browser.mjs';

const query = process.argv[2] || 'test&frames=3&w=160&h=90';
const browser = await launch();
const { page, logs } = await openPage(browser, { width: 400, height: 240 });
await page.addInitScript(() => {
  window.__glErrors = [];
  const P = WebGL2RenderingContext.prototype;
  const names = ['drawArrays', 'drawArraysInstanced', 'blitFramebuffer', 'readPixels', 'clear', 'texImage2D', 'texImage3D', 'texSubImage2D',
    'texSubImage3D', 'renderbufferStorageMultisample', 'framebufferTextureLayer', 'framebufferTexture2D', 'getBufferSubData', 'uniform1i',
    'uniform1f', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform3fv', 'uniformMatrix4fv', 'drawBuffers', 'bufferData', 'fenceSync', 'beginQuery', 'endQuery'];
  let calls = 0;
  for (const n of names) {
    const orig = P[n];
    if (!orig) continue;
    P[n] = function (...a) {
      const r = orig.apply(this, a);
      const e = this.getError();
      calls++;
      if (e && window.__glErrors.length < 50) {
        window.__glErrors.push({ fn: n, err: '0x' + e.toString(16), stack: (new Error().stack || '').split('\n').slice(2, 4).join(' | ') });
      }
      return r;
    };
  }
  window.__glCalls = () => calls;
});
const t0 = Date.now();
await page.goto(pageURL(query), { timeout: 0 });
try { await waitDone(page, 600000); } catch (e) { logs.push('[timeout] ' + e.message.split('\n')[0]); }
const res = await page.evaluate(() => ({ done: !!window.__done, error: window.__error || null, frame: window.__frame, glErrors: window.__glErrors, calls: window.__glCalls && window.__glCalls() }));
console.log(`${(Date.now() - t0) / 1000} s, frame ${res.frame}, ${res.calls} GL calls, ${res.glErrors.length} GL errors, error: ${res.error}`);
for (const e of res.glErrors) console.log('  GL', JSON.stringify(e));
for (const l of logs.slice(0, 40)) console.log(l);
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
await browser.close();
process.exit(res.glErrors.length || res.error || logs.some(l => l.startsWith('[pageerror]')) ? 1 : 0);
