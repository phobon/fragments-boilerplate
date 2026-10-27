// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2 } from 'three/tsl'
import { kaleidoscopeDistortion } from '../distortion/kaleidoscope_distortion'

/**
 * Creates a kaleidoscope distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.sides=6.0] - Number of mirrored segments
 * @param {number} [props.rotation=0.0] - Angular offset in turns (0–1)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Centre of the kaleidoscope
 * @returns {vec4} The kaleidoscope-distorted color
 */
export const kaleidoscopeDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, sides = 6.0, rotation = 0.0, center = vec2(0.5) } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = kaleidoscopeDistortion(_uv, {
    sides: float(sides),
    rotation: float(rotation),
    center,
  })

  return input.sample(distortedUV)
})

/**
 * WP2 (docs/shader-perf-implementation-plan.md): re-export of the UV
 * transform above, under the stable name `ppRemapUVRegistry` expects.
 * Calling convention: `kaleidoscopeDistortionUV(uvNode, args)`, matching
 * this module's existing `kaleidoscopeDistortion(_uv, options)` helper
 * convention (see mirror_distortion_effect.ts for the rationale, applied
 * uniformly across all nine remap effects). No behaviour change: this is
 * the exact same `kaleidoscopeDistortion` `kaleidoscopeDistortionEffect`
 * calls above.
 */
export { kaleidoscopeDistortion as kaleidoscopeDistortionUV }
