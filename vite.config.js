import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { checkModules, checkOutputFiles } from './tools/check-build.js';
import { wgslPlugin } from './tools/wgsl.js';

// The commit the piece is built from, shown in the benchmark's summary (src/benchmark.js), so
// numbers from other machines name their build.
function buildId() {
  const git = (...args) => execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    return `${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain') ? '-dirty' : ''}`;
  } catch {
    return 'unknown';
  }
}

// The build must emit index.html and nothing else, made of index.html and
// src/ alone (no module from a package). Runs after vite-plugin-singlefile has
// dropped the inlined chunks, and fails the build before anything is written.
function singleFileOutput() {
  let root = '';
  return {
    name: 'single-file-output',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const failures = [...checkOutputFiles(Object.keys(bundle)), ...checkModules([...this.getModuleIds()], root)];
        if (failures.length) this.error(failures.map((f) => f.message).join('\n'));
      },
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false, // dist/ holds index.html only
  define: { __BUILD__: JSON.stringify(buildId()) },
  plugins: [wgslPlugin(), viteSingleFile({ removeViteModuleLoader: true }), singleFileOutput()],
  build: {
    // render/gpu.js waits for the GPU device at its top level.
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    sourcemap: false,
    // The modulepreload polyfill uses fetch(); a single inline file never preloads anything.
    modulePreload: { polyfill: false },
    // tools/check-build.js reports raw and gzip size against the budget instead.
    reportCompressedSize: false,
    chunkSizeWarningLimit: 8192,
  },
});
