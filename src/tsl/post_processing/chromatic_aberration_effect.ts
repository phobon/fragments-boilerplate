import { Fn, vec2, float, normalize, length, vec4, uv } from 'three/tsl'

/**
 * Creates a chromatic aberration effect by separating RGB channels.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.strength=0.01] - Strength of the aberration offset
 * @param {number} [props.radial=1.0] - Amount of radial distortion (0 = directional, 1 = radial from center)
 * @param {vec2} [props.direction=vec2(1,0)] - Direction of aberration when radial=0
 * @returns {vec4} The chromatic aberration processed color
 */
export const chromaticAberrationEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 0.01, radial = 0.5, direction = vec2(0, 0) } = props || {}

  // We need to use the built-in uv() here to work as a post-processing effect
  const _uv = inputUV().toVar()

  const _strength = float(strength)
  const _radial = float(radial)
  const _direction = direction.toVar()

  // Calculate offset direction
  const center = vec2(0.5, 0.5).toVar()
  const toCenter = _uv.sub(center).toVar()
  const dist = length(toCenter).toVar()

  // Mix between directional and radial
  const radialDir = normalize(toCenter).toVar()
  const offsetDir = normalize(_direction.mul(float(1).sub(_radial)).add(radialDir.mul(_radial))).toVar()

  // Create different offsets for each channel
  const offset = offsetDir.mul(_strength).mul(dist.add(0.5)).toVar()

  const rOffset = _uv.add(offset.mul(1.0)).toVar()
  const gOffset = _uv.toVar()
  const bOffset = _uv.sub(offset.mul(1.0)).toVar()

  // Sample input texture at different offsets for each channel
  const rSample = input.sample(rOffset)
  const gSample = input.sample(gOffset)
  const bSample = input.sample(bOffset)

  // Combine RGB channels with original alpha
  return vec4(rSample.r, gSample.g, bSample.b, input.sample(_uv).a)
})
