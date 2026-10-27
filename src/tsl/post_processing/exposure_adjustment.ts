// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, uv, vec4 } from 'three/tsl'
import { exposure } from '../utils/color/adjustments/exposure'

/**
 * Photographic exposure image adjustment (color × 2^stops).
 * Post-processing wrapper around the color-in/color-out `exposure` adjustment
 * (utils/color/adjustments) so it can run as a PP chain layer.
 * @param {Object} props - Adjustment parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.stops=0] - Exposure in stops; 0 = unchanged, +1 doubles, −1 halves.
 * @returns {vec4} The adjusted color (alpha passed through)
 */
export const exposureAdjustment = Fn((props) => {
  const { input, inputUV = uv, stops = 0 } = props || {}

  const _uv = inputUV().toVar()
  const color = input.sample(_uv)
  return vec4(exposure(color.rgb, stops), color.a)
})
