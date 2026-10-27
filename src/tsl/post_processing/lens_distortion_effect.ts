// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2 } from 'three/tsl'
import { lensDistortion } from '../distortion/lens_distortion'

/**
 * Creates a "CC Lens"-style lens distortion effect for post-processing. Ported
 * from the Codrops "Mouse-Following Square Lens" tutorial. Bulges (or pinches)
 * the image radially around a focal `center`.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.distortion=1.5] - Lens strength (positive=bulge, negative=pinch)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Focal point where distortion is zero
 * @param {vec2} [props.aspect=vec2(1, 1)] - Aspect scale (e.g. vec2(width/height, 1)) to keep the lens circular on non-square viewports
 * @returns {vec4} The lens-distorted color
 */
export const lensDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, distortion = 1.5, center = vec2(0.5), aspect = vec2(1, 1) } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = lensDistortion(_uv, {
    distortion: float(distortion),
    center,
    aspect,
  })

  return input.sample(distortedUV)
})

/**
 * Re-export of the UV transform above, under the stable name
 * `ppRemapUVRegistry` expects. Calling convention: `lensDistortionUV(uvNode,
 * args)`, matching this module's `lensDistortion(_uv, options)` helper (see
 * bulge_distortion_effect.ts / swirl_distortion_effect.ts for the rationale,
 * applied uniformly across the remap effects). No behaviour change: this is the
 * exact same `lensDistortion` `lensDistortionEffect` calls above.
 */
export { lensDistortion as lensDistortionUV }
