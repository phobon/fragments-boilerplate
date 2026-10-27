// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2 } from 'three/tsl'
import { bulgeDistortion } from '../distortion/bulge_distortion'

/**
 * Creates a bulge distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=0.5] - Strength of the bulge effect (positive=bulge, negative=pinch)
 * @param {number} [props.radius=0.3] - Radius of the distortion effect
 * @param {number} [props.power=1.0] - Power curve for the falloff (higher = stronger center effect)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Center point of the distortion
 * @returns {vec4} The bulge distorted color
 */
export const bulgeEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 0.5, radius = 0.3, power = 1.0, center = vec2(0.5) } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = bulgeDistortion(_uv, {
    strength: float(strength),
    radius: float(radius),
    power: float(power),
    center,
  })

  return input.sample(distortedUV)
})

/**
 * WP2 (docs/shader-perf-implementation-plan.md): re-export of the UV
 * transform above, under the stable name `ppRemapUVRegistry` expects.
 * Calling convention: `bulgeDistortionUV(uvNode, args)`, matching this
 * module's existing `bulgeDistortion(_uv, options)` helper convention (see
 * mirror_distortion_effect.ts for the rationale, applied uniformly across
 * all nine remap effects). No behaviour change: this is the exact same
 * `bulgeDistortion` `bulgeEffect` calls above.
 */
export { bulgeDistortion as bulgeDistortionUV }
