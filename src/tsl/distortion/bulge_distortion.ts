import { Fn, vec2, float, length, normalize, min, oneMinus, pow, smoothstep } from 'three/tsl'

type BulgeDistortionOptions = {
  strength?: ReturnType<typeof float>
  radius?: ReturnType<typeof float>
  power?: ReturnType<typeof float>
  center?: ReturnType<typeof vec2>
}

/**
 * Applies a bulge or pinch distortion to UV coordinates.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.strength=0.5] - Strength of the effect (positive=bulge, negative=pinch)
 * @param {number} [options.radius=0.5] - Radius of the distortion effect
 * @param {number} [options.power=1.0] - Power curve for the falloff (higher = stronger center effect)
 * @param {vec2} [options.center=vec2(0.0)] - Center point of the distortion
 * @returns {vec2} Distorted UV coordinates
 */
export const bulgeDistortion = Fn(([_uv, options = {}]) => {
  const {
    strength = float(0.5),
    radius = float(0.5),
    power = float(1.0),
    center = vec2(0),
  } = options as BulgeDistortionOptions
  const uv = _uv.toVar()
  const offset = uv.sub(center).toVar()
  const dist = length(offset).toVar()

  // Normalized distance within radius (0-1), smoothed to create a cleaner effect
  const normalizedDist = smoothstep(0, 1, min(dist.div(radius), 1)).toVar()

  // Use power curve to create stronger effect in the center
  const falloff = pow(oneMinus(normalizedDist), power).mul(strength)

  // Apply radial displacement
  const direction = normalize(offset)
  const displacedUV = center.add(direction.mul(dist.mul(falloff.add(float(1.0)))))

  return displacedUV
})
