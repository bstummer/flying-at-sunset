// The repo's layout: only tests/ holds files node --test runs, and no tool reaches itself through
// its imports (its main's top-level await would wait for itself)

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// npm test runs `node --test`, which runs every file matching Node's default
// test patterns anywhere outside node_modules: *.test.js, *-test.js,
// *_test.js, test-*.js, test.js, and any .js under a folder named test; .cjs
// and .mjs too, and .ts, .cts and .mts where Node strips types (by default
// since 22.18), and on Windows whatever the case. A module named like one
// (src/plants/alpha-test.js) would run as a test.
const RUNS_AS_TEST = /(^|\/)(test|test-[^/]*|[^/]*[._-]test)\.[cm]?[jt]s$|(^|\/)test\/.*\.[cm]?[jt]s$/i;

// Files under root that node --test would run, but those in the top-level
// tests/, where they belong (node --test leaves out node_modules, and .git has none).
function misnamed(root, dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = relative(root, join(dir, entry.name)).replaceAll('\\', '/');
    if (!entry.isDirectory()) return RUNS_AS_TEST.test(path) ? [path] : [];
    return entry.name === 'node_modules' || entry.name === '.git' || path === 'tests' ? [] : misnamed(root, join(dir, entry.name));
  });
}

test('only tests/ holds files that node --test runs', () => {
  assert.deepEqual(misnamed(ROOT), []);
});

test('the pattern matches what node --test runs, and not other names', () => {
  const runs = ['a.test.js', 'src/plants/alpha-test.js', 'b_test.mjs', 'test-c.js', 'tools/test.js', 'src/test/d.js', 'src/tests/e.test.cjs'];
  for (const name of [...runs, 'f.test.ts', 'g-test.mts', 'h_test.cts', 'test-i.ts', 'test.ts', 'src/test/j.ts', 'src/Test.js', 'k.TEST.js']) {
    assert.match(name, RUNS_AS_TEST, name);
  }
  for (const name of ['src/contest.js', 'tools/testing.js', 'src/latest.js', 'tools/check-build.js', 'src/tested/x.wgsl', 'src/tests/x.js', 'a.spec.js', 'b.test.jsx', 'c.test.tsx', 'types.d.ts']) {
    assert.doesNotMatch(name, RUNS_AS_TEST, name);
  }
});

test('misnamed files are found in any folder but the top-level tests/ and node_modules', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'flying-layout-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const names = ['tests/a.test.js', 'tests/deep/b.test.js', 'src/tests/c.test.js', 'src/plants/tests/d-test.ts', 'tools/test/e.js'];
  for (const name of [...names, 'node_modules/f.test.js', 'src/node_modules/g.test.js', '.git/h.test.js', 'src/i.js']) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), '');
  }
  assert.deepEqual(misnamed(root).sort(), ['src/plants/tests/d-test.ts', 'src/tests/c.test.js', 'tools/test/e.js']);
});

// The tools run their main code under a top-level await (`process.exitCode = await main()`):
// until it ends, the module hasn't finished loading, and a module that imports it waits for it.
// A tool that reaches itself again through its imports, static or dynamic, would wait for
// itself and hang without a word (as `npm run verify` once did: screenshot.js imported
// checks.js, which imported flights.js, which imported screenshot.js).
const IMPORTS = /\bfrom\s*['"](\.{1,2}\/[^'"]+\.js)['"]|\bimport\s*\(?\s*['"](\.{1,2}\/[^'"]+\.js)['"]/g;

// A chain of relative imports from `entry` back to it (its files relative to `root`), or null.
function cycleThrough(entry, root = ROOT) {
  const seen = new Set();
  const walk = (file, chain) => {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(IMPORTS)) {
      const next = resolve(dirname(file), m[1] ?? m[2]);
      if (next === entry) return [...chain, next].map((f) => relative(root, f).replaceAll('\\', '/'));
      if (seen.has(next) || !existsSync(next)) continue;
      seen.add(next);
      const found = walk(next, [...chain, next]);
      if (found) return found;
    }
    return null;
  };
  return walk(entry, [entry]);
}

const toolsWithMain = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const path = join(dir, e.name);
  if (e.isDirectory()) return toolsWithMain(path);
  return e.name.endsWith('.js') && /\binvokedPath ===/.test(readFileSync(path, 'utf8')) ? [path] : [];
});

test("no tool reaches itself through its imports (its main's await would wait for itself)", () => {
  const tools = toolsWithMain(join(ROOT, 'tools'));
  assert.ok(tools.length >= 5, `${tools.length} tools with a main`);
  for (const tool of tools) assert.equal(cycleThrough(tool), null, relative(ROOT, tool));
});

test('a cycle through dynamic and static imports is found, and only a cycle', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'flying-imports-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, text) => writeFileSync(join(root, name), text);
  write('a.js', "import { x } from './b.js';\nconst c = await import('./c.js');\n");
  write('b.js', "export const x = 1;\n");
  write('c.js', "import './d.js';\n");
  write('d.js', "export { x } from './b.js';\n");
  assert.equal(cycleThrough(join(root, 'a.js'), root), null);
  write('d.js', "import { x } from './a.js';\n");
  assert.deepEqual(cycleThrough(join(root, 'a.js'), root), ['a.js', 'c.js', 'd.js', 'a.js']);
});
