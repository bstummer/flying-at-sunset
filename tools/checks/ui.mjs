// The page as a visitor sees it (no ?test): it fades in, shows the steering hint ~1.8 s after the
// first frame and hides it at ~10 s (or once the viewer has steered for 3 s), with no errors or
// warnings, on a desktop and a phone viewport, and with the ?debug overlay. Hint changes are
// timed inside the page, so the result does not depend on how fast the machine renders.
//
//   node tools/checks/ui.mjs [screenshotPrefix]
import { launch, pageURL } from '../lib/browser.mjs';

const browser = await launch();
for (const [label, opts, q] of [
  ['desktop', { viewport: { width: 640, height: 360 } }, ''],
  ['desktop+debug', { viewport: { width: 640, height: 360 } }, 'debug'],
  ['phone', { viewport: { width: 300, height: 600 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, ''],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const msgs = [];
  page.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(m.type() + ': ' + m.text()); });
  await page.addInitScript(() => {
    window.__ui = [];
    addEventListener('DOMContentLoaded', () => {
      const t = () => +(performance.now() / 1000).toFixed(2);
      for (const id of ['hint', 'view']) new MutationObserver(() => window.__ui.push([t(), id, document.getElementById(id).classList.contains('on')])).observe(document.getElementById(id), { attributes: true, attributeFilter: ['class'] });
    });
  });
  await page.goto(pageURL(q), { timeout: 0 });
  // until the hint has come and gone (the page counts its 10 s from the first frame)
  await page.waitForFunction(() => window.__ui.filter(e => e[1] === 'hint').length >= 2, null, { timeout: 600000, polling: 1000 }).catch(() => {});
  const info = await page.evaluate(() => ({
    hint: document.getElementById('hint').innerText.replace(/\n/g, ' | '),
    events: window.__ui, frames: window.__frame,
    canvas: [document.getElementById('view').width, document.getElementById('view').height],
    scale: window.__debug ? +window.__debug.R.scale.toFixed(2) : null,
    stats: document.getElementById('stats') ? document.getElementById('stats').textContent.split('\n')[0] : null, err: window.__error || null,
  }));
  const shown = info.events.find(e => e[1] === 'view' && e[2]), on = info.events.find(e => e[1] === 'hint' && e[2]), off = info.events.find(e => e[1] === 'hint' && !e[2]);
  console.log(`${label}: canvas ${info.canvas.join('x')} (cloud scale ${info.scale}), ${info.frames} frames, error ${info.err}`);
  console.log(`   hint "${info.hint}"`);
  console.log(`   canvas shown at ${shown ? shown[0] : '-'} s, hint on at ${on ? on[0] : '-'} s, off at ${off ? off[0] : '-'} s (expect on ~1.8 s after the first frame, off ~10 s after it)`);
  if (info.stats) console.log('   debug overlay:', info.stats);
  console.log('   messages:', msgs.length ? msgs.join(' / ').slice(0, 600) : 'none');
  if (process.argv[2]) await page.screenshot({ path: `${process.argv[2]}_${label.replace('+', '_')}.png`, timeout: 300000 }).catch(e => console.log('   (no screenshot: ' + e.message.split('\n')[0] + ')'));
  await ctx.close();
}
await browser.close();
