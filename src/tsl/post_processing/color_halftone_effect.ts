// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  cos,
  dot,
  Fn,
  float,
  fract,
  fwidth,
  length,
  max,
  mix,
  screenSize,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

// Classic CMYK print screen angles, in radians.
const CYAN_ANGLE = Math.PI / 12 // 15°
const MAGENTA_ANGLE = (Math.PI * 5) / 12 // 75°
const YELLOW_ANGLE = 0 // 0°
const BLACK_ANGLE = Math.PI / 4 // 45°

/**
 * Computes halftone dot coverage (0 = paper, 1 = full ink) for one CMYK channel.
 *
 * Rotates the aspect-corrected UV by `angleRadians` (same rotation pattern as
 * `halftone_effect.ts`), lays a grid at `frequency`, and grows a round dot
 * inside each cell whose radius is driven by `channelValue` (ink amount).
 *
 * @param {object} channelValue - Scalar TSL node, ink amount in [0, 1]
 * @param {object} aspectUV - Aspect-corrected UV node (vec2)
 * @param {number|object} angleRadians - Screen rotation angle in radians
 * @param {object} frequency - Scalar TSL node, dots per unit
 * @param {object} smoothness - Scalar TSL node, extra dot edge softness
 * @returns {object} Scalar TSL node, dot coverage in [0, 1]
 */
const halftoneChannel = (channelValue, aspectUV, angleRadians, frequency, smoothness) => {
  const c = cos(angleRadians).toVar()
  const s = sin(angleRadians).toVar()
  const rotatedUV = vec2(dot(aspectUV, vec2(c, s.negate())), dot(aspectUV, vec2(s, c))).toVar()

  const gridUV = fract(rotatedUV.mul(frequency)).sub(0.5).toVar()

  // sqrt keeps perceived ink density linear; 0.7071 (1/sqrt2) lets a full
  // channel value grow the dot past the cell's inscribed circle so it
  // overflows into a solid square, matching real halftone screens.
  const radius = channelValue.max(0).sqrt().mul(0.7071).toVar()
  const dist = length(gridUV).toVar()

  // Resolution- & frequency-independent edge via fwidth: dots stay crisp at
  // any screen frequency / render resolution instead of smearing when the
  // dots get small relative to a fixed band. smoothness adds extra softness.
  const edge = fwidth(dist).mul(1.5).add(smoothness).toVar()

  return smoothstep(radius.add(edge), radius.sub(edge), dist)
}

/**
 * Creates a CMYK color halftone effect, simulating Illustrator's
 * Pixelate → Color Halftone filter: four ink screens (cyan, magenta, yellow,
 * black), each on its own rotated dot grid at the classic print angles
 * (C 15°, M 75°, Y 0°, K 45°), composited subtractively over white paper.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - UV node function to sample at
 * @param {number} [props.frequency=60] - Dots per unit for all four screens
 * @param {number} [props.smoothness=0.08] - Extra edge softness of the dots
 * @param {number} [props.angleOffset=0] - Extra rotation (radians) added to all four screen angles
 * @returns {vec4} The color-halftoned image, original alpha preserved
 */
export const colorHalftoneEffect = Fn((props) => {
  const { input, inputUV = uv, frequency = 60, smoothness = 0.08, angleOffset = 0 } = props || {}

  const _uv = inputUV().toVar()
  const _frequency = float(frequency)
  const _smoothness = float(smoothness)
  const _angleOffset = float(angleOffset)

  // Aspect correct UV coordinates so dots stay circular on screen
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  const originalColor = input.sample(_uv)
  const r = originalColor.r
  const g = originalColor.g
  const b = originalColor.b

  // RGB -> CMYK
  const k = float(1)
    .sub(max(r, max(g, b)))
    .toVar()
  const kInv = float(1).sub(k).add(1e-5)
  const c = float(1).sub(r).sub(k).div(kInv).toVar()
  const m = float(1).sub(g).sub(k).div(kInv).toVar()
  const y = float(1).sub(b).sub(k).div(kInv).toVar()

  const coverC = halftoneChannel(c, aspectCorrectedUV, _angleOffset.add(CYAN_ANGLE), _frequency, _smoothness)
  const coverM = halftoneChannel(m, aspectCorrectedUV, _angleOffset.add(MAGENTA_ANGLE), _frequency, _smoothness)
  const coverY = halftoneChannel(y, aspectCorrectedUV, _angleOffset.add(YELLOW_ANGLE), _frequency, _smoothness)
  const coverK = halftoneChannel(k, aspectCorrectedUV, _angleOffset.add(BLACK_ANGLE), _frequency, _smoothness)

  // Subtractive composite over white paper: each ink dot multiplies its
  // complementary color into the running result, producing the classic
  // CMYK rosette overlap pattern.
  const white = vec3(1, 1, 1)
  const col = vec3(1, 1, 1).toVar()
  col.mulAssign(mix(white, vec3(0, 1, 1), coverC))
  col.mulAssign(mix(white, vec3(1, 0, 1), coverM))
  col.mulAssign(mix(white, vec3(1, 1, 0), coverY))
  col.mulAssign(mix(white, vec3(0, 0, 0), coverK))

  return vec4(col, originalColor.a)
})
