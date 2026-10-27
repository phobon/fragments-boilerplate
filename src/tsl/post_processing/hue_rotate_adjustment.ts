// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, uv, vec4 } from 'three/tsl'
import { hueRotate } from '../utils/color/adjustments/hue_rotate'

const TWO_PI = Math.PI * 2

/**
 * Hue-rotate image adjustment.
 * Post-processing wrapper around the color-in/color-out `hueRotate` adjustment
 * (utils/color/adjustments) so it can run as a PP chain layer. Takes the angle
 * in turns (0..1) — matching the other effects' 0..1 `angle`/`rotation` dials —
 * and converts to the radians `hueRotate` expects.
 * @param {Object} props - Adjustment parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.angle=0] - Hue rotation in turns; 0 (and 1) = unchanged.
 * @returns {vec4} The adjusted color (alpha passed through)
 */
export const hueRotateAdjustment = Fn((props) => {
  const { input, inputUV = uv, angle = 0 } = props || {}

  const _uv = inputUV().toVar()
  const color = input.sample(_uv)
  return vec4(hueRotate(color.rgb, angle.mul ? angle.mul(TWO_PI) : angle * TWO_PI), color.a)
})
