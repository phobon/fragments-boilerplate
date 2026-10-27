// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2 } from 'three/tsl'
import { polarDistortion } from '../distortion/polar_distortion'

/**
 * Creates a polar-coordinates distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Centre the angle/radius are measured from
 * @param {number} [props.scale=1.0] - Multiplier on the radius axis
 * @param {number} [props.rotation=0.0] - Angular offset in turns (0–1)
 * @returns {vec4} The polar-distorted color
 */
export const polarDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, center = vec2(0.5), scale = 1.0, rotation = 0.0 } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = polarDistortion(_uv, {
    center,
    scale: float(scale),
    rotation: float(rotation),
  })

  return input.sample(distortedUV)
})

/**
 * WP2 (docs/shader-perf-implementation-plan.md): re-export of the UV
 * transform above, under the stable name `ppRemapUVRegistry` expects.
 * Calling convention: `polarDistortionUV(uvNode, args)`, matching this
 * module's existing `polarDistortion(_uv, options)` helper convention (see
 * mirror_distortion_effect.ts for the rationale, applied uniformly across
 * all nine remap effects). No behaviour change: this is the exact same
 * `polarDistortion` `polarDistortionEffect` calls above.
 */
export { polarDistortion as polarDistortionUV }
