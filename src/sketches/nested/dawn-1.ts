/**
 * @license Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)
 *
 * This sketch is licensed under CC BY-NC-SA 4.0. You are free to:
 * - Share and adapt this work
 * - Use modified versions commercially
 *
 * Under these conditions:
 * - Attribution: Credit Ben McCormick (phobon) and link to this project
 * - NonCommercial: Don't sell the original, unmodified sketch
 * - ShareAlike: Distribute derivatives under the same license
 */

import { Fn, screenSize, vec3, fract, pow, time } from 'three/tsl'
import { cosinePalette } from '@/tsl/utils/color/cosine_palette'
import { screenAspectUV } from '@/tsl/utils/function/screen_aspect_uv'
import { grainTextureEffect } from '@/tsl/effects/grain_texture_effect'

/**
 * A gradient sketch tribute to Rik Oostenbroek.
 */
export const dawn1 = Fn(() => {
  // Get aspect-corrected UVs for the screen
  const _uv = screenAspectUV(screenSize).toVar()
  const uv0 = screenAspectUV(screenSize).toVar()

  // Color accumulator
  const finalColor = vec3(0.0).toVar()

  // Palette setup
  const a = vec3(0.5, 0.5, 0.5)
  const b = vec3(0.5, 0.5, 0.5)
  const c = vec3(1.0, 1.0, 0.5)
  const d = vec3(0.8, 0.9, 0.3)

  // Animated vertical gradient using cosine palette
  const col = cosinePalette(uv0.y.add(0.5).add(time.mul(0.01)), a, b, c, d)

  // Repeated sawtooth pattern in Y, softened
  const repeatedPattern = fract(_uv.y.mul(24)).mul(0.3)

  // Add pattern to color, boost with pow for punch
  finalColor.assign(col.add(pow(repeatedPattern, 2.0)))

  // Add grain for texture
  const _grain = grainTextureEffect(_uv).mul(0.2)
  finalColor.addAssign(_grain)

  return finalColor
})

export default dawn1
