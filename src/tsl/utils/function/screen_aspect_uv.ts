import { float, Fn, sin, uv, vec2, select } from 'three/tsl'

/**
 * Returns uv coordinates with adjusted aspect ratio.
 * @param {vec2} r - The render size (vec2).
 * @param {float} range - The range of the transformed UV coordinates.
 * @returns {vec2} The aspect-corrected UV coordinates in the range -range to range.
 */
export const screenAspectUV = Fn(([r, range = float(0.5)]) => {
  const _uv = uv().sub(range)
  const final = select(r.x.greaterThan(r.y), vec2(_uv.x.mul(r.x.div(r.y)), _uv.y), vec2(_uv.x, _uv.y.mul(r.y.div(r.x))))

  return final
})
