// The URL parameters (src/core/params.js): each read as its kind, an error for what can't be read,
// and src/ reading exactly the names PARAMS has

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARAMS, parseParams } from '../src/core/params.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const names = Object.keys(PARAMS);
const flags = names.filter((n) => PARAMS[n].flag);

test('every parameter reads, each as its kind', () => {
  const p = parseParams('?test&seed=3&towers=1.5&preset=tower&pose=1,2000,3,0.4,-0.1,0.2&view=2&dbg=7&tm=0&con=1.2&haze=3e-5'
    + '&exp=16&rays=0.24&bloom=0.1&bloomw=0.5&bclamp=2000&dt=0.05&frames=12&keep=8&every=15&freeze&log&live&script=dive'
    + '&w=320&h=180&scale=0.3&closeup=0.5,0.2,-1&cpuprof');
  assert.deepEqual(p.errors, []);
  assert.deepEqual(
    { seed: p.seed, towers: p.towers, preset: p.preset, pose: p.pose, view: p.view, dbg: p.dbg, tm: p.tm, con: p.con, haze: p.haze },
    { seed: 3, towers: 1.5, preset: 'tower', pose: [1, 2000, 3, 0.4, -0.1, 0.2], view: 2, dbg: 7, tm: 0, con: 1.2, haze: 3e-5 },
  );
  assert.deepEqual(
    { exp: p.exp, rays: p.rays, bloom: p.bloom, bloomw: p.bloomw, bclamp: p.bclamp, dt: p.dt, frames: p.frames, keep: p.keep, every: p.every },
    { exp: 16, rays: 0.24, bloom: 0.1, bloomw: 0.5, bclamp: 2000, dt: 0.05, frames: 12, keep: 8, every: 15 },
  );
  assert.deepEqual({ script: p.script, w: p.w, h: p.h, scale: p.scale, closeup: p.closeup }, { script: 'dive', w: 320, h: 180, scale: 0.3, closeup: [0.5, 0.2, -1] });
  for (const flag of ['test', 'freeze', 'log', 'live', 'cpuprof']) assert.equal(p[flag], true, flag);
});

test('without parameters every value is missing (the modules keep their defaults) and every switch is off', () => {
  const p = parseParams('');
  assert.deepEqual(p.errors, []);
  for (const name of names) assert.equal(p[name], PARAMS[name].flag ? false : null, name);
  assert.deepEqual(Object.keys(p).sort(), [...names, 'errors'].sort());
});

test('a switch is on when it is there at all; a blank value is a missing one', () => {
  for (const search of ['?freeze', '?freeze=', '?freeze=0']) assert.equal(parseParams(search).freeze, true, search);
  for (const search of ['?seed=', '?seed=%20%20', '?pose=']) {
    const p = parseParams(search);
    assert.deepEqual(p.errors, [], search);
    assert.equal(p[search.slice(1).split('=')[0]], null, search);
  }
  assert.equal(parseParams('?seed=%203%20').seed, 3, 'values are trimmed');
  assert.deepEqual(parseParams('seed=3&preset=sun'), parseParams('?seed=3&preset=sun'), 'the leading ? is optional');
});

test('a value not of its kind is an error naming it, and is left out', () => {
  const bad = {
    seed: ['abc', '3.5', '1e12'], towers: ['-1', 'many'], frames: ['0', '2.5'], keep: ['0'], every: ['-3'],
    view: ['6', '1.5'], dbg: ['8'], tm: ['2'], bloomw: ['1'], dt: ['-0.1', '2'], w: ['0', '9000'], scale: ['0', '1.5'],
    pose: ['1,2', '1,,3', '1,2,3,4,5,6,7', 'a,b,c'], closeup: ['1,2', '1,2,3,4'], benchSeconds: ['0'],
  };
  for (const [name, values] of Object.entries(bad)) {
    for (const raw of values) {
      const p = parseParams(`?${name}=${encodeURIComponent(raw)}`);
      assert.equal(p[name], null, `${name}=${raw}`);
      assert.equal(p.errors.length, 1, `${name}=${raw}`);
      assert.match(p.errors[0], new RegExp(`^\\?${name}=.*: must be `), `${name}=${raw}`);
    }
  }
});

test('a name the page does not know is an error, also one every object inherits', () => {
  for (const name of ['preest', 'constructor', 'toString', 'Seed']) {
    assert.deepEqual(parseParams(`?${name}=1`).errors, [`?${name}: no such URL parameter`], name);
  }
  assert.equal(parseParams('?x=1&x=2').errors.length, 1, 'named once however often it is there');
});

test('the benchmark and the readout are off in the test mode', () => {
  assert.equal(parseParams('?bench&debug').bench, true);
  assert.equal(parseParams('?bench&debug').debug, true);
  assert.equal(parseParams('?bench&debug&test').bench, false);
  assert.equal(parseParams('?bench&debug&test').debug, false);
});

// A parameter read under a name params.js doesn't have would be undefined, and the module's
// default would stand in for it without a word; one params.js has that nothing reads does nothing.
test('src/ reads exactly the parameters params.js has', () => {
  const files = readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => join(SRC, f));
  const read = new Set();
  for (const file of files) {
    const code = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '');
    for (const [, name] of code.matchAll(/(?<![\w$./])params\.(\w+)/g)) read.add(name);   // (not './params.js')
  }
  read.delete('errors');
  assert.deepEqual([...read].filter((n) => !names.includes(n)).sort(), [], 'read but not in PARAMS');
  assert.deepEqual(names.filter((n) => !read.has(n)).sort(), [], 'in PARAMS but read nowhere');
  assert.ok(flags.includes('test') && flags.includes('bench'));
});
