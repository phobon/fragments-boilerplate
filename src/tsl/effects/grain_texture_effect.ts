import { vec2, Fn, fract, sin, dot } from 'three/tsl'

/**
 * Returns a grain texture value for a given UV coordinate.
 * @param {vec2} _uv - The UV coordinates.
 * @returns {float} The grain value.
 */
export const grainTextureEffect = Fn(([_uv]) => {
  return fract(sin(dot(_uv, vec2(12.9898, 78.233))).mul(43758.5453123))
})
