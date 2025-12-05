import { Fn, vec2, float, uv } from 'three/tsl'
import { swirlDistortion } from '@/tsl/distortion/swirl_distortion'

/**
 * Creates a swirl/twirl distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=1.0] - Strength of the rotation (angle multiplier)
 * @param {number} [props.radius=0.5] - Radius at which the effect reaches maximum strength
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Center point of the swirl effect
 * @returns {vec4} The swirled/distorted color
 */
export const swirlDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 1.0, radius = 0.5, center = vec2(0.5) } = props || {}

  const _uv = inputUV().toVar()
  const distortedUV = swirlDistortion(_uv, {
    strength: float(strength),
    radius: float(radius),
    center,
  })

  return input.sample(distortedUV)
})
