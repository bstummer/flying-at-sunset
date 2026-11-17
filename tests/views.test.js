// The views the screenshot tool captures (tools/views.js): each well-formed, and asking the page
// only for what it has, so a typo fails here and not after minutes of captures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findView, VIEWS } from '../tools/views.js';
import { LIMITS } from '../tools/measure.js';
import { parseParams } from '../src/core/params.js';

test('view names are unique, lowercase letters and digits, and findView finds each', () => {
  const names = VIEWS.map((v) => v.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(findView(name).name, name);
  }
  assert.throws(() => findView('nowhere'), /unknown view "nowhere"/);
});

for (const view of VIEWS) {
  test(`view "${view.name}" is well-formed`, () => {
    assert.deepEqual(Object.keys(view).filter((k) => !['name', 'params', 'brief', 'crops', 'limits'].includes(k)), []);
    assert.ok(typeof view.brief === 'string' && view.brief.trim() && !view.brief.includes('\n'), 'a brief: one line on what the shot is for');
    // as tools/browser.js testRender asks for it
    const asked = new URLSearchParams({ test: '', ...view.params }).toString();
    assert.deepEqual(parseParams(asked).errors, [], 'URL parameters the page reads, each of its kind');
    assert.ok(!['test', 'w', 'h', 'frames', 'scale', 'keep', 'every', 'freeze', 'dt'].some((k) => k in view.params), 'what the capture itself sets');
    for (const [name, box] of Object.entries(view.crops ?? {})) {
      assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `crop name "${name}"`);
      const [x, y, w, h] = box;
      assert.ok(box.length === 4 && box.every(Number.isFinite), `crop "${name}" is [x, y, w, h]`);
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, `crop "${name}" lies inside the frame`);
    }
    for (const [name, limit] of Object.entries(view.limits ?? {})) {
      assert.ok(Object.hasOwn(LIMITS, name), `limit "${name}" is one of tools/measure.js's LIMITS`);
      assert.ok(limit === null || (Number.isFinite(limit) && limit > 0), `limit "${name}" is a share or null (not judged)`);
    }
  });
}
