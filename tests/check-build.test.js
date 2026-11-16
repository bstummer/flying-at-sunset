import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { blankComments, checkBuild, checkHtml, checkModules, checkOutputFiles, checkSize, checkSources, HTML_RULES } from '../tools/check-build.js';
import viteConfig from '../vite.config.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'check-build');
const read = (kind, name) => readFileSync(join(fixtures, kind, name), 'utf8');
const ids = (failures) => [...new Set(failures.map((f) => f.rule))].sort();

function tempDir(t, files) {
  const dir = mkdtempSync(join(tmpdir(), 'flying-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

// ---------------------------------------------------------------- HTML fixtures

for (const name of readdirSync(join(fixtures, 'pass'))) {
  test(`passes: ${name}`, () => {
    const { failures } = checkHtml(read('pass', name));
    assert.deepEqual(failures, []);
  });
}

// Each fail fixture is named after the one rule it must trip, and trips nothing else.
const failFixtures = readdirSync(join(fixtures, 'fail'));
for (const name of failFixtures) {
  test(`fails: ${name}`, () => {
    const { failures } = checkHtml(read('fail', name));
    assert.deepEqual(ids(failures), [name.replace(/\.html$/, '')]);
    for (const f of failures) assert.match(f.message, /line \d+, col \d+: .*>>>.+<<</);
  });
}

test('every HTML rule has a fail fixture', () => {
  const covered = failFixtures.map((n) => n.replace(/\.html$/, '')).sort();
  assert.deepEqual(covered, HTML_RULES.map((r) => r.id).sort());
});

test('allowed namespaces are counted, not failed', () => {
  const { failures, allowed } = checkHtml(read('pass', 'xml-namespaces.html'));
  assert.deepEqual(failures, []);
  assert.equal(allowed.get('http://www.w3.org/1999/xhtml'), 1);
  assert.equal(allowed.get('http://www.w3.org/2000/svg'), 1);
});

test('lookalike namespace URLs are not allowed', () => {
  const { failures } = checkHtml(read('fail', 'url.html'));
  assert.equal(failures.length, 3);
  assert.ok(failures.some((f) => f.message.includes('www.w3.org.example.net')));
  assert.ok(failures.some((f) => f.message.includes('xhtml/extra')));
});

// ---------------------------------------------------------------- build output files
// vite.config.js rejects any bundle but index.html; checkBuild applies the same rule to dist/.

test('a bundle of only index.html passes', () => {
  assert.deepEqual(checkOutputFiles(['index.html']), []);
});

test('a bundle with extra files fails', () => {
  assert.deepEqual(ids(checkOutputFiles(['index.html', 'assets/app.js'])), ['output-files']);
  assert.deepEqual(ids(checkOutputFiles(['index.html', 'style.css'])), ['output-files']);
});

test('a bundle without index.html fails', () => {
  assert.deepEqual(ids(checkOutputFiles(['main.html'])), ['output-files']);
  assert.deepEqual(ids(checkOutputFiles([])), ['output-files']);
});

test('a bundle made of index.html and src/ alone passes, and of anything else fails', () => {
  const root = 'C:/piece';
  const ours = ['C:/piece/index.html', 'C:/piece/index.html?html-proxy&inline-css&index=0.css', 'C:/piece/src/main.js', 'C:/piece/src/style.css'];
  assert.deepEqual(checkModules(ours, root), []);
  assert.deepEqual(checkModules(ours, 'C:\\piece\\'), [], 'a root with backslashes and a trailing one');
  const others = ['C:/piece/node_modules/three/build/three.module.js', '\0vite/preload-helper.js', 'C:/piece/tools/png.js', 'C:/piece/src-old/x.js', 'C:/piece/other.html', 'C:/elsewhere/src/x.js'];
  for (const id of others) {
    const failures = checkModules([...ours, id], root);
    assert.deepEqual(ids(failures), ['bundled-modules'], id);
    assert.ok(failures[0].message.includes(JSON.stringify(id)), id);
  }
});

test('the build fails on a module from outside src/', async (t) => {
  const project = (imports) =>
    tempDir(t, {
      'index.html': '<!doctype html><script type="module" src="./src/main.js"></script>\n',
      'src/main.js': `${imports}\nconsole.log(x);\n`,
      'src/inside.js': 'export const x = 1;\n',
      'outside.js': 'export const x = 2;\n',
    });
  // The piece's config, on a project of a few lines (vite.config.js's checks run on the bundle).
  const bundle = (root) => build({ configFile: false, root, logLevel: 'silent', plugins: viteConfig.plugins, build: { ...viteConfig.build, write: false } });
  await bundle(project("import { x } from './inside.js';"));
  await assert.rejects(bundle(project("import { x } from '../outside.js';")), /bundles modules from outside src\/: .*outside\.js/);
});

test('the unbuilt source template fails the HTML checks', () => {
  const template = readFileSync(join(here, '..', 'index.html'), 'utf8');
  assert.deepEqual(ids(checkHtml(template).failures), ['link-href', 'script-src']);
});

// ---------------------------------------------------------------- size budget

test('size: ok up to the budget, warn above it, fail above twice it', () => {
  assert.equal(checkSize(100, 100).level, 'ok');
  assert.equal(checkSize(101, 100).level, 'warn');
  assert.equal(checkSize(200, 100).level, 'warn');
  assert.equal(checkSize(201, 100).level, 'fail');
});

// ---------------------------------------------------------------- source lint

test('source lint flags randomness and dates anywhere in src/', (t) => {
  const dir = tempDir(t, {
    'a.js': 'export const x = Math.random();\n',
    'b.js': 'export const now = () => Date.now() + new Date().getTime();\n',
    'world/c.js': 'export const y = Math.random();\n',
  });
  assert.deepEqual(ids(checkSources(dir)), ['date', 'math-random']);
  assert.equal(checkSources(dir).filter((f) => f.rule === 'date').length, 2);
  assert.equal(checkSources(dir).filter((f) => f.rule === 'math-random').length, 2);
});

test('source lint lets the page read the clock, but not the world', (t) => {
  const dir = tempDir(t, {
    'main.js': 'export const t = () => performance.now();\n',
    'render/stream.js': 'export const t = () => performance.now();\n',
    'world/cells.js': 'export const t = () => performance.now();\n',
    'worldly.js': 'export const t = () => performance.now();\n',
  });
  const failures = checkSources(dir);
  assert.deepEqual(ids(failures), ['world-clock']);
  assert.equal(failures.length, 1);
  assert.match(failures[0].message, /src\/world\/cells\.js/);
});

test('source lint ignores comments and non-JS files', (t) => {
  const dir = tempDir(t, {
    'doc.js': '// Never call Math.random() or Date.now() here.\n/* new Date() neither */\nexport {};\n',
    'world/doc.js': '// performance.now() is the page\'s, not the world\'s\nexport {};\n',
    'style.css': '.x { content: "Math.random()"; }',
  });
  assert.deepEqual(checkSources(dir), []);
});

test('source lint sees code after comment markers inside strings and regexes', (t) => {
  // A naive stripper reads each marker as the start of a comment: up to the next `*/`, or the line's end.
  const dir = tempDir(t, {
    'path.js': "const files = './shaders/*.js';\nexport const a = Math.random();\n/* the end */\n",
    'url.js': 'const link = "see //example"; export const b = Date.now();\n',
    'world/regex.js': 'const slashes = /a\\/*b/;\nexport const c = performance.now(); // */\n',
    'template.js': "const path = `src/*`;\nimport { Vector3 } from 'three';\n/* the end */\n",
    // A template in a template's ${…}, with an apostrophe.
    'nested.js': "const label = (kind) => `${kind ? `the bird's ${kind}` : ''} wing`;\nconst files = './shaders/*.js';\nexport const d = Math.random();\n",
  });
  assert.deepEqual(ids(checkSources(dir)), ['date', 'math-random', 'own-imports', 'world-clock']);
  assert.deepEqual(checkSources(dir).filter((f) => f.rule === 'math-random').map((f) => f.message.match(/src\/(\S+)/)[1]).sort(), ['nested.js', 'path.js']);
});

test('source lint lets src/ import only its own files', (t) => {
  const dir = tempDir(t, {
    'render/ok.js': [
      "import { clamp, lerp } from '../math.js';",
      "import { WGSL_CLOUD } from '../shaders/cloud.js';",
      "import {\n  a,\n  b,\n} from './x.js';",
      "import './presets.js';",
      "export { c } from '../world/c.js';",
      "const words = ['import', 'export', 'from'];",
      "loader.import('anything'); const list = Array.from('abc');",
      `import z from "./it's.js";`,
      "// import { WebGLRenderer } from 'three';",
    ].join('\n'),
    'maths.js': "import { Vector3 } from 'three';\n",
    'namespace.js': "import * as THREE from 'three';\n",
    'addons.js': "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\n",
    'bare.js': "import 'three';\nimport fs from 'node:fs';\n",
    'reexport.js': "export * from 'three';\n",
    'tight.js': "import{WebGLRenderer}from'three';\nexport*from\"gsap\";\n",
    'dynamic.js': "export const load = () => import('three');\nexport const later = async () => await import( `three/webgpu` );\n",
    'path.js': "import { Mesh } from '../node_modules/three/build/three.module.js';\nimport { Scene } from '/node_modules/three/src/Three.js';\n",
    'world/out.js': "import { png } from '../../tools/png.js';\nimport { b } from './../../src/b.js';\n",
    'slashes.js': "import { png } from './\\..\\..\\tools/png.js';\n",
  });
  const failures = checkSources(dir);
  assert.deepEqual(ids(failures), ['own-imports']);
  assert.deepEqual(
    failures.map((f) => f.message.match(/src\/(\S+)/)[1]).sort(),
    ['addons.js', 'bare.js', 'bare.js', 'dynamic.js', 'dynamic.js', 'maths.js', 'namespace.js', 'path.js', 'path.js', 'reexport.js', 'slashes.js', 'tight.js', 'tight.js', 'world/out.js', 'world/out.js'],
  );
});

test('blankComments keeps offsets and leaves divisions alone', () => {
  const code = 'const a = b / 2; // half\nconst c = (d) / e /* ratio */ + 1;\n';
  const blanked = blankComments(code);
  assert.equal(blanked.length, code.length);
  assert.equal(blanked, 'const a = b / 2;        \nconst c = (d) / e             + 1;\n');
});

// Each case is code and the comments in it, which blankComments must blank, and
// nothing else. Most end on a trap: read one token wrong, and a quote pairs up
// with the next, and the `/*` of a path after it starts a "comment" that hides
// the rest of the file.
test('blankComments reads strings, templates, regexes and comments as JavaScript does', () => {
  const glob = "p = g('./p/*.js');";
  const cases = [
    // Templates: in a ${…}, braces, strings, comments and regexes are code's.
    [`a = \`\${k ? \`it's \${k}\` : ''} wing\`; ${glob} // c`, '// c'],
    [`a = \`\${ {b: 1}.b + \`it's\` }\`; ${glob} // c`, '// c'],
    [`a = \`\${'}'}\${"\`"}\`; ${glob} // c`, '// c'],
    ['a = `${x /* } */ + y} it\'s`; // c', '/* } */', '// c'],
    [`a = \`\${/'/.test(s)}\`; ${glob} // c`, '// c'],
    [`function f() { a = \`\${x}\`; } ${glob} // c`, '// c'],
    ['a = `\\`/* ${x}`; // c', '// c'],
    ['a = `\\${`; // c', '// c'],
    [`a = \`$5 {it's}\`; ${glob} // c`, '// c'],
    // Strings: escapes, the other quote, and a line continuation (CRLF too).
    [`a = 'it\\'s /*'; ${glob} // c`, '// c'],
    [`a = "it's"; ${glob} // c`, '// c'],
    [`a = 'x\\\r\ny'; ${glob} // c`, '// c'],
    // A stray quote ends with its line: this regex reads as a division (the heuristic's miss).
    [`if (ok) /'/.test(s);\n${glob} // c`, '// c'],
    // Comments: comment markers and quotes in them, and one that starts `/*/`.
    [`// see /*\n${glob} // c`, '// see /*', '// c'],
    [`/* don't */ ${glob} // c`, "/* don't */", '// c'],
    [`/*/ it's */ ${glob} // c`, "/*/ it's */", '// c'],
    // Regexes: a slash in a class, an escaped slash, and one at the very start.
    [`a = /[/'"]/, ${glob} // c`, '// c'],
    [`a = /\\/'/, ${glob} // c`, '// c'],
    [`/'/.test(s) && ${glob} // c`, '// c'],
    // A regex wherever a value can't end before the slash ...
    ...['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'].map((op) => [`x ${op} /'/; ${glob} // c`, '// c']),
    ...['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'new'].map((word) => [`x ${word} /'/; ${glob} // c`, '// c']),
    // ... and a division wherever one can.
    ...['b', '2', ')', ']', '`b`'].map((value) => [`x = ${value} / 2, ${glob} // c`, '// c']),
  ];
  for (const [code, ...comments] of cases) {
    const want = comments.reduce((text, comment) => text.replace(comment, comment.replace(/[^\n]/g, ' ')), code);
    assert.equal(blankComments(code), want, JSON.stringify(code));
  }
});

test('the real src/ passes the source lint', () => {
  assert.deepEqual(checkSources(join(here, '..', 'src')), []);
});

// ---------------------------------------------------------------- everything together

test('checkBuild combines every check', (t) => {
  const good = tempDir(t, { 'index.html': read('pass', 'minimal.html') });
  const src = tempDir(t, { 'ok.js': 'export {};\n' });
  const report = checkBuild({ distDir: good, srcDir: src, budget: 1024 * 1024 });
  assert.deepEqual(report.failures, []);
  assert.deepEqual(report.warnings, []);
  assert.ok(report.raw > 0 && report.gzip > 0 && report.gzip < report.raw);

  const bad = tempDir(t, { 'index.html': read('fail', 'fetch.html'), 'assets/app.js': '' });
  const badSrc = tempDir(t, { 'x.js': 'Math.random();\n' });
  const failed = checkBuild({ distDir: bad, srcDir: badSrc, budget: 10 });
  assert.deepEqual(ids(failed.failures), ['fetch', 'math-random', 'output-files', 'size']);
});
