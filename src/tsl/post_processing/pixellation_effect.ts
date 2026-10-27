// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, floor, screenSize, uv, vec2 } from 'three/tsl'

/**
 * WP2 (docs/shader-perf-implementation-plan.md): the pixellation UV
 * transform, extracted verbatim (cut-paste, not rewritten — identical math,
 * identical defaults) from the body of `pixellationEffect` below so it can
 * be composed by WP3's chain planner without re-sampling `input`. Calling
 * convention: `pixellationUV(uvNode, args)` — uv first, args second — the
 * same convention the other eight remap effects use (see
 * mirror_distortion_effect.ts).
 * @param {vec2} _uv - The UV coordinates to pixellate (aspect corrected internally)
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.size=20.0] - Size of the pixellation blocks (higher values = larger pixels)
 * @returns {vec2} The pixellated sampling UV
 */
export const pixellationUV = Fn(([_uv, options = {}]) => {
  const { size = 20.0 } = options
  const uv = _uv.toVar()
  const _size = float(size)

  // Aspect correct UV coordinates
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(uv.x.mul(aspect), uv.y).toVar()

  // Create pixelated UV coordinates
  const pixelSize = _size.div(1000.0) // Normalize to reasonable range
  const pixelatedUV = floor(aspectCorrectedUV.div(pixelSize)).mul(pixelSize).toVar()

  // Reverse aspect correction for sampling
  const samplingUV = vec2(pixelatedUV.x.div(aspect), pixelatedUV.y).toVar()

  return samplingUV
})

/**
 * Creates a pixellation effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates to sample from (defaults to built-in uv)
 * @param {number} [props.size=20.0] - Size of the pixellation blocks (higher values = larger pixels)
 * @returns {vec4} The pixellated color
 */
export const pixellationEffect = Fn((props) => {
  const { input, inputUV = uv, size = 20.0 } = props || {}

  const _uv = inputUV().toVar()

  return input.sample(pixellationUV(_uv, { size }))
})
