// WGSL includes: `#include "path.wgsl"` lines at the top of a .wgsl file put that file (relative to
// the including one) in front of it, each file at most once per shader, in the order first reached.
// Line endings are read as LF, so a Windows checkout (core.autocrlf) builds the same strings as
// CI's. Used by vite.config.js and the tests.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const INCLUDES = /^(?:#include "[^"]+"[ \t]*\n)*/;

// a file's own text (without its includes) and the files it includes, in order
function parse(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const head = INCLUDES.exec(text)[0];
  const includes = [...head.matchAll(/#include "([^"]+)"/g)].map((m) => resolve(dirname(file), m[1]));
  return { own: text.slice(head.length), includes };
}

// every file a shader is made of, in order (itself last)
export function wgslFiles(file, out = []) {
  file = resolve(file);
  if (out.includes(file)) return out;
  for (const inc of parse(file).includes) wgslFiles(inc, out);
  if (!out.includes(file)) out.push(file);
  return out;
}

// the whole text of a shader
export const resolveWgsl = (file) => wgslFiles(file).map((f) => parse(f).own).join('');

// The Vite plugin: a .wgsl module exports `own` (its text) and `default` (the whole shader). The
// default concatenates the `own` exports of what it includes, so each chunk is in the bundle once.
export function wgslPlugin() {
  return {
    name: 'wgsl-includes',
    enforce: 'pre',
    load(id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.wgsl')) return null;
      const parts = wgslFiles(file).slice(0, -1);
      for (const p of parse(file).includes) this.addWatchFile(p);
      const imports = parts.map((p, k) => `import { own as c${k} } from ${JSON.stringify(p.replaceAll('\\', '/'))};\n`).join('');
      const own = parse(file).own;
      return { code: `${imports}export const own = ${JSON.stringify(own)};\nexport default ${[...parts.map((_, k) => `c${k}`), 'own'].join(' + ')};\n`, map: null };
    },
  };
}
