import { Fn, floor, float, uv, screenSize, vec2 } from 'three/tsl'

/**
 * Creates a pixellation effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates to sample from (defaults to built-in uv)
 * @param {number} [props.size=20.0] - Size of the pixellation blocks (higher values = larger pixels)
 * @returns {vec4} The pixellated color
 */
export const pixellationEffect = Fn((props) => {
  const { input, inputUV = uv, size = 20.0 } = props || {}

  const _uv = inputUV().toVar()
  const _size = float(size)

  // Aspect correct UV coordinates
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Create pixelated UV coordinates
  const pixelSize = _size.div(1000.0) // Normalize to reasonable range
  const pixelatedUV = floor(aspectCorrectedUV.div(pixelSize)).mul(pixelSize).toVar()

  // Reverse aspect correction for sampling
  const samplingUV = vec2(pixelatedUV.x.div(aspect), pixelatedUV.y).toVar()

  return input.sample(samplingUV)
})
