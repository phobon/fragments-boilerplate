import { Fn, float, pow, sin } from 'three/tsl'

/**
 * CRT scanline mask for a UV coordinate. Returns a 0–1 value (bright on the line,
 * dark in the gap) that can be multiplied into a colour. This is the standalone
 * pattern behind `crtScanlineEffect` — the effect samples scene colour and
 * multiplies by this, but the mask itself needs no scene input.
 * @param {vec2} _uv - The UV coordinates.
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.frequency=200] - Number of scanlines.
 * @param {number} [options.sharpness=0.5] - Sharpness of the line falloff (higher = thinner lines).
 * @returns {float} The scanline mask value (0–1).
 */
export const crtScanlinePattern = Fn(([_uv, options = null]) => {
  const { frequency = 200, sharpness = 0.5 } = options || {}

  const scanline = sin(_uv.y.mul(frequency).mul(Math.PI))
  return pow(scanline.mul(0.5).add(0.5), float(sharpness))
})
