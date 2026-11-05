// Run the page and report every WebGPU error (validation, out of memory, internal: the message
// names the call and the object), page errors and console messages.
//
//   node tools/checks/gpu-errors.mjs ["test&frames=3&w=160&h=90&preset=start"] [screenshot.png]
import { gpuErrors, launch, openPage, pageURL, waitDone, watchGpuErrors } from '../lib/browser.mjs';

const query = process.argv[2] || 'test&frames=3&w=160&h=90';
const browser = await launch();
const { page, logs } = await openPage(browser, { width: 400, height: 240 });
await watchGpuErrors(page);
const t0 = Date.now();
await page.goto(pageURL(query), { timeout: 0 });
try { await waitDone(page, 600000); } catch (e) { logs.push('[timeout] ' + e.message.split('\n')[0]); }
const res = await page.evaluate(() => ({ done: !!window.__done, error: window.__error || null, frame: window.__frame }));
res.gpuErrors = await gpuErrors(page);
console.log(`${(Date.now() - t0) / 1000} s, frame ${res.frame}, ${res.gpuErrors.length} WebGPU errors, error: ${res.error}`);
for (const e of res.gpuErrors) console.log('  WebGPU', e.slice(0, 1500));
for (const l of logs.slice(0, 40)) console.log(l.slice(0, 1500));
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
await browser.close();
process.exit(res.gpuErrors.length || res.error || logs.some(l => l.startsWith('[pageerror]')) ? 1 : 0);
