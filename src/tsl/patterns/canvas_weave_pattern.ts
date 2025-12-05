import { fbm } from '@/tsl/noise/fbm'
import { Fn, fract, sin, PI, vec3, smoothstep, mix } from 'three/tsl'

/**
 * Returns a canvas weave pattern value for a given UV coordinate.
 * @param {vec2} _uv - The UV coordinates.
 */
export const canvasWeavePattern = Fn(([_uv]) => {
  const grid = fract(_uv.mul(200.0))

  // Add noise to warp the grid itself
  const noiseOffset = fbm(vec3(_uv.mul(30.0), 0.0), { octaves: 3 }).mul(0.1)
  const warpedGrid = grid.add(noiseOffset)

  // Create irregular weave pattern
  const weaveX = sin(warpedGrid.x.mul(PI).add(fbm(vec3(_uv.mul(100.0), 0.0), { octaves: 2 }).mul(0.5)))
  const weaveY = sin(
    warpedGrid.y.mul(PI).add(fbm(vec3(_uv.mul(100.0).add(0.5), 0.0), { octaves: 2 }).mul(0.5)),
  )

  // Soften the intersections
  const weave = weaveX.mul(weaveY)
  const smoothedWeave = smoothstep(-0.3, 0.3, weave)

  return mix(0.9, 1.0, smoothedWeave)
})
