// The probe: light and cloud at the bird and around the camera, read back from the GPU

import { TEST } from '../params.js';
import { damp, sat } from '../math.js';
import { device, enc } from './gpu.js';
import { T } from './setup.js';

export let probeData = null; // async readback: [sigmaCam, sigmaBird, sdfBird, seaTop, sdfSeaOnlyBird]
export let inCloud = 0;      // smoothed: is the camera inside cloud?
const probeBuf = device.createBuffer({ label: 'probe', size: 8 * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
let probeState = 0;          // 0 idle, 1 copy encoded (mapped after the submit), 2 mapping
let probeNext = null;
// (tests wait for each readback before the next frame)
export const probeBusy = () => probeState !== 0;

// after the probe pass: copy it out, unless the last copy is still being read
export function readProbeAsync() {
  if (TEST && probeNext) probeData = probeNext;   // tests: as if the GPU were always done by the next frame
  if (probeState) return;
  enc().copyTextureToBuffer({ texture: T.probe.tex }, { buffer: probeBuf }, [8, 1]);
  probeState = 1;
}
// after the frame is submitted: read the copy when the GPU is done with it
export function mapProbe() {
  if (probeState !== 1) return;
  probeState = 2;
  probeBuf.mapAsync(GPUMapMode.READ).then(() => {
    const b = new Float32Array(probeBuf.getMappedRange());
    const d = [b[12], b[13], b[14], b[15], b[20]];
    probeBuf.unmap();
    if (TEST) probeNext = d; else probeData = d;
    probeState = 0;
  }, () => { probeState = 0; });
}

export function updateInCloud(dt) {
  inCloud = damp(inCloud, probeData ? sat(probeData[0] / 0.012) : 0, 3.0, dt);
}
