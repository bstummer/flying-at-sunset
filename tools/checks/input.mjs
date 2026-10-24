// Steering through real input events (mouse, keyboard, touch) in a live simulation (?test&live:
// fixed time step, but input is read as in normal use). Prints bank / pitch (gamma) / yaw / speed
// after each gesture; expect: right turns bank positive, up climbs, releasing levels out.
//
//   node tools/checks/input.mjs mouse|keys|touch
import { launch, pageURL } from '../lib/browser.mjs';

const mode = process.argv[2] || 'mouse';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 400, height: 300 }, hasTouch: mode === 'touch' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto(pageURL('test&live&log&w=64&h=36&scale=0.3&dt=0.05&frames=100000'), { timeout: 0 });
await page.waitForFunction(() => window.__frame > 2, null, { timeout: 300000 });
// log rows: [t, x, alt, z, speed, bank, gamma, yaw, ...] (see frameStep in index.html)
const state = () => page.evaluate(() => { const l = window.__log[window.__log.length - 1]; return { t: l[0], bank: l[5], gamma: l[6], yaw: l[7], speed: l[4] }; });
const waitSim = async secs => { const t0 = (await state()).t; await page.waitForFunction(t => window.__log[window.__log.length - 1][0] > t, t0 + secs, { timeout: 600000, polling: 200 }); };
if (mode === 'mouse') {
  await page.mouse.move(390, 150); await waitSim(2.5); console.log('mouse right  ', await state());
  await page.mouse.move(200, 20); await waitSim(2.5); console.log('mouse up     ', await state());
  await page.mouse.move(200, 150); await waitSim(3.0); console.log('mouse centre ', await state());
} else if (mode === 'keys') {
  await page.keyboard.down('ArrowLeft'); await waitSim(2.5); console.log('key left     ', await state());
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('KeyS'); await waitSim(2.5); console.log('key S (dive) ', await state());
  await page.keyboard.up('KeyS'); await waitSim(3.0); console.log('released     ', await state());
} else if (mode === 'touch') {
  const cdp = await ctx.newCDPSession(page);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await tp('touchStart', 200, 150);
  for (let i = 1; i <= 10; i++) await tp('touchMove', 200 + i * 6, 150);
  await waitSim(2.5); console.log('drag right   ', await state());
  for (let i = 1; i <= 10; i++) await tp('touchMove', 260 - i * 6, 150 - i * 6);
  await waitSim(2.5); console.log('drag up      ', await state());
  await tp('touchEnd'); await waitSim(3.0); console.log('released     ', await state());
  console.log('touch indicator class after release:', JSON.stringify(await page.evaluate(() => document.getElementById('touch').className)));
}
await browser.close();
