// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, floor, fract, mix, screenSize, sin, step, uv, vec2, vec3, vec4 } from 'three/tsl'

const hash21 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123))

/**
 * Creates a mezzotint effect for post-processing, replicating Illustrator's
 * Pixelate → Color Halftone/Mezzotint "dot type" filters: the image is rebuilt
 * from harsh random dot noise, where each cell is snapped to a random
 * on/off threshold rather than a smooth gradient. Saturated colors survive
 * as noisy speckle clusters rather than clean gradients, giving the classic
 * hand-etched mezzotint look of fully re-quantized extreme values.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.density=250] - Number of dot cells across the aspect-corrected UV space (higher = finer grain)
 * @param {number} [props.range=0.5] - How far the per-cell random threshold spreads around 0.5 (0 = fixed 0.5 threshold, 0.5 = full 0-1 randomization)
 * @param {boolean} [props.colored=true] - When true, thresholds each color channel independently (decorrelated hash offsets) for full-color speckle; when false, thresholds luminance for a black & white mezzotint
 * @returns {vec4} The mezzotint processed color
 */
export const mezzotintEffect = Fn((props) => {
  const { input, inputUV = uv, density = 250, range = 0.5, colored = true } = props || {}

  const _uv = inputUV().toVar()
  const _density = float(density)
  const _range = float(range)

  // Aspect correct UV coordinates
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Snap into dot cells
  const cell = floor(aspectCorrectedUV.mul(_density)).toVar()
  const cellUV = cell.div(_density).toVar()

  // Reverse aspect correction to sample the source at the cell-snapped UV
  const samplingUV = vec2(cellUV.x.div(aspect), cellUV.y).toVar()
  const originalColor = input.sample(samplingUV)

  const lo = float(0.5).sub(_range)
  const hi = float(0.5).add(_range)

  let resultRgb

  if (colored) {
    const thresholdR = mix(lo, hi, hash21(cell.add(vec2(17.0, 0.0)))).toVar()
    const thresholdG = mix(lo, hi, hash21(cell.add(vec2(0.0, 31.0)))).toVar()
    const thresholdB = mix(lo, hi, hash21(cell.add(vec2(53.0, 71.0)))).toVar()

    resultRgb = vec3(
      step(thresholdR, originalColor.r),
      step(thresholdG, originalColor.g),
      step(thresholdB, originalColor.b),
    )
  } else {
    const luminance = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114)).toVar()
    const threshold = mix(lo, hi, hash21(cell)).toVar()
    resultRgb = vec3(step(threshold, luminance))
  }

  return vec4(resultRgb, originalColor.a)
})
