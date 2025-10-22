import { Fn, smoothstep, pow, uv } from 'three/tsl'
import { sdSphere } from '@/tsl/utils/sdf/shapes'

/**
 * Creates a vignette effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.smoothing=0.25] - The smoothing of the vignette.
 * @param {number} [props.exponent=5] - The exponent of the vignette.
 * @returns {vec4} The vignette processed color
 */
export const vignetteEffect = Fn((props) => {
  const { input, inputUV = uv, smoothing = 0.25, exponent = 5 } = props || {}

  const _uv = inputUV().toVar()
  const centeredUV = _uv.sub(0.5).toVar()
  const vignette = smoothstep(smoothing, 1, sdSphere(centeredUV)).oneMinus()
  const vignetteMask = pow(vignette, exponent).toVar()

  const originalColor = input.sample(_uv)
  return originalColor.mul(vignetteMask)
})
