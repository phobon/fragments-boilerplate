import { dot, Fn, fract, sin, vec2 } from 'three/tsl'

/**
 * Returns a grain texture pattern value for a given UV coordinate.
 * @param {vec2} _uv - The UV coordinates.
 * @returns {float} The grain value.
 */
export const grainTexturePattern = Fn(([_uv, options = null]) => {
  return fract(sin(dot(_uv, vec2(12.9898, 78.233))).mul(43758.5453123))
})
