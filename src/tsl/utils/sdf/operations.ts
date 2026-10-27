// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (missing this header was an oversight — its sibling files in this directory, shapes.ts and masks.ts, already carry it for the identical reason). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { abs, Fn, float, max, min } from 'three/tsl'

/**
 * Returns the smooth minimum of two floats.
 * @param {number} a - First value.
 * @param {number} b - Second value.
 * @param {number} factor - Smoothing factor.
 * @returns {number} The smooth minimum of a and b.
 */
export const smin = Fn(([a, b, factor]) => {
  const h = max(factor.sub(abs(a.sub(b))), 0).div(factor)
  return min(a, b).sub(h.mul(h).mul(factor).mul(0.25))
})

/**
 * Returns the smooth maximum of two floats.
 * @param {number} a - First value.
 * @param {number} b - Second value.
 * @param {number} [k=0.0] - Smoothing factor.
 * @returns {number} The smooth maximum of a and b.
 */
export const smax = Fn(([a, b, k = float(0)]) => {
  return smin(a, b, k.negate())
})
