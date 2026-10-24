// The sources, run as ES modules (as in development, see tools/serve.mjs), render exactly what the
// built page renders, without errors: the two ways of running the piece are one program.
//
//   node tools/checks/modules.mjs [view queries...]     (default: the start, inside cloud, the sun)
import { launch, openPage, pageURL, waitDone, canvasPNG, comparePNG } from '../lib/browser.mjs';
import { serve } from '../serve.mjs';

const views = process.argv.slice(2).length ? process.argv.slice(2) : ['', 'preset=inside', 'preset=sun'];
const SIZE = '&w=320&h=180&frames=8&scale=0.5';
const server = await serve(0);
const src = `http://127.0.0.1:${server.address().port}/src/index.html`;
const browser = await launch();
let bad = 0;
const render = async url => {
  const { ctx, page, logs } = await openPage(browser, { width: 320, height: 180 });
  await page.goto(url, { timeout: 0 });
  await waitDone(page, 900000);
  const err = await page.evaluate(() => window.__error || null);
  const png = await canvasPNG(page);
  await ctx.close();
  return { png, err, errors: logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]')) };
};
for (const v of views) {
  const q = '?test&' + v + SIZE;
  const [a, b] = await Promise.all([render(src + q), render(pageURL('test&' + v + SIZE))]);
  const d = await comparePNG(browser, a.png, b.png);
  const ok = !a.err && !b.err && !a.errors.length && !b.errors.length && d.max === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${(v || 'start').padEnd(16)} modules vs built: max ${d.max}, mean ${d.mean !== undefined ? d.mean.toFixed(3) : '-'}` +
    `${a.err || a.errors.length ? '  modules: ' + (a.err || a.errors[0]) : ''}${b.err || b.errors.length ? '  built: ' + (b.err || b.errors[0]) : ''}`);
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
