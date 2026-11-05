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

import { abs, Fn, floor, Loop, mul, oneMinus, PI, screenSize, sin, uv, vec2, vec3 } from 'three/tsl'
import { grainTexturePattern } from '@/tsl/patterns/grain_texture_pattern'
import { contrastAdjustment } from '@/tsl/post_processing/contrast_adjustment'
import { hueRotateAdjustment } from '@/tsl/post_processing/hue_rotate_adjustment'
import { pixellationEffect } from '@/tsl/post_processing/pixellation_effect'
import type { PostProcessingProps } from '@/tsl/post_processing/post_processing'
import { saturationAdjustment } from '@/tsl/post_processing/saturation_adjustment'
import { cosinePalette } from '@/tsl/utils/color/cosine_palette'
import { screenAspectUV } from '@/tsl/utils/function/screen_aspect_uv'

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
  const g = grainTexturePattern(uv0).mul(0.1)
  finalColor.addAssign(g)

  return finalColor
})

export const postProcessing = {
  layers: [
    { effect: contrastAdjustment, args: { amount: 1.2 } },
    { effect: saturationAdjustment, args: { amount: 1.4 } },
    { effect: hueRotateAdjustment, args: { angle: 0.1 } },
    { effect: pixellationEffect, args: { size: 10 } },
  ],
} satisfies PostProcessingProps

export default flare1
