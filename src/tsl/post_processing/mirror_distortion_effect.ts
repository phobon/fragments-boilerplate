// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2 } from 'three/tsl'
import { mirrorDistortion } from '../distortion/mirror_distortion'

/**
 * Creates a mirror distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Point the mirror line passes through
 * @param {number} [props.angle=0.0] - Orientation of the mirror normal in turns (0–1)
 * @param {number} [props.offset=0.0] - Shift of the mirror line along its normal
 * @returns {vec4} The mirrored color
 */
export const mirrorDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, center = vec2(0.5), angle = 0.0, offset = 0.0 } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = mirrorDistortion(_uv, {
    center,
    angle: float(angle),
    offset: float(offset),
  })

  return input.sample(distortedUV)
})

/**
 * WP2 (docs/shader-perf-implementation-plan.md): re-export of the UV
 * transform above, under the stable name `ppRemapUVRegistry` expects. The
 * calling convention is the one this module already used internally —
 * `mirrorDistortionUV(uvNode, args)`, uv first, args second (same shape as
 * `mirrorDistortion(_uv, options)`) — chosen over the plan's illustrative
 * curried form because it matches this codebase's existing helper
 * convention. No behaviour change: this is the exact same `mirrorDistortion`
 * `mirrorDistortionEffect` calls above.
 */
export { mirrorDistortion as mirrorDistortionUV }
