// The sky: atmosphere lookup tables after Hillaire 2020 (transmittance, multiple scattering, sky view, ambient)
//
// Transmittance (256×64) and multiple scattering (32×32) once at start, the sky view (192×108) every
// frame for the camera's height; Rayleigh, Mie and ozone. The same model gives the sun's colour at
// every altitude (render/sun.js: a CPU copy for the clouds' light uniforms) and the haze (hazeOD in
// the trace, HAZE_K = 2.8e-5). Cirrus (a 512² tile over 32 km at 9.8 km) and the two thin high layers
// (1024² over 64 km at 6.3 and 7.7 km) are 2D textures (shaders/textures.js); they repeat.



export { default as FS_TRANSMITTANCE } from './transmittance.wgsl';

export { default as FS_MULTISCAT } from './multiscatter.wgsl';

export const U_SKYVIEW = { camH: 'f32', sunDir: 'vec3f' };   // camH in km
export { default as FS_SKYVIEW } from './skyview.wgsl';

// ambient: px0 = cosine weighted sky irradiance / PI (upper hemisphere), px1 = mean radiance near
// horizon, px2 / px3 = sky irradiance / PI on a vertical face turned toward / away from the sun
export const U_AMBIENT = { sunDir: 'vec3f', camH: 'f32' };
export { default as FS_AMBIENT } from './ambient.wgsl';
