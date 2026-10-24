// Builds index.html, the one file that is published (GitHub Pages serves it from this repository):
// src/index.html with its stylesheet and all its modules inlined. The modules become one classic
// script, each after the modules it imports (the order the browser runs them in), all in one scope.
// So import and export only connect modules here: every top-level name must be unique across all
// modules, and only `import { a, b } from './x.js'`, `import './x.js'` and `export` in front of a
// declaration are allowed (no renaming, no default or namespace imports).
//
//   node build.mjs                 write index.html
//   node build.mjs --check         exit 1 if index.html is not what src/ builds to
//   node build.mjs --out f.html    write the page elsewhere (--src dir: build other sources)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.join(ROOT, 'src');
export const OUT = path.join(ROOT, 'index.html');

const IMPORT = /^import\s+(?:\{([^}]*)\}\s+from\s+)?(['"])([^'"\n]+)\2;?[ \t]*(?:\n|$)/gm;

// the code with comments, strings and the text of template literals blanked out (line structure
// kept), so declarations can be found without being fooled by what they contain
function blankText(src) {
  let out = '', i = 0, last = '';
  const n = src.length, tpl = [];   // brace depths at which template literals continue
  let depth = 0;
  const blank = s => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && (d === '/' || d === '*')) {
      const j = d === '/' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2) + 2;
      const e = j <= 1 || j < i ? n : j;
      out += blank(src.slice(i, e)); i = e; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += c + blank(src.slice(i + 1, j)) + c; i = j + 1; last = 'x'; continue;
    }
    if (c === '`' || (c === '}' && tpl.length && tpl[tpl.length - 1] === depth)) {
      if (c === '}') tpl.pop();
      let j = i + 1;
      while (j < n && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
      out += c + blank(src.slice(i + 1, j));
      if (src[j] === '`') { out += '`'; i = j + 1; last = 'x'; continue; }
      out += '${'; tpl.push(depth); i = j + 2; last = '{'; continue;
    }
    if (c === '/' && (!last || /[(,=:[!&|?{};+\-*%<>~^]/.test(last))) {   // a regular expression
      let j = i + 1, cls = false;
      while (j < n && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
      j++;
      while (j < n && /[a-z]/.test(src[j])) j++;
      out += '/' + blank(src.slice(i + 1, j - 1)) + '/'; i = j; last = 'x'; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (!/\s/.test(c)) last = c;
    out += c; i++;
  }
  return out;
}

// the names a module declares at its top level
function topLevelNames(code) {
  const s = blankText(code), names = [];
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('{[('.includes(c)) { depth++; continue; }
    if ('}])'.includes(c)) { depth--; continue; }
    if (depth || (i && /[\w$.]/.test(s[i - 1]))) continue;
    const m = /^(?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s)/.exec(s.slice(i, i + 200));
    if (!m) continue;
    if (m[1] || m[2]) { names.push(m[1] || m[2]); continue; }
    // the declarators of the statement, up to its semicolon
    let j = i + m[0].length, d = 0, part = '';
    for (; j < s.length; j++) {
      const ch = s[j];
      if ('{[('.includes(ch)) d++;
      else if ('}])'.includes(ch)) d--;
      if (d === 0 && (ch === ',' || ch === ';')) {
        const id = /^\s*([A-Za-z_$][\w$]*)/.exec(part);
        if (id) names.push(id[1]);
        part = '';
        if (ch === ';') break;
        continue;
      }
      part += ch;
    }
    i = j;
  }
  return names;
}

// the modules reachable from the entry, each after the ones it imports
export function modules(entry) {
  const order = [], seen = new Set();
  const visit = (file, from) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!fs.existsSync(file)) throw new Error(`${from}: no such module ${path.relative(ROOT, file)}`);
    const src = fs.readFileSync(file, 'utf8');
    const imports = [];
    for (const m of src.matchAll(IMPORT)) {
      if (!m[3].startsWith('.')) throw new Error(`${path.relative(ROOT, file)}: only relative imports (${m[3]})`);
      imports.push({ file: path.resolve(path.dirname(file), m[3]), names: (m[1] || '').split(',').map(s => s.trim()).filter(Boolean) });
    }
    // (the imports gone, a header comment keeps a single blank line under it)
    const code = src.replace(IMPORT, '').replace(/^((?:\/\/[^\n]*\n)*)\n{2,}/, '$1\n');
    const bad = /^(?:import\b.*|export\s+(?!(?:const|let|var|function|async\s+function|class)\b).*)$/m.exec(blankText(code));
    if (bad) throw new Error(`${path.relative(ROOT, file)}: unsupported import or export: ${bad[0].trim()}`);
    for (const im of imports) visit(im.file, path.relative(ROOT, file));
    order.push({ file, imports, code: code.replace(/^export\s+/gm, '') });
  };
  visit(path.resolve(entry), 'build');
  // one scope: no name may be declared twice; and what is imported must be declared there
  const owner = new Map();
  for (const m of order) {
    m.names = new Set(topLevelNames(m.code));
    for (const n of m.names) {
      if (owner.has(n)) throw new Error(`"${n}" is declared in both ${path.relative(ROOT, owner.get(n))} and ${path.relative(ROOT, m.file)}`);
      owner.set(n, m.file);
    }
  }
  const byFile = new Map(order.map(m => [m.file, m]));
  for (const m of order) for (const im of m.imports) for (const n of im.names) {
    if (/\s/.test(n)) throw new Error(`${path.relative(ROOT, m.file)}: no renaming in imports (${n})`);
    if (!byFile.get(im.file).names.has(n)) throw new Error(`${path.relative(ROOT, m.file)}: ${path.relative(ROOT, im.file)} declares no "${n}"`);
  }
  return order;
}

export function build(src = SRC) {
  const page = path.join(src, 'index.html');
  let html = fs.readFileSync(page, 'utf8');
  html = html.replace(/^<link rel="stylesheet" href="([^"]+)">$/m, (_, f) => {
    const css = fs.readFileSync(path.join(src, f), 'utf8').replace(/\n+$/, '');
    return '<style>\n' + css.split('\n').map(l => l ? '  ' + l : l).join('\n') + '\n</style>';
  });
  html = html.replace(/^<script type="module" src="([^"]+)"><\/script>$/m, (_, f) => {
    const mods = modules(path.join(src, f));
    const body = mods.map(m => `// ======== ${path.relative(path.dirname(src), m.file).split(path.sep).join('/')}\n` + m.code.replace(/^\n+|\n+$/g, '') + '\n').join('\n');
    return `<script>\n(() => {\n'use strict';\n\n${body}})();\n</script>`;
  });
  if (/<script type="module"|<link rel="stylesheet"/.test(html)) throw new Error('src/index.html: unexpected <script type="module"> or <link rel="stylesheet">');
  return html;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  try {
    const out = arg('--out') ? path.resolve(arg('--out')) : OUT;
    const html = build(arg('--src') ? path.resolve(arg('--src')) : SRC);
    if (process.argv.includes('--check')) {
      const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
      if (cur !== html) { console.error(`${path.relative(process.cwd(), out) || out} is not built from the current sources: run node build.mjs`); process.exit(1); }
      console.log(`${path.relative(process.cwd(), out)} is up to date`);
    } else {
      fs.writeFileSync(out, html);
      console.log(`${path.relative(process.cwd(), out)}: ${(html.length / 1024).toFixed(0)} KB`);
    }
  } catch (e) {
    console.error('build failed: ' + e.message);
    process.exit(1);
  }
}
