import { Fn, smoothstep, pow } from 'three/tsl'
import { sdSphere } from '@/tsl/utils/sdf/shapes'

type VignettePatternOptions = {
  smoothing?: number
  exponent?: number
}

/**
 * Creates a vignette pattern given the current UV coordinates.
 * @param {vec2} _uv - The UV coordinates.
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.smoothing=0.45] - The smoothing of the vignette.
 * @param {number} [options.exponent=1.2] - The exponent of the vignette.
 * @returns {float} The vignette pattern value.
 */
export const vignettePattern = Fn(([_uv, options = {}]) => {
  const { smoothing = 0.45, exponent = 1.2 } = options as VignettePatternOptions
  const vignette = smoothstep(smoothing, 1, sdSphere(_uv)).oneMinus()
  return pow(vignette, exponent)
})
