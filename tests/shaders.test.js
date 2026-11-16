import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveWgsl, wgslFiles } from '../tools/wgsl.js';
import { CLOUD_TOP, DETAIL_TILE, SHAPE_TILE } from '../src/constants.js';

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
    assert.match(code, /@(vertex|fragment) fn (vs|fs)\(/, `${name}: no entry point vs or fs`);
  }
});

test('the constants JS and WGSL share are declared once, by the pipeline (render/gpu.js), from constants.js', () => {
  for (const [name, file] of Object.entries(ENTRIES)) {
    for (const k of ['CLOUD_TOP', 'SHAPE_TILE', 'DETAIL_TILE']) assert.doesNotMatch(resolveWgsl(join(SHADERS, file)), new RegExp(`const ${k}\\b`), `${name} declares ${k}`);
  }
  assert.deepEqual([CLOUD_TOP, SHAPE_TILE, DETAIL_TILE].map(Number.isFinite), [true, true, true]);
});

test('the volume bakes write NOUT slices a pass, as render/stream.js hands them over', () => {
  for (const name of ['FS_TSV', 'FS_BAKE']) {
    const code = resolveWgsl(join(SHADERS, ENTRIES[name]));
    assert.match(code, new RegExp(`const NOUT = ${NOUT};`), `${name}: its NOUT`);
    const outputs = [...code.matchAll(/@location\((\d+)\) o\d+: f32/g)].map((m) => Number(m[1]));
    assert.deepEqual(outputs, Array.from({ length: NOUT }, (_, k) => k), `${name}: its outputs`);
  }
});
