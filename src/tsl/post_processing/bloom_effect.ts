// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { cos, dot, Fn, float, fract, max, screenSize, sin, uv, vec2, vec4 } from 'three/tsl'

/**
 * Number of taps in the disk kernel. Compile-time constant so the loop unrolls
 * into a fixed set of texture samples (offsets + weights are baked as plain JS
 * numbers). Mirrors `disk_blur.ts`'s SAMPLE_COUNT.
 */
const SAMPLE_COUNT = 64

/** Golden angle (radians). Spacing successive taps by this gives an even, low-discrepancy disk. */
const GOLDEN_ANGLE = 2.399963229728653
const TAU = 6.283185307179586

/**
 * Pre-computed sample offsets + gaussian weights for a unit disk. Same
 * Vogel/golden-angle spiral as `disk_blur.ts`'s KERNEL.
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
 * Gaussian-weighted disk blur that thresholds each tap BEFORE accumulating,
 * rather than blurring first and thresholding the result. This is what keeps
 * dim/mid-tone regions and filament detail crisp while only bright cores
 * halate — blurring first and thresholding after would soften everything
 * indiscriminately (see `gaussian_blur_effect.ts` for the non-thresholded
 * version of this kernel).
 *
 * @param {Texture} input - The input color texture to sample.
 * @param {vec2} centerUV - UV coordinate at the centre of the kernel.
 * @param {vec2} radius - Blur radius in UV units, per axis (aspect-corrected by the
 *   caller so the disk stays circular).
 * @param {float} threshold - Brightness cutoff below which a tap contributes nothing.
 * @returns {vec4} The thresholded, blurred bloom color.
 */
const thresholdedDiskBlur = Fn(([input, centerUV, radius, threshold]) => {
  const color = vec4(0.0).toVar()
  const total = float(0.0).toVar()

  // Per-pixel rotation of the sample spiral (hash → angle → rotation matrix).
  const hash = fract(sin(dot(centerUV, vec2(12.9898, 78.233))).mul(43758.5453)).toVar()
  const angle = hash.mul(TAU).toVar()
  const cosA = cos(angle).toVar()
  const sinA = sin(angle).toVar()

  for (const { ox, oy, weight } of KERNEL) {
    const rotated = vec2(cosA.mul(ox).sub(sinA.mul(oy)), sinA.mul(ox).add(cosA.mul(oy)))
    const tap = input.sample(centerUV.add(radius.mul(rotated)))
    const bright = max(tap.rgb.sub(threshold), 0).div(max(float(1).sub(threshold), 1e-4))
    color.addAssign(vec4(bright, 1).mul(weight))
    total.addAssign(weight)
  }

  return color.div(total)
})

/**
 * Thresholded bloom effect.
 *
 * Halates bright cores while leaving darker filaments/detail crisp: the
 * threshold is applied per-tap inside the blur kernel (see
 * `thresholdedDiskBlur`), not to the blurred result, so only pixels near or
 * above `threshold` contribute to the glow. `radius` is expressed as a
 * fraction of screen height and aspect-corrected on the x axis, keeping the
 * bloom circular on any viewport (same convention as `gaussian_blur_effect.ts`).
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.threshold=0.6] - Brightness cutoff below which a tap contributes nothing
 * @param {number} [props.radius=0.04] - Bloom radius as a fraction of screen height
 * @param {number} [props.intensity=1.2] - Multiplier applied to the bloom before adding it back
 * @returns {vec4} The original color with a thresholded bloom added
 */
export const bloomEffect = Fn((props) => {
  const { input, inputUV = uv, threshold = 0.6, radius = 0.04, intensity = 1.2 } = props || {}

  const _uv = inputUV().toVar()
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const _radius = vec2(float(radius).div(aspect), float(radius)).toVar()

  const blurred = thresholdedDiskBlur(input, _uv, _radius, float(threshold))

  return vec4(input.sample(_uv).rgb.add(blurred.rgb.mul(intensity)), 1)
})
