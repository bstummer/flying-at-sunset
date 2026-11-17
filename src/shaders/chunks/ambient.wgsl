
// The sky's light on a face (irradiance / PI), from the sky view: upward, and vertical faces
// turned toward and away from the sun (shaders/sky.js; bAmb)
struct Ambient { up: vec4f, sunSide: vec4f, antiSun: vec4f }
