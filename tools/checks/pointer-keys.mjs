// Input edge cases: the mouse leaving the window levels the bird out; Cmd/Ctrl + arrow (browser and
// system shortcuts) must not steer while a plain arrow does; tapping Meta clears held keys (macOS
// drops key-ups of keys released while Cmd is held). Runs in ?test&live (fixed time step, live
// input) so the result does not depend on how fast the machine renders.
//
//   node tools/checks/pointer-keys.mjs
import { launch, openPage, pageURL } from '../lib/browser.mjs';

const browser = await launch();
const { page, logs } = await openPage(browser, { width: 400, height: 300 });
await page.goto(pageURL('test&live&log&w=64&h=36&scale=0.3&dt=0.05&frames=100000'), { timeout: 0 });
await page.waitForFunction(() => window.__frame > 2, null, { timeout: 600000 });
const simT = () => page.evaluate(() => window.__log[window.__log.length - 1][0]);
const waitSim = async secs => { const t0 = await simT(); await page.waitForFunction(t => window.__log[window.__log.length - 1][0] > t, t0 + secs, { timeout: 600000, polling: 200 }); };
const bank = () => page.evaluate(() => window.__log[window.__log.length - 1][5]);
const inp = () => page.evaluate(() => JSON.stringify({ mouse: window.__debug.input.mouse, keys: [...window.__debug.input.keys] }));
await page.mouse.move(390, 150); await waitSim(2.5);
const a = await bank();
await page.evaluate(() => document.getElementById('view').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
console.log('after pointer leave, input', await inp(), '(expect mouse null)');
await waitSim(3);
const b = await bank();
await page.keyboard.down('Meta'); await page.keyboard.down('ArrowLeft'); await waitSim(1.5);
const c = await bank();
console.log('cmd+left held, input   ', await inp(), '(expect no keys)');
await page.keyboard.up('ArrowLeft'); await page.keyboard.up('Meta');
await page.keyboard.down('ArrowLeft'); await waitSim(2.5);
const d = await bank();
await page.keyboard.down('Meta'); await page.keyboard.up('Meta'); await waitSim(0.2);
console.log('meta tap, input        ', await inp(), '(expect no keys)');
await page.keyboard.up('ArrowLeft');
console.log(`bank (deg): mouse right ${a} (positive) | after leave ${b} (back near 0) | cmd+left ${c} (near 0: no steer) | left ${d} (negative)`);
for (const l of logs.filter(l => l.includes('error')).slice(0, 10)) console.log(l);
await browser.close();
