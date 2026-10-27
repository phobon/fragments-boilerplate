import { Fn } from 'three/tsl'

/**
 * Adjusts contrast around mid-gray.
 * @param {vec3} _color Input color vector
 * @param {float} _amount 1 = unchanged, 0 = flat gray, >1 more contrast
 * @returns {vec3} Adjusted color
 */
export const contrast = Fn(([_color, _amount]) => {
  return _color.sub(0.5).mul(_amount).add(0.5)
})
