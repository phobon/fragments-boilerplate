import { Fn, mix, vec3 } from 'three/tsl'

/**
 * Mixes a color toward the classic sepia matrix result.
 * @param {vec3} _color Input color vector
 * @param {float} _amount 0 = unchanged, 1 = full sepia
 * @returns {vec3} Adjusted color
 */
export const sepia = Fn(([_color, _amount]) => {
  const toned = vec3(
    _color.dot(vec3(0.393, 0.769, 0.189)),
    _color.dot(vec3(0.349, 0.686, 0.168)),
    _color.dot(vec3(0.272, 0.534, 0.131)),
  )
  return mix(_color, toned.clamp(0.0, 1.0), _amount)
})
