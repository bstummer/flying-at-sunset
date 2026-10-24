// The page: its elements, the note shown when something fails, the kind of pointer

import { TEST } from './params.js';

if (TEST) document.documentElement.classList.add('test');

export const canvas = document.getElementById('view');
export const hintEl = document.getElementById('hint');
const noteEl = document.getElementById('note');
export const touchEl = document.getElementById('touch');

export const COARSE = matchMedia('(pointer: coarse)').matches;   // primary pointer is a finger

export function fail(msg) {
  noteEl.style.display = 'flex';
  noteEl.textContent = msg;
  window.__error = msg;
  console.error(msg);
}
