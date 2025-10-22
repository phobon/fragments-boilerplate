import { vec2, Fn, fract, sin, dot, uv } from 'three/tsl'

/**
 * Creates a grain texture effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.intensity=0.1] - Intensity of the grain effect (0-1)
 * @param {number} [props.scale=1.0] - Scale of the grain pattern
 * @returns {vec4} The grain processed color
 */
export const grainTextureEffect = Fn((props) => {
  const { input, inputUV = uv, intensity = 0.1, scale = 1.0 } = props || {}

  const _uv = inputUV().toVar()
  const grain = fract(sin(dot(_uv.mul(scale), vec2(12.9898, 78.233))).mul(43758.5453123)).toVar()

  const originalColor = input.sample(_uv)
  const grainOffset = grain.sub(0.5).mul(intensity).toVar()

  return originalColor.add(grainOffset)
})
