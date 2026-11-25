// The bakes' scale (src/render/bakescale.js): what the world's bakes took on this GPU against what
// render/stream.js estimated for them

import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeScale } from '../src/render/bakescale.js';

test('no measurement yet: the estimate as it is', () => {
  assert.equal(bakeScale().k, 1);
});

test('a GPU that bakes three times slower: the scale comes to 3, a faster one below 1', () => {
  for (const f of [3, 0.5]) {
    const s = bakeScale();
    for (let i = 0; i < 20; i++) s.add(1.5 + (i % 3), f * (1.5 + (i % 3)));
    assert.ok(Math.abs(s.k - f) < 1e-9, `${f}: ${s.k}`);
  }
});

test('a frame that baked much weighs much; the scale follows a change within a few dozen frames', () => {
  const s = bakeScale();
  s.add(150, 300);           // the first frame: the whole world, at 2x
  for (let i = 0; i < 5; i++) s.add(2, 2);
  assert.ok(s.k > 1.7, `still near the first frame's 2x after 5 small frames: ${s.k}`);
  for (let i = 0; i < 60; i++) s.add(2, 2);
  assert.ok(Math.abs(s.k - 1) < 0.02, `near 1 after 65 frames at 1x: ${s.k}`);
});

test('bounded, and frames that measured nothing or estimated nothing are ignored', () => {
  const s = bakeScale();
  s.add(1, 1000);
  assert.equal(s.k, 16);
  s.add(0, 5); s.add(1, NaN); s.add(1, -1); s.add(1, Infinity);
  assert.equal(s.k, 16);
  const t = bakeScale();
  t.add(10, 0);
  assert.equal(t.k, 0.25);
});
