// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { clamp, cos, Fn, float, pow, sin, sqrt, uv, vec2, vec3, vec4 } from 'three/tsl'
import { FLUTED_REFRACT_SCALE, flutedGlassProfile } from '../distortion/fluted_glass_distortion'

const TAU = Math.PI * 2

// Baked lighting for the glass relief. Shading depth scales with `refraction`, so
// the single Refraction control drives both the warp and how raised the ribs read.
const RELIEF = 1.3 // normal tilt per unit refraction
const LIGHT_X = -0.45 // light direction across the ribs
const LIGHT_UP = 0.89 // light direction out of the surface
const AMBIENT = 0.62 // floor brightness in the grooves
const SHININESS = 40.0 // specular tightness (glossy crest highlight)
const SPECULAR = 0.7 // specular strength
const GROOVE_DEPTH = 0.55 // how dark the seams between bars get

/**
 * Fluted / ribbed glass distortion effect for post-processing. Refracts the
 * scene through selectable rib `shape`s, lights the ribs as a 3D relief
 * (highlight on the crest, shadow in the groove), and splits the channels for
 * chromatic aberration. The relief shading is what turns a smooth input into the
 * sculpted glass look — it can't come from refraction alone.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {string} [props.shape="waves"] - Rib cross-section profile
 * @param {number} [props.frequency=10.0] - Number of flutes across the frame
 * @param {number} [props.angle=0.0] - Orientation of the flutes in turns (0–1); 0 = vertical ribs
 * @param {number} [props.softness=0.5] - Edge softness of the ribs (0 sharp → 1 smooth)
 * @param {number} [props.waveAmplitude=0.06] - How far the ribs wave along their length
 * @param {number} [props.waveFrequency=1.5] - Frequency of the wave along the ribs
 * @param {number} [props.refraction=1.5] - Refraction / relief strength
 * @param {number} [props.aberration=0.2] - Chromatic aberration amount (RGB split)
 * @returns {vec4} The fluted-glass distorted color
 */
export const flutedGlassDistortionEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    shape = 'waves',
    frequency = 10.0,
    angle = 0.0,
    softness = 0.5,
    waveAmplitude = 0.06,
    waveFrequency = 1.5,
    refraction = 1.5,
    aberration = 0.2,
  } = props || {}

  const _uv = inputUV().toVar()
  const profile = flutedGlassProfile(_uv, {
    shape,
    frequency: float(frequency),
    angle: float(angle),
    softness: float(softness),
    waveAmplitude: float(waveAmplitude),
    waveFrequency: float(waveFrequency),
  }).toVar()
  const slope = profile.x.toVar()
  const groove = profile.y.toVar()

  const _angle = float(angle).mul(TAU).toVar()
  const direction = vec2(cos(_angle), sin(_angle)).toVar()
  const _refraction = float(refraction).toVar()
  const displacement = direction.mul(slope.mul(_refraction).mul(FLUTED_REFRACT_SCALE)).toVar()

  // Refraction with chromatic aberration along the displacement direction.
  const _aberration = float(aberration).toVar()
  const rUV = _uv.add(displacement.mul(float(1.0).add(_aberration))).toVar()
  const gUV = _uv.add(displacement).toVar()
  const bUV = _uv.add(displacement.mul(float(1.0).sub(_aberration))).toVar()
  const color = vec3(input.sample(rUV).r, input.sample(gUV).g, input.sample(bUV).b).toVar()
  const alpha = input.sample(gUV).a

  // Relief shading: tilt the surface normal by the rib slope and light it.
  const normalX = slope.negate().mul(_refraction.mul(RELIEF)).toVar()
  const invLen = sqrt(normalX.mul(normalX).add(1.0)).toVar()
  const ndotl = normalX.mul(LIGHT_X).add(LIGHT_UP).div(invLen).toVar()
  const diffuse = clamp(ndotl, 0.0, 1.0).toVar()
  const specular = pow(clamp(ndotl, 0.0, 1.0), SHININESS)
    .mul(SPECULAR)
    .toVar()
  const shade = float(AMBIENT).add(float(1.0).sub(AMBIENT).mul(diffuse)).add(specular).toVar()
  // Darken the seams so flat-topped shapes (bars) read as separated panels.
  shade.mulAssign(float(1.0).sub(groove.mul(GROOVE_DEPTH)))

  return vec4(color.mul(shade), alpha)
})
