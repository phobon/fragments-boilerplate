import { clamp, Fn, float, fract, length, pow, screenSize, smoothstep } from 'three/tsl'

/**
 * Creates an LED screen pattern with configurable parameters.
 * @param {vec2} [props.resolution=screenSize] - The render resolution
 * @param {number} [props.cellSize=10] - Controls the size of individual LED cells
 * @param {number} [props.intensity=0.5] - Controls the size of the LED elements within cells
 * @param {number} [props.intensityFalloff=1.8] - Controls the sharpness of the LED pattern edges
 * @param {number} [props.edgeSoftness=0.2] - Controls the smoothness of the LED pattern edges
 * @returns {float} The LED pattern value
 */
export const ledPattern = Fn(([_uv, options = null]) => {
  const {
    resolution = screenSize,
    cellSize = float(10),
    intensity = float(0.5),
    intensityFalloff = float(1.8),
    edgeSoftness = float(0.2),
  } = options || {}

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
  // pattern.assign(clamp(pattern, 0, 1))

  return pattern
})
