import { Fn, mix, vec3 } from 'three/tsl'

import { LUMA } from './luma'

/**
 * Adjusts saturation relative to luminance.
 * @param {vec3} _color Input color vector
 * @param {float} _amount 1 = unchanged, 0 = grayscale, >1 oversaturated
 * @returns {vec3} Adjusted color
 */
export const saturation = Fn(([_color, _amount]) => {
  return mix(vec3(_color.dot(LUMA)), _color, _amount)
})
