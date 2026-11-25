// The shaders' files (src/shaders/, tools/wgsl.js): includes, entry points, the constants JS and
// WGSL share, the bake's NOUT

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveWgsl, wgslFiles } from '../tools/wgsl.js';
import { FOR_SHADERS } from '../src/constants.js';

const SHADERS = join(import.meta.dirname, '..', 'src', 'shaders');
// (the shader modules import .wgsl files, which only Vite resolves: read, not imported)
const NOUT = Number(/export const NOUT = (\d+);/.exec(readFileSync(join(SHADERS, 'volumes.js'), 'utf8'))[1]);
// the .wgsl files the shader modules export, by name: { FS_TRACE: 'trace.wgsl', ... }
const ENTRIES = Object.fromEntries(readdirSync(SHADERS).filter((f) => f.endsWith('.js')).flatMap((f) =>
  [...readFileSync(join(SHADERS, f), 'utf8').matchAll(/export \{ default as (\w+) \} from '\.\/([\w-]+\.wgsl)';/g)].map((m) => [m[1], m[2]])));

test('includes: each file once, in the order first reached, its includes before it; CRLF read as LF', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'flying-wgsl-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'a.wgsl'), '// a\r\n');
  writeFileSync(join(dir, 'b.wgsl'), '#include "a.wgsl"\n// b\n');
  writeFileSync(join(dir, 'main.wgsl'), '#include "b.wgsl"\r\n#include "a.wgsl"\n// main\n');
  assert.equal(resolveWgsl(join(dir, 'main.wgsl')), '// a\n// b\n// main\n');
  assert.deepEqual(wgslFiles(join(dir, 'main.wgsl')).map((f) => f.slice(dir.length + 1)), ['a.wgsl', 'b.wgsl', 'main.wgsl']);
});

test('every shader the modules export is a .wgsl file whose includes resolve', () => {
  assert.ok(Object.keys(ENTRIES).length >= 20, `found ${Object.keys(ENTRIES).length} shaders`);
  for (const [name, file] of Object.entries(ENTRIES)) {
    const code = resolveWgsl(join(SHADERS, file));
    assert.doesNotMatch(code, /#include/, `${name}: an #include below the top of a file is left as it is`);
    assert.match(code, /@(vertex|fragment|compute @workgroup_size\([^)]*\)) fn (vs|fs|cs)\(/, `${name}: no entry point vs, fs or cs`);
  }
});

test('the constants JS and WGSL share are declared once, by the pipeline (render/gpu.js), from constants.js', () => {
  for (const [name, file] of Object.entries(ENTRIES)) {
    for (const k of Object.keys(FOR_SHADERS)) assert.doesNotMatch(resolveWgsl(join(SHADERS, file)), new RegExp(`const ${k}\\b`), `${name} declares ${k}`);
  }
  for (const [k, v] of Object.entries(FOR_SHADERS)) assert.ok([v].flat().every(Number.isFinite) && [1, 3, 9].includes([v].flat().length), `${k}: a number, a 3-vector or a 3x3`);
});

test('the volume bake writes NOUT slices a pass, as render/stream.js hands them over', () => {
  for (const name of ['FS_BAKE']) {
    const code = resolveWgsl(join(SHADERS, ENTRIES[name]));
    assert.match(code, new RegExp(`const NOUT = ${NOUT};`), `${name}: its NOUT`);
    const outputs = [...code.matchAll(/@location\((\d+)\) o\d+: f32/g)].map((m) => Number(m[1]));
    assert.deepEqual(outputs, Array.from({ length: NOUT }, (_, k) => k), `${name}: its distance outputs`);
    const scales = [...code.matchAll(/@location\((\d+)\) b\d+: vec2f/g)].map((m) => Number(m[1]));
    assert.deepEqual(scales, Array.from({ length: NOUT }, (_, k) => NOUT + k), `${name}: its billow-scale outputs`);
  }
});
