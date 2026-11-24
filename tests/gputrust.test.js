// Whether the GPU's timestamps may steer the resolution (src/render/gputrust.js)

import test from 'node:test';
import assert from 'node:assert/strict';
import { mean, median, timestampTrust } from '../src/render/gputrust.js';

test('a GPU busy for less than the time between frames, or a GPU that holds the frames back: trusted', () => {
  const t = timestampTrust();
  for (let i = 0; i < 50; i++) t.add(12.3, 16.7);     // headroom at 60 Hz
  for (let i = 0; i < 50; i++) t.add(30, 33.3);       // the GPU sets the pace, frames quantized by the display
  for (let i = 0; i < 50; i++) t.add(17.5, 16.7);     // a GPU-bound frame a little over (the medians' noise)
  assert.equal(t.trusted, true);
  assert.equal(t.seen, null);
});

test('timestamps that say more than the frames allow, a while after another: distrusted for good', () => {
  const t = timestampTrust();
  t.add(38, 16.6);
  assert.equal(t.trusted, true, 'one while is not enough');
  t.add(12, 16.6);
  t.add(38, 16.6);
  assert.equal(t.trusted, true, 'a while in between starts the count again');
  assert.equal(t.add(44, 16.6), false);
  assert.deepEqual(t.seen, { gpu: 44, frame: 16.6 });
  t.add(5, 16.6);
  assert.equal(t.trusted, false, 'for good');
});

test('whiles without numbers count for nothing', () => {
  const t = timestampTrust();
  for (let i = 0; i < 10; i++) { t.add(40, NaN); t.add(0, 16.6); t.add(NaN, 16.6); }
  assert.equal(t.trusted, true);
});

test('the phone of leg 12: its spans held to the mean time between its frames, trusted', () => {
  // (frames in bursts: the median between them 16.7 ms, the mean 22–43 ms; the spans 20–42 ms)
  const t = timestampTrust();
  for (const [span, frames] of [[40.0, 40.6], [27.3, 28.0], [20.1, 22.2], [20.8, 22.9], [41.9, 42.7], [38.2, 39.8]]) t.add(span, frames);
  assert.equal(t.trusted, true);
});

test('median and mean', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 3);
  assert.ok(Number.isNaN(median([])));
  assert.equal(mean([16, 16, 68, 16]), 29);
  assert.ok(Number.isNaN(mean([])));
});
