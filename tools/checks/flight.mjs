// Scripted flight, logged: checks the glider (dives gain speed, climbs trade it for height, turns
// bank, the bird is kept out of the deep cloud sea, flying through a tower).
//
//   node tools/checks/flight.mjs dive|climb|turn|weave [frames] [extra query]
//   node tools/checks/flight.mjs none 300 "preset=approach&dt=0.1"     fly into a tower
// Columns: t, x, alt, z, speed, bank, gamma (pitch), yaw, sea top, sdf at the bird, camera roll, fov
import { launch, openPage, pageURL, waitDone } from '../lib/browser.mjs';

const [, , script = 'weave', frames = '600', extra = ''] = process.argv;
const browser = await launch();
const { page, logs } = await openPage(browser, { width: 64, height: 36 });
await page.goto(pageURL(`test&log&w=48&h=27&scale=0.3&dt=0.05&frames=${frames}${script !== 'none' ? '&script=' + script : ''}&${extra}`), { timeout: 0 });
await waitDone(page, 1800000);
const log = await page.evaluate(() => window.__log);
console.log('     t       x     alt       z  speed   bank  gamma    yaw    sea    sdf   roll    fov');
const row = r => r.map(v => String(v).padStart(6)).join(' ');
for (let i = 0; i < log.length; i += Math.max(1, Math.floor(log.length / 24))) console.log(row(log[i]));
console.log(row(log[log.length - 1]));
for (const l of logs.filter(l => l.startsWith('[pageerror]'))) console.log(l);
await browser.close();
