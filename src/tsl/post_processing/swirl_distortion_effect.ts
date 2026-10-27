// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2 } from 'three/tsl'
import { swirlDistortion } from '../distortion/swirl_distortion'

/**
 * Creates a swirl/twirl distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=1.0] - Strength of the rotation (angle multiplier)
 * @param {number} [props.radius=0.5] - Radius at which the effect reaches maximum strength
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Center point of the swirl effect
 * @returns {vec4} The swirled/distorted color
 */
export const swirlDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 1.0, radius = 0.5, center = vec2(0.5) } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = swirlDistortion(_uv, {
    strength: float(strength),
    radius: float(radius),
    center,
  })

  return input.sample(distortedUV)
})

/**
 * WP2 (docs/shader-perf-implementation-plan.md): re-export of the UV
 * transform above, under the stable name `ppRemapUVRegistry` expects.
 * Calling convention: `swirlDistortionUV(uvNode, args)`, matching this
 * module's existing `swirlDistortion(_uv, options)` helper convention (see
 * mirror_distortion_effect.ts for the rationale, applied uniformly across
 * all nine remap effects). No behaviour change: this is the exact same
 * `swirlDistortion` `swirlDistortionEffect` calls above.
 */
export { swirlDistortion as swirlDistortionUV }
