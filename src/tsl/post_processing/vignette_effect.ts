import { Fn, smoothstep, pow } from 'three/tsl'
import { sdSphere } from '@/tsl/utils/sdf/shapes'

/**
 * Creates a vignette effect given the current UV coordinates.
 * @param {vec2} _uv - The UV coordinates.
 * @param {number} [smoothing=0.45] - The smoothing of the vignette.
 * @param {number} [exponent=1.2] - The exponent of the vignette.
 * @returns {float} The vignette effect value.
 */
export const vignetteEffect = Fn(([_uv, smoothing = 0.45, exponent = 1.2]) => {
  const vignette = smoothstep(smoothing, 1, sdSphere(_uv)).oneMinus()
  return pow(vignette, exponent)
})
