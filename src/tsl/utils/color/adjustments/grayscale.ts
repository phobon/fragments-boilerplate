import { Fn, mix, vec3 } from 'three/tsl'

import { LUMA } from './luma'

/**
 * Mixes a color toward its luminance (grayscale).
 * @param {vec3} _color Input color vector
 * @param {float} _amount 0 = unchanged, 1 = fully grayscale
 * @returns {vec3} Adjusted color
 */
export const grayscale = Fn(([_color, _amount]) => {
  return mix(_color, vec3(_color.dot(LUMA)), _amount)
})
