import { Fn, mix, vec2 } from 'three/tsl'

import { vignettePattern } from '../../../patterns/vignette_pattern'

/**
 * Darkens a color toward the frame edges using the existing vignette
 * pattern (patterns/vignette_pattern.ts) — the uv-dependent member of this
 * set, so it takes the sampling uv too.
 * @param {vec3} _color Input color vector
 * @param {vec2} _uv The uv the color was sampled at (0..1)
 * @param {float} _amount 0 = unchanged, 1 = full-strength vignette
 * @param {Object} [options] Optional pattern shape config
 * @param {number} [options.smoothing=0.45] Falloff start (see vignettePattern)
 * @param {number} [options.exponent=1.2] Falloff exponent (see vignettePattern)
 * @returns {vec3} Adjusted color
 */
export const vignette = Fn(([_color, _uv, _amount, options = null]) => {
  // vignettePattern expects centered uv (its sdSphere is about the origin)
  const centered = _uv.sub(vec2(0.5, 0.5))
  const shade = vignettePattern(centered, options)
  return _color.mul(mix(1.0, shade, _amount))
})
