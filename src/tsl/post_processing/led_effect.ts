import { Fn, fract, pow, smoothstep, length, float, uv } from 'three/tsl'

/**
 * Creates an LED screen effect with configurable parameters for post-processing.
 * @param {Object} props - The effect properties
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.scalar=150] - Controls the density of the LED pattern
 * @param {number} [props.zoom=2.5] - Controls the size of individual LED elements
 * @param {number} [props.exponent=1.2] - Controls the sharpness of the LED pattern edges
 * @param {number} [props.edge=0.1] - Controls the threshold of the LED pattern
 * @returns {vec4} The LED processed color
 */
export const ledEffect = Fn((props) => {
  const { input, inputUV = uv, scalar = 100, zoom = 2, exponent = 1.2, edge = 0.1 } = props || {}

  const _uv = inputUV().toVar()

  const _zoom = float(zoom)
  const _exponent = float(exponent)
  const _edge = float(edge)

  const gridUV = fract(_uv.mul(scalar)).sub(0.5).toVar()

  // Circle pattern
  const pattern = length(gridUV.mul(_zoom)).oneMinus().toVar()
  pattern.assign(smoothstep(_edge, 1, pattern))
  pattern.assign(pow(pattern, _exponent))

  const originalColor = input.sample(_uv)
  return originalColor.mul(pattern)
})
