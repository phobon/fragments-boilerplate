// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { atan, cos, Fn, float, length, oneMinus, sin, vec2 } from 'three/tsl'

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
  const _strength = float(strength)
  const _radius = float(radius)
  const uv = _uv.toVar()
  const _center = vec2(center).sub(0.5).toVar()
  const offset = uv.sub(_center).toVar()
  const dist = length(offset).toVar()

  // Calculate angle and apply rotation based on distance from center
  const angle = atan(offset.y, offset.x).toVar()
  const rotation = angle.add(_strength.mul(oneMinus(dist.div(_radius)))).toVar()

  // Use the rotation to create new offset position
  const rotatedOffset = vec2(dist.mul(cos(rotation)), dist.mul(sin(rotation))).toVar()

  // Return the new UV position
  const distortedUV = _center.add(rotatedOffset)

  return distortedUV
})
