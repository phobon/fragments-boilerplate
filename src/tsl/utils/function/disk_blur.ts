// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { cos, dot, Fn, float, fract, sin, vec2, vec4 } from 'three/tsl'

/**
 * Number of taps in the disk kernel. Compile-time constant so the loop unrolls
 * into a fixed set of texture samples (offsets + weights are baked as plain JS
 * numbers). 64 keeps large/aggressive radii smooth; combined with the per-pixel
 * rotation below it avoids the concentric banding a sparse fixed pattern shows.
 */
const SAMPLE_COUNT = 64

/** Golden angle (radians). Spacing successive taps by this gives an even, low-discrepancy disk. */
const GOLDEN_ANGLE = 2.399963229728653
const TAU = 6.283185307179586

/**
 * Pre-computed sample offsets + gaussian weights for a unit disk.
 *
 * Samples sit on a Vogel/golden-angle spiral: the i-th tap is at radius
 * sqrt((i+0.5)/N) (equal-area, evenly covering the disk) and angle
 * i * GOLDEN_ANGLE, weighted by a gaussian falloff in the squared radius so the
 * result approximates a true gaussian rather than a flat bokeh disk.
 */
const KERNEL = Array.from({ length: SAMPLE_COUNT }, (_, i) => {
  const t = (i + 0.5) / SAMPLE_COUNT
  const r = Math.sqrt(t)
  const a = i * GOLDEN_ANGLE
  return {
    ox: Math.cos(a) * r,
    oy: Math.sin(a) * r,
    weight: Math.exp(-2.0 * t),
  }
})

/**
 * Gaussian-weighted disk blur over a sampled texture.
 *
 * Blur is a gather: each output pixel reads many neighbouring texels, so it only
 * works on something already available as a texture (here, the scene `input`).
 * The blur amount is a per-fragment `radius`, which is what lets callers vary it
 * across the frame (progressive, radial, tilt-shift) from this one kernel.
 *
 * The whole sample spiral is rotated by a per-pixel pseudo-random angle. A fixed
 * spiral aliases into visible concentric arcs once the radius is large; rotating
 * it per pixel converts that structured banding into fine noise, which reads as a
 * smooth blur even at aggressive radii.
 *
 * @param {Texture} input - The input color texture to sample.
 * @param {vec2} centerUV - UV coordinate at the centre of the kernel.
 * @param {vec2} radius - Blur radius in UV units, per axis (aspect-corrected by the
 *   caller so the disk stays circular). A radius of ~0 returns the source pixel.
 * @returns {vec4} The blurred color.
 */
export const diskBlur = Fn(([input, centerUV, radius]) => {
  const color = vec4(0.0).toVar()
  const total = float(0.0).toVar()

  // Per-pixel rotation of the sample spiral (hash → angle → rotation matrix).
  const hash = fract(sin(dot(centerUV, vec2(12.9898, 78.233))).mul(43758.5453)).toVar()
  const angle = hash.mul(TAU).toVar()
  const cosA = cos(angle).toVar()
  const sinA = sin(angle).toVar()

  for (const { ox, oy, weight } of KERNEL) {
    const rotated = vec2(cosA.mul(ox).sub(sinA.mul(oy)), sinA.mul(ox).add(cosA.mul(oy)))
    color.addAssign(input.sample(centerUV.add(radius.mul(rotated))).mul(weight))
    total.addAssign(weight)
  }

  return color.div(total)
})
