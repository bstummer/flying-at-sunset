// The probe read back: after the probe pass (shaders/probe.js) its buffer is copied out and read
// once the GPU is done, one copy at a time, so the flight and the camera get it a frame or two late:
// probeData (the extinction at the camera and at the bird, the distance to the cloud at the bird,
// the sea's top there, the distance to the sea's billows below it) and inCloud (smoothed: how deep
// the camera is in cloud). In the test mode each frame waits for it (main.js), as if the GPU were
// always that quick.

import { TEST } from '../core/params.js';
import { damp, sat } from '../math.js';
import { device, enc } from './gpu.js';
import { T } from './setup.js';

export let probeData = null; // async readback: [sigmaCam, sigmaBird, sdfBird, seaTop, sdfSeaOnlyBird]
export let inCloud = 0;      // smoothed: is the camera inside cloud?
const probeBuf = device.createBuffer({ label: 'probe', size: T.probe.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
const MEDIUM = 12, FLOOR_D = 20;   // (float offsets of the fields read)
let probeState = 0;          // 0 idle, 1 copy encoded (mapped after the submit), 2 mapping
let probeNext = null;
// (tests wait for each readback before the next frame)
export const probeBusy = () => probeState !== 0;

// after the probe pass: copy it out, unless the last copy is still being read
export function readProbeAsync() {
  if (TEST && probeNext) probeData = probeNext;   // tests: as if the GPU were always done by the next frame
  if (probeState) return;
  enc().copyBufferToBuffer(T.probe.buf, 0, probeBuf, 0, T.probe.size);
  probeState = 1;
}
// after the frame is submitted: read the copy when the GPU is done with it
export function mapProbe() {
  if (probeState !== 1) return;
  probeState = 2;
  probeBuf.mapAsync(GPUMapMode.READ).then(() => {
    const b = new Float32Array(probeBuf.getMappedRange());
    const d = [b[MEDIUM], b[MEDIUM + 1], b[MEDIUM + 2], b[MEDIUM + 3], b[FLOOR_D]];
    probeBuf.unmap();
    if (TEST) probeNext = d; else probeData = d;
    probeState = 0;
  }, () => { probeState = 0; });
}

export function updateInCloud(dt) {
  inCloud = damp(inCloud, probeData ? sat(probeData[0] / 0.012) : 0, 3.0, dt);
}
