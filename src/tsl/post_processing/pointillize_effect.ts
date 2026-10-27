// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, floor, fract, length, mix, screenSize, sin, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl'

const hash21 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123))

const hash22 = (p) => {
  const q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))
  return fract(sin(q).mul(43758.5453123))
}

/**
 * Creates a pointillize effect for post-processing, mimicking Adobe Illustrator's
 * Pixelate → Pointillize filter: the image is broken up into scattered round dots
 * of sampled color set against a paper-like background, evoking pointillist painting.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.density=120] - Number of dot cells across the aspect-corrected UV space (higher = smaller, more numerous dots)
 * @param {number} [props.dotScale=0.9] - Base dot diameter as a fraction of the cell size
 * @param {number} [props.jitter=0.8] - How far dot centers are randomly offset from their cell center (0 = perfectly gridded, 1 = up to a full cell)
 * @param {number} [props.softness=0.08] - Softness of the dot edge falloff, in cell units
 * @param {vec3} [props.background=vec3(0.98, 0.96, 0.92)] - Paper-like background color showing between dots
 * @returns {vec4} The pointillized color
 */
export const pointillizeEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    density = 120,
    dotScale = 0.9,
    jitter = 0.8,
    softness = 0.08,
    background = vec3(0.98, 0.96, 0.92),
  } = props || {}

  const _uv = inputUV().toVar()
  const _density = float(density)
  const _dotScale = float(dotScale)
  const _jitter = float(jitter)
  const _softness = float(softness)

  const originalColor = input.sample(_uv)

  // Aspect correct UV coordinates
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Scale into the dot grid
  const scaledUV = aspectCorrectedUV.mul(_density).toVar()

  const baseRadius = _dotScale.mul(0.5).toVar()

  const finalColor = vec3(background).toVar()

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      const offset = vec2(x, y)
      const cellId = floor(scaledUV).add(offset).toVar()

      // Jittered dot center within the cell
      const jitterOffset = hash22(cellId).sub(0.5).mul(_jitter).toVar()
      const dotCenter = cellId.add(0.5).add(jitterOffset).toVar()

      // Per-cell radius variation
      const radiusHash = hash21(cellId.add(vec2(31.7, 11.3))).toVar()
      const radius = baseRadius.mul(mix(0.7, 1.3, radiusHash)).toVar()

      const dist = length(scaledUV.sub(dotCenter)).toVar()
      const coverage = smoothstep(radius, radius.sub(_softness), dist).toVar()

      // Sample the input color at the dot center (back to UV space)
      const sampleUV = vec2(dotCenter.x.div(_density).div(aspect), dotCenter.y.div(_density)).toVar()
      const dotColor = input.sample(sampleUV).rgb

      finalColor.assign(mix(finalColor, dotColor, coverage))
    }
  }

  return vec4(finalColor, originalColor.a)
})
