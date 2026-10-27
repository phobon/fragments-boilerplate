// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2 } from 'three/tsl'
import { stretchDistortion } from '../distortion/stretch_distortion'

/**
 * Creates a directional stretch distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Anchor the stretch pulls from
 * @param {number} [props.angle=0.0] - Stretch axis in turns (0–1); 0 = horizontal
 * @param {number} [props.strength=0.5] - Stretch amount (>0 stretch, <0 squeeze; keep > -1)
 * @returns {vec4} The stretched color
 */
export const stretchDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, center = vec2(0.5), angle = 0.0, strength = 0.5 } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = stretchDistortion(_uv, {
    center,
    angle: float(angle),
    strength: float(strength),
  })

  return input.sample(distortedUV)
})

/**
 * WP2 (docs/shader-perf-implementation-plan.md): re-export of the UV
 * transform above, under the stable name `ppRemapUVRegistry` expects.
 * Calling convention: `stretchDistortionUV(uvNode, args)`, matching this
 * module's existing `stretchDistortion(_uv, options)` helper convention
 * (see mirror_distortion_effect.ts for the rationale, applied uniformly
 * across all nine remap effects). No behaviour change: this is the exact
 * same `stretchDistortion` `stretchDistortionEffect` calls above.
 */
export { stretchDistortion as stretchDistortionUV }
