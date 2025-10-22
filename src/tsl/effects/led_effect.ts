import { Fn, fract, pow, float, smoothstep, length, screenSize } from 'three/tsl'
import { screenAspectUV } from '@/tsl/utils/function/screen_aspect_uv'

/**
 * Creates an LED screen effect with configurable parameters.
 * @param {vec2} [props.resolution=screenSize] - The render resolution
 * @param {number} [props.cellSize=10] - Controls the size of individual LED cells
 * @param {number} [props.intensity=0.5] - Controls the size of the LED elements within cells
 * @param {number} [props.intensityFalloff=1.8] - Controls the sharpness of the LED pattern edges
 * @param {number} [props.edgeSoftness=0.2] - Controls the smoothness of the LED pattern edges
 * @returns {float} The LED effect pattern value
 */
export const ledEffect = Fn((props) => {
  const {
    resolution = screenSize,
    cellSize = float(10),
    intensity = float(0.5),
    intensityFalloff = float(1.8),
    edgeSoftness = float(0.2),
  } = props || {}

  const _uv = screenAspectUV(resolution).toVar()

  const _scaledRes = resolution.div(cellSize)

  _uv.assign(fract(_uv.mul(_scaledRes)).sub(0.5))
  // Diamond pattern
  // const pattern = abs(_uv.x.div(_intensity))
  //   .add(abs(_uv.y.div(_intensity)))
  //   .oneMinus()
  //   .toVar()

  // Square pattern
  // const pattern = max(abs(_uv.x.div(_intensity)), abs(_uv.y.div(_intensity)))
  //   .oneMinus()
  //   .toVar()

  // Circle pattern
  const pattern = length(_uv.div(intensity)).oneMinus().toVar()

  pattern.assign(smoothstep(edgeSoftness, 1, pattern))
  pattern.assign(pow(pattern, intensityFalloff))

  return pattern
})
