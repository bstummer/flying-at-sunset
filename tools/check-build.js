// Checks that dist/ is one self-contained index.html, loading nothing from anywhere (no script src,
// link href, fetch, XHR, WebSocket ...; URLs only as XML namespaces), within the size budget (a
// warning above it, a failure above twice it), and lints src/: no Math.random or Date anywhere, no
// performance.now in world/, no import from outside src/ (comments don't count).
//   node tools/check-build.js   (npm run check; exits non-zero on any failure)
// The checks are exported for tests/check-build.test.js; vite.config.js runs checkOutputFiles() and
// checkModules() on the bundle, failing a build that would emit more than index.html or bundle a
// module from outside src/.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Raw size of dist/index.html: warn above it, fail above twice it. The piece is
// code alone; this catches something big inlined by mistake.
export const SIZE_BUDGET_BYTES = 256 * 1024;

// Exact URLs pages embed as identifiers, never fetched (XML namespaces: the
// cursor in src/style.css is an inline SVG).
export const URL_ALLOWLIST = new Set([
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
  'http://www.w3.org/2000/xmlns/',
]);

export const HTML_RULES = [
  { id: 'script-src', name: '<script src>', re: /<script\b[^>]*\bsrc\s*=/gi },
  { id: 'link-href', name: '<link href>', re: /<link\b[^>]*\bhref\s*=/gi },
  { id: 'url', name: 'http(s) URL', re: /https?:\/\/[^\s"'`<>)\\]*/gi, allow: (m) => URL_ALLOWLIST.has(m) },
  { id: 'fetch', name: 'fetch()', re: /\bfetch\s*\(/g },
  { id: 'xhr', name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/g },
  { id: 'websocket', name: 'WebSocket', re: /\bWebSocket\b/g },
  { id: 'eventsource', name: 'EventSource', re: /\bEventSource\b/g },
  { id: 'sendbeacon', name: 'sendBeacon', re: /\bsendBeacon\b/g },
  { id: 'importscripts', name: 'importScripts', re: /\bimportScripts\b/g },
  // A single-file build has nothing to import at runtime; any import() could load a URL.
  { id: 'dynamic-import', name: 'dynamic import()', re: /(?<![\w$.])import\s*\(/g },
];

const SCRIPTS = /\.(js|mjs|cjs|jsx|ts|tsx|mts|cts)$/; // what Vite compiles

// The world is a function of position and the seed (CLAUDE.md §2): no
// randomness but its hashes anywhere, and no clock in the world generator.
// And no imports from outside src/: the piece has no runtime dependencies.
export const SOURCE_RULES = [
  { id: 'math-random', name: 'Math.random', files: SCRIPTS, re: /\bMath\.random\b/g, hint: 'draw from the world\'s hashes and streams (world/noise.js, mulberry32)' },
  { id: 'date', name: 'Date.now / new Date()', files: SCRIPTS, re: /\bDate\.now\b|\bnew\s+Date\b/g, hint: 'the frame clock comes from requestAnimationFrame' },
  { id: 'world-clock', name: 'performance.now in the world', files: SCRIPTS, only: 'world/', re: /\bperformance\.now\b/g, hint: 'the world is a function of position and the seed, not of time' },
  // Every module a file names is matched: whatever comes before `from '...'` (so
  // no import or export clause can hide one), `import '...'` and `import('...')`;
  // an `import` or `from` after a dot or a quote is a method or a word, not one.
  // A module passes only by a relative path, with forward slashes, to files in
  // src/. A regex reads text, not JavaScript, so contrived code gets past it: the
  // build's checkModules() is the guarantee, this the early warning with a file
  // and a line.
  {
    id: 'own-imports',
    name: 'an import from outside src/',
    files: SCRIPTS,
    re: /(?<![.'"`\w$])from\s*(?<q1>['"])(?<from>(?:(?!\k<q1>)[^\n])*)\k<q1>|(?<![.'"`\w$])import\s*(?:\(\s*)?(?<q2>['"`])(?<bare>(?:(?!\k<q2>)[^\n])*)\k<q2>/g,
    allow: ({ groups: { from, bare } }, path) => insideSrc(from ?? bare, path),
    hint: 'import only src/ files, by relative path: the piece has no dependencies',
  },
];

// Whether `specifier`, imported by src/`path`, is a file in src/.
function insideSrc(specifier, path) {
  if (!/^\.\.?\//.test(specifier) || specifier.includes('\\')) return false;
  return !posix.normalize(posix.join(posix.dirname(path), specifier)).startsWith('../');
}

// Content rules for the built HTML.
// Returns { failures: [{ rule, message }], allowed: Map<url, count> }.
export function checkHtml(html) {
  const failures = [];
  const allowed = new Map();
  for (const rule of HTML_RULES) {
    for (const match of html.matchAll(rule.re)) {
      if (rule.allow?.(match[0])) {
        allowed.set(match[0], (allowed.get(match[0]) ?? 0) + 1);
        continue;
      }
      const message = `${rule.name} at ${position(html, match.index)}: ${context(html, match.index, match[0].length)}`;
      failures.push({ rule: rule.id, message });
    }
  }
  return { failures, allowed };
}

// The build must emit exactly one file: index.html. Used on the bundle (vite.config.js)
// and on the dist/ listing (checkBuild).
export function checkOutputFiles(fileNames) {
  if (fileNames.length === 1 && fileNames[0] === 'index.html') return [];
  return [{ rule: 'output-files', message: `the build must emit exactly one file (index.html), got: ${fileNames.join(', ') || 'nothing'}` }];
}

// Every module the build bundles (ids as the bundler gives them, under the
// project's `root`) is index.html or a file in src/: no runtime dependencies,
// however a module got in. The source lint (own-imports) says so early, from
// the text; this is the bundler's own answer. Used on the bundle (vite.config.js).
export function checkModules(ids, root) {
  const base = root.replaceAll('\\', '/').replace(/\/$/, '');
  const ours = (id) => {
    const path = id.split('?')[0].replaceAll('\\', '/');
    return path === `${base}/index.html` || path.startsWith(`${base}/src/`);
  };
  const outside = ids.filter((id) => !ours(id));
  if (!outside.length) return [];
  return [{ rule: 'bundled-modules', message: `the build bundles modules from outside src/: ${outside.map((id) => JSON.stringify(id)).join(', ')}` }];
}

// Raw size against the budget: warn above it, fail above twice it.
export function checkSize(bytes, budget) {
  if (bytes > 2 * budget) return { level: 'fail', message: `size ${kb(bytes)} exceeds twice the budget (${kb(2 * budget)})` };
  if (bytes > budget) return { level: 'warn', message: `size ${kb(bytes)} exceeds the budget (${kb(budget)})` };
  return { level: 'ok', message: '' };
}

// Source lint (SOURCE_RULES) over every script under srcDir (the extensions
// Vite would compile). Comments are ignored, so they may name what is forbidden.
export function checkSources(srcDir) {
  const failures = [];
  for (const name of readdirSync(srcDir, { recursive: true })) {
    const path = relative(srcDir, join(srcDir, name)).replaceAll('\\', '/');
    const rules = SOURCE_RULES.filter((rule) => rule.files.test(name) && (!rule.only || path.startsWith(rule.only)));
    if (!rules.length) continue;
    const code = blankComments(readFileSync(join(srcDir, name), 'utf8'));
    for (const rule of rules) {
      for (const match of code.matchAll(rule.re)) {
        if (rule.allow?.(match, path)) continue;
        failures.push({ rule: rule.id, message: `${rule.name} in src/${path} (${position(code, match.index)}); ${rule.hint}` });
      }
    }
  }
  return failures;
}

// JS source with every comment blanked out, keeping line and column offsets.
// Strings, template literals and regex literals are skipped, so a `/*` or `//`
// inside one doesn't hide the code after it. The code in a template's `${…}` is
// read as code, templates in it too. A `/` starts a regex where a value can't
// end before it, the usual heuristic.
export function blankComments(code) {
  const out = code.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  const braces = []; // per `${` still open, the braces opened in it and not yet closed
  let last = ''; // the last significant character of code, to tell a regex from a division
  for (let i = 0; i < code.length; ) {
    const c = code[i];
    const next = code[i + 1];
    if (c === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      blank(i, end === -1 ? code.length : end);
      i = end === -1 ? code.length : end;
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      blank(i, end === -1 ? code.length : end + 2);
      i = end === -1 ? code.length : end + 2;
    } else if (c === '"' || c === "'") {
      i = skipQuoted(code, i, c);
      last = c;
    } else if (c === '`' || (c === '}' && braces.at(-1) === 0)) {
      // A template literal, or the rest of one after a `${…}`.
      if (c === '}') braces.pop();
      i = skipTemplate(code, i);
      if (code.startsWith('${', i - 2)) braces.push(0);
      last = code[i - 1]; // a regex may start a `${…}`, not follow a template
    } else if (c === '/' && (last === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(last) || /\b(return|typeof|case|in|of|delete|void|new)\s*$/.test(code.slice(Math.max(0, i - 8), i)))) {
      i = skipRegex(code, i);
      last = '/';
    } else {
      if (c === '{' && braces.length) braces[braces.length - 1]++;
      if (c === '}' && braces.length) braces[braces.length - 1]--;
      if (!/\s/.test(c)) last = c;
      i++;
    }
  }
  return out.join('');
}

// Index just past the string opened by `quote` at i, which ends with its line
// at the latest (as JavaScript's do): a quote misread can't swallow the file.
function skipQuoted(code, i, quote) {
  for (i++; i < code.length && code[i] !== quote && code[i] !== '\n'; i++) {
    if (code[i] === '\\') i += code.startsWith('\r\n', i + 1) ? 2 : 1; // a line continuation is one escape, CRLF too
  }
  return i + 1;
}

// Index just past the part of a template literal from i (its opening backtick,
// or the `}` that closes a `${…}` in it) to its closing backtick or next `${`.
function skipTemplate(code, i) {
  for (i++; i < code.length; i++) {
    if (code[i] === '\\') i++;
    else if (code[i] === '`') return i + 1;
    else if (code[i] === '$' && code[i + 1] === '{') return i + 2;
  }
  return i;
}

// Index just past the regex literal starting at i (its flags included).
function skipRegex(code, i) {
  let inClass = false;
  for (i++; i < code.length && code[i] !== '\n'; i++) {
    if (code[i] === '\\') i++;
    else if (code[i] === '[') inClass = true;
    else if (code[i] === ']') inClass = false;
    else if (code[i] === '/' && !inClass) break;
  }
  for (i++; /\w/.test(code[i] ?? ''); i++);
  return i;
}

// Runs every check on a build directory. distDir/index.html must exist.
export function checkBuild({ distDir, srcDir, budget }) {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const { failures: htmlFailures, allowed } = checkHtml(html);
  const raw = Buffer.byteLength(html);
  const gzip = gzipSync(html, { level: 9 }).length;
  const size = checkSize(raw, budget);
  const distFiles = readdirSync(distDir, { recursive: true }).map((f) => f.replaceAll('\\', '/'));
  const failures = [...checkOutputFiles(distFiles), ...htmlFailures, ...checkSources(srcDir)];
  if (size.level === 'fail') failures.push({ rule: 'size', message: size.message });
  const warnings = size.level === 'warn' ? [size.message] : [];
  return { failures, warnings, allowed, raw, gzip };
}

function position(text, index) {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  return `line ${line}, col ${index - before.lastIndexOf('\n')}`;
}

function context(text, index, length, radius = 60) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const show = (s) => s.replace(/\s+/g, ' ');
  return `…${show(text.slice(start, index))}>>>${text.slice(index, index + length)}<<<${show(text.slice(index + length, end))}…`;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ---------------------------------------------------------------- CLI

function main() {
  const distDir = join(ROOT, 'dist');
  if (!existsSync(join(distDir, 'index.html'))) {
    console.error('check-build: dist/index.html not found. Run `npm run build` first.');
    return 1;
  }
  const budget = SIZE_BUDGET_BYTES;
  const { failures, warnings, allowed, raw, gzip } = checkBuild({ distDir, srcDir: join(ROOT, 'src'), budget });

  console.log('check-build: dist/index.html');
  console.log(`  size        ${kb(raw)} raw, ${kb(gzip)} gzip (budget ${kb(budget)} raw)`);
  for (const [url, count] of allowed) console.log(`  allowed     ${url} (x${count})`);
  for (const w of warnings) console.log(`  WARN        ${w}`);
  for (const f of failures) console.log(`  FAIL        ${f.message}`);
  console.log(failures.length ? `check-build: FAILED (${failures.length})` : 'check-build: OK');
  return failures.length ? 1 : 0;
}

// Run only when executed directly, not when imported by tests.
const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync.native(process.argv[1]) : null;
if (invokedPath === realpathSync.native(fileURLToPath(import.meta.url))) process.exitCode = main();
