import { Fn, float, floor, screenSize, vec2 } from 'three/tsl'

/**
 * Creates a pixellation pattern given the current UV coordinates and screenSize.
 * @param {vec2} _uv - The UV coordinates.
 * @param {number} [size=20.0] - The size of the pixellation.
 * @returns {vec2} Snapped UV at the top-left of each pixel cell (use for texture sampling).
 */
export const pixellationPattern = Fn(([_uv, size = 20.0]) => {
  const _size = float(size)

  // The input UVs should be aspect corrected
  const pixelSize = _size.div(screenSize.x)
  return floor(_uv.div(pixelSize)).mul(pixelSize)
})

/**
 * Creates a normalized pixel size given the current screen size.
 * @param {number} [size=20.0] - The size of the pixellation.
 * @returns {vec2} The normalized pixel size.
 */
export const normalizedPixelSize = Fn(([size = 20]) => {
  const pixelSize = float(size)
  return vec2(pixelSize.div(screenSize.x), pixelSize.div(screenSize.y))
})
