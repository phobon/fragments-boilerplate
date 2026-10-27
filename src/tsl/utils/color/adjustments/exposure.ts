import { Fn, pow } from 'three/tsl'

/**
 * Photographic exposure in stops (color × 2^stops).
 * @param {vec3} _color Input color vector
 * @param {float} _stops 0 = unchanged, +1 doubles, −1 halves
 * @returns {vec3} Adjusted color
 */
export const exposure = Fn(([_color, _stops]) => {
  return _color.mul(pow(2.0, _stops))
})
