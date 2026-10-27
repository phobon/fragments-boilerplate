import { Fn, pow, vec3 } from 'three/tsl'

/**
 * Gamma adjustment (color^(1/gamma)).
 * @param {vec3} _color Input color vector
 * @param {float} _gamma 1 = unchanged, >1 lifts midtones, <1 crushes them
 * @returns {vec3} Adjusted color
 */
export const gamma = Fn(([_color, _gamma]) => {
  return pow(_color.max(0.0), vec3(_gamma).reciprocal())
})
