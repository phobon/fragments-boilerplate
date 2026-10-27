// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, uv, vec2, vec4 } from 'three/tsl'

/**
 * Radial RGB shift (chromatic-aberration family), ported from the Codrops
 * "Mouse-Following Square Lens" tutorial's RGB-shift step.
 *
 * Unlike `chromaticAberrationEffect` (which couples the channels with a single
 * strength — R outward, B inward), this exposes an INDEPENDENT per-channel
 * shift amount. Each channel is sampled along the radial direction from
 * `center`, so there is no separation at the focal point and it grows toward
 * the edges. Positive and negative amounts push a channel in opposite
 * directions; 0 leaves it unshifted. The tutorial's defaults (R=+0.01, G=0,
 * B=-0.01) split red and blue apart toward the edges.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.shiftR=0.01] - Red channel radial shift at the UV edge
 * @param {number} [props.shiftG=0.0] - Green channel radial shift at the UV edge
 * @param {number} [props.shiftB=-0.01] - Blue channel radial shift at the UV edge
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Focal point where the shift is zero
 * @returns {vec4} The RGB-shifted color
 */
export const rgbShiftEffect = Fn((props) => {
  const { input, inputUV = uv, shiftR = 0.01, shiftG = 0.0, shiftB = -0.01, center = vec2(0.5) } = props || {}

  const _uv = inputUV().toVar()
  const _shiftR = float(shiftR)
  const _shiftG = float(shiftG)
  const _shiftB = float(shiftB)

  // Radial direction from the focal point: zero at `center`, ±1 per axis at
  // the UV edges (matches the tutorial's `(squareUv - 0.5) * 2.0`). Each
  // channel is offset along it by its own amount.
  const direction = _uv.sub(center).mul(float(2.0)).toVar()

  const rSample = input.sample(_uv.add(direction.mul(_shiftR)))
  const gSample = input.sample(_uv.add(direction.mul(_shiftG)))
  const bSample = input.sample(_uv.add(direction.mul(_shiftB)))
  // Alpha from the unshifted sample so channel separation never bleeds the edge.
  const aSample = input.sample(_uv)

  return vec4(rSample.r, gSample.g, bSample.b, aSample.a)
})
