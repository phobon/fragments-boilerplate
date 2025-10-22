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

import { abs, Fn, oneMinus, screenSize, uv, vec3, floor, sin, PI, mul, Loop, vec2 } from 'three/tsl'
import { cosinePalette } from '@/tsl/utils/color/cosine_palette'
import { screenAspectUV } from '@/tsl/utils/function/screen_aspect_uv'
import { grainTextureEffect } from '@/tsl/effects/grain_texture_effect'
/**
 * A gradient sketch with fractionated coordinates.
 */
const flare1 = Fn(() => {
  // Get aspect-corrected UVs for the screen
  const _uv = screenAspectUV(screenSize)
  const uv0 = uv().toVar()

  // Color accumulator
  const finalColor = vec3(0).toVar()

  // Palette setup
  const a = vec3(0.5, 0.5, 0.5)
  const b = vec3(0.5, 0.5, 0.5)
  const c = vec3(2.0, 1.0, 0.0)
  const d = vec3(0.5, 0.2, 0.25)

  // Y-repeated pattern for banding
  const repetitions = 12
  const uvR = floor(_uv.y.mul(repetitions))

  // Sine wave for vertical offset
  const s = sin(uv0.y.mul(PI))

  // Loop over bands
  // @ts-ignore
  Loop({ start: 0, end: repetitions }, ({ i: _i }) => {
    const f = mul(uvR.mul(_i), 0.005)
    const offsetUv = vec2(_uv.x, _uv.y.add(f).add(mul(s, 0.05)))

    // Compound radial gradient
    const r = oneMinus(abs(offsetUv.x.mul(1.5))).add(abs(offsetUv.y.mul(1.5)))

    // Palette-based color
    const col = cosinePalette(uv0.y.mul(0.25), a, b, c, d)

    finalColor.assign(col.mul(r))
  })
  // Add grain for texture
  const g = grainTextureEffect(uv0).mul(0.1)
  finalColor.addAssign(g)

  return finalColor
})

export default flare1
