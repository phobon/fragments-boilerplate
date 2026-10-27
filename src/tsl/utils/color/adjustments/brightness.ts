import { Fn } from 'three/tsl'

/**
 * Scales a color's brightness.
 * @param {vec3} _color Input color vector
 * @param {float} _amount 1 = unchanged, <1 darker, >1 brighter
 * @returns {vec3} Adjusted color
 */
export const brightness = Fn(([_color, _amount]) => {
  return _color.mul(_amount)
})
