// The probe: light and cloud at the bird and around the camera, read back from the GPU

import { TEST } from '../params.js';
import { damp, sat } from '../math.js';
import { extCBF, gl } from './gl.js';
import { FB } from './setup.js';

export let probeData = null; // async readback: [sigmaCam, sigmaBird, sdfBird, seaTop, sdfSeaOnlyBird]
export let inCloud = 0;      // smoothed: is the camera inside cloud?
let probePBO = null, probeSync = null, probeNext = null;
const probeBuf = new Float32Array(32);

export function readProbeAsync() {
  if (!extCBF) return;
  if (TEST) { // tests: as if the GPU were always done by the next frame (when a fence signals varies)
    if (probeNext) probeData = probeNext;
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.probe);
    gl.readPixels(0, 0, 8, 1, gl.RGBA, gl.FLOAT, probeBuf);
    probeNext = [probeBuf[12], probeBuf[13], probeBuf[14], probeBuf[15], probeBuf[20]];
    return;
  }
  if (probeSync) {
    const st = gl.getSyncParameter(probeSync, gl.SYNC_STATUS);
    if (st !== gl.SIGNALED) return;
    gl.deleteSync(probeSync); probeSync = null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, probePBO);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, probeBuf);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    probeData = [probeBuf[12], probeBuf[13], probeBuf[14], probeBuf[15], probeBuf[20]];
  }
  if (!probePBO) { probePBO = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, probePBO); gl.bufferData(gl.PIXEL_PACK_BUFFER, 8 * 16, gl.STREAM_READ); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.probe);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, probePBO);
  gl.readPixels(0, 0, 8, 1, gl.RGBA, gl.FLOAT, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  probeSync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
}

export function updateInCloud(dt) {
  inCloud = damp(inCloud, probeData ? sat(probeData[0] / 0.012) : 0, 3.0, dt);
}
