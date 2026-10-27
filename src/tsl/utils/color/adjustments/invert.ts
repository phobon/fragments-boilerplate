import { Fn, mix } from 'three/tsl'

/**
 * Mixes a color toward its negative.
 * @param {vec3} _color Input color vector
 * @param {float} _amount 0 = unchanged, 1 = fully inverted
 * @returns {vec3} Adjusted color
 */
export const invert = Fn(([_color, _amount]) => {
  return mix(_color, _color.oneMinus(), _amount)
})
