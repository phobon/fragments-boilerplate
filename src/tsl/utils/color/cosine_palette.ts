import { Fn, float, cos } from 'three/tsl'

/**
 * Generates a palette of colors using a cosine-based function
 * @param {float} t Time/position parameter between 0-1
 * @param {vec3} a Base color offset
 * @param {vec3} b Color amplitude
 * @param {vec3} c Color frequency
 * @param {vec3} d Phase offset
 * @param {vec3} e Cosine scalar
 * @returns {vec3} RGB color value
 */
export const cosinePalette = Fn(([t, a, b, c, d, e = float(6.28318)]) => {
  return a.add(b.mul(cos(e.mul(c.mul(t).add(d)))))
})
