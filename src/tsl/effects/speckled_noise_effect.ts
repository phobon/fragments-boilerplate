import { Fn, vec2, vec3, step } from 'three/tsl'
import { simplexNoise3d } from '@/tsl/noise/simplex_noise_3d'
import { fbm } from '@/tsl/noise/fbm'

/**
 * Returns a speckle texture value for a given UV coordinate.
 * @param {vec2} _uv - The UV coordinates.
 * @param {float} density - The density of the speckles.
 */
export const speckedNoiseEffect = Fn(([_uv, density = 0.75, warpAmount = vec2(80, 120)]) => {
  // Warp the UVs for organic distribution
  const warpX = fbm(vec3(_uv.mul(3.0), 0.0))
  const warpY = fbm(vec3(_uv.mul(3.0).add(100.0), 0.0))
  const warp = vec2(warpX, warpY).sub(0.5).mul(0.1)

  const warpedUV = _uv.add(warp)

  // Create very sparse speckles using multiple noise samples
  const noise1 = simplexNoise3d(vec3(warpedUV.mul(warpAmount.x), 0.0))
  const noise2 = simplexNoise3d(vec3(warpedUV.mul(warpAmount.y).add(50.0), 0.0))

  // Both noise values must be very high to create a speckle
  const speckles = step(density, noise1).mul(step(density, noise2))

  return speckles
})
