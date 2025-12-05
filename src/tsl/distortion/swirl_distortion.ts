import { Fn, vec2, float, length, atan2, sin, cos, oneMinus } from 'three/tsl'

type SwirlDistortionOptions = {
  strength?: ReturnType<typeof float>
  radius?: ReturnType<typeof float>
  center?: ReturnType<typeof vec2>
}

/**
 * Applies a swirl distortion to UV coordinates.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.strength=1.0] - Strength of the rotation (angle multiplier)
 * @param {number} [options.radius=0.5] - Radius at which the effect reaches maximum strength
 * @param {vec2} [options.center=vec2(0.0, 0.0)] - Center point of the swirl effect
 * @returns {vec2} Distorted UV coordinates
 */
export const swirlDistortion = Fn(([_uv, options = {}]) => {
  const { strength = float(1), radius = float(0.5), center = vec2(0) } = options as SwirlDistortionOptions
  const uv = _uv.toVar()
  const offset = uv.sub(center).toVar()
  const dist = length(offset).toVar()

  // Calculate angle and apply rotation based on distance from center
  const angle = atan2(offset.y, offset.x).toVar()
  const rotation = angle.add(strength.mul(oneMinus(dist.div(radius)))).toVar()

  // Use the rotation to create new offset position
  const rotatedOffset = vec2(dist.mul(cos(rotation)), dist.mul(sin(rotation))).toVar()

  // Return the new UV position
  const distortedUV = center.add(rotatedOffset)

  return distortedUV
})
