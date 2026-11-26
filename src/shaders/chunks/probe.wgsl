
// The light and cloud at the bird and around the camera (shaders/probe.js; bProbe). The bird
// reads the light; render/probe.js reads `medium` and `floorD` back for the flight and the camera.
struct Probe {
  sun: vec4f,       // sunlight at the bird (rgb), its transmittance (a)
  ambUp: vec4f,     // sky light from above at the bird, dimmed inside cloud (rgb), by how much (a)
  ambDn: vec4f,     // light from the sea of clouds below, sunlit or in shadow
  medium: vec4f,    // extinction at the camera, at the bird; distance to the cloud at the bird; the sea's top there
  mistL: vec4f,     // radiance of the mist around the camera
  floorD: vec4f,    // distance to the sea's billows below the bird (x)
}
