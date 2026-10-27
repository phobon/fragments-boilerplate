// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, uv, vec4 } from 'three/tsl'
import { sepia } from '../utils/color/adjustments/sepia'

/**
 * Sepia image adjustment (mix toward the classic sepia matrix).
 * Post-processing wrapper around the color-in/color-out `sepia` adjustment
 * (utils/color/adjustments) so it can run as a PP chain layer.
 * @param {Object} props - Adjustment parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.amount=1] - 0 = unchanged, 1 = full sepia.
 * @returns {vec4} The adjusted color (alpha passed through)
 */
export const sepiaAdjustment = Fn((props) => {
  const { input, inputUV = uv, amount = 1 } = props || {}

  const _uv = inputUV().toVar()
  const color = input.sample(_uv)
  return vec4(sepia(color.rgb, amount), color.a)
})
