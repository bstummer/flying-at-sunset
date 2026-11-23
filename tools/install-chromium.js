// npm install's postinstall: the Chromium build the tools run (tools/browser.js, CHROMIUM: on Windows
// the full build, for its DXC; elsewhere the headless shell), through Playwright's CLI.
import { spawnSync } from 'node:child_process';
import { CHROMIUM } from './browser.js';

// (one command line: npx is a script on Windows, which only a shell runs)
process.exitCode = spawnSync(CHROMIUM.install, { stdio: 'inherit', shell: true }).status ?? 1;
