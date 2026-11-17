// The readout (?debug, not in the test mode): frame rate, the canvas's and the clouds' resolution,
// GPU times per pass, altitude, speed, the sea's top and the world's jobs, every 30 frames

import { params } from './params.js';
import { R } from '../render/targets.js';
import { bakeQueue, worldStats } from '../render/stream.js';
import { gpuTimer } from '../render/timing.js';
import { seaTopAt } from '../world/queries.js';
import { bird_ } from '../flight/flight.js';

const el = params.debug ? document.createElement('div') : null;
if (el) { el.id = 'stats'; document.body.appendChild(el); }
let ms = 0, frames = 0;

// once a frame (main.js), with the time since the last one
export function updateReadout(dtMs) {
  if (!el) return;
  ms += dtMs; frames++;
  if (frames < 30) return;
  const fps = 1000 / (ms / frames);
  ms = 0; frames = 0;
  const g = gpuTimer ? Object.entries(gpuTimer.ms).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  ') + `  = ${gpuTimer.total().toFixed(2)} ms` : 'no gpu timer';
  el.textContent = `${fps.toFixed(1)} fps  ${R.w}x${R.h}  clouds ${R.lowW}x${R.lowH} (${R.scale.toFixed(2)})\n${g}\nalt ${bird_.pos[1].toFixed(0)} m  speed ${bird_.speed.toFixed(0)} m/s  sea ${seaTopAt(bird_.pos[0], bird_.pos[2]).toFixed(0)}  world jobs ${worldStats.jobs} queued ${bakeQueue.length}`;
}
