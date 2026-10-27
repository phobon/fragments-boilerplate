import { cos, dot, Fn, float, fract, length, screenSize, sin, smoothstep, vec2 } from 'three/tsl'

/**
 * Halftone dot mask for a UV coordinate. Returns a 0–1 value (1 inside a dot,
 * 0 between dots) on a rotated, aspect-corrected grid. This is the standalone
 * pattern behind `halftoneEffect`; the effect drives `dotSize` from scene
 * brightness, but here it is a plain parameter so the grid is usable on its own.
 * @param {vec2} _uv - The UV coordinates.
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.frequency=100] - Frequency of the dot grid.
 * @param {number} [options.angle=0.5] - Rotation of the grid in radians.
 * @param {number} [options.dotSize=0.4] - Radius of each dot (0–1 within a cell).
 * @param {number} [options.smoothness=0.1] - Edge softness of the dots.
 * @returns {float} The halftone dot mask value (0–1).
 */
export const halftonePattern = Fn(([_uv, options = null]) => {
  const { frequency = 100, angle = 0.5, dotSize = 0.4, smoothness = 0.1 } = options || {}

  // Aspect-correct so dots stay round on non-square targets.
  const aspect = screenSize.x.div(screenSize.y)
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y)

  // Rotate the grid.
  const c = cos(float(angle))
  const s = sin(float(angle))
  const rotatedUV = vec2(dot(aspectCorrectedUV, vec2(c, s.negate())), dot(aspectCorrectedUV, vec2(s, c)))

  const gridUV = fract(rotatedUV.mul(frequency)).sub(0.5)
  const dist = length(gridUV)
  return smoothstep(float(dotSize).add(smoothness), float(dotSize).sub(smoothness), dist)
})
