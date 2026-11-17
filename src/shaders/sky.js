// The sky: the atmosphere's lookup tables, after Hillaire 2020 (Rayleigh, Mie and ozone)
//
// Transmittance (256×64) and multiple scattering (32×32) once at the start; the sky view (192×108)
// and the ambient light (bAmb) for the camera's height, again whenever it has moved 10 m up or down
// (render/frame.js). render/sun.js keeps a CPU copy of the transmittance for the sun's colour. The
// cirrus and the two high layers are textures (shaders/textures.js), laid over the sky by the TAAU
// pass.

export { default as FS_TRANSMITTANCE } from './transmittance.wgsl';

export { default as FS_MULTISCAT } from './multiscatter.wgsl';

export const U_SKYVIEW = { camH: 'f32', sunDir: 'vec3f' };   // camH in km
export { default as FS_SKYVIEW } from './skyview.wgsl';

// ambient (bAmb, chunks/ambient.wgsl): sky irradiance / PI on an upward face (cosine weighted over
// the upper hemisphere) and on vertical faces turned toward and away from the sun; a compute
// shader, one workgroup per face
export const U_AMBIENT = { sunDir: 'vec3f', camH: 'f32' };
export { default as CS_AMBIENT } from './ambient.wgsl';
