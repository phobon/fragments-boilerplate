import { Fn, float, sin, pow, mix, uv } from 'three/tsl'

/**
 * Creates a CRT monitor scanline effect with optional barrel distortion for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates to sample from (defaults to built-in uv)
 * @param {number} [props.lineFrequency=300] - Frequency of scanlines
 * @param {number} [props.lineIntensity=0.3] - Intensity/darkness of scanlines (0-1)
 * @param {number} [props.curvature=0.2] - Amount of barrel distortion (0-1)
 * @param {number} [props.scanlineSharpness=0.3] - Sharpness of the scanline effect (0-1)
 * @returns {vec4} The CRT scanline processed color
 */
export const crtScanlineEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    lineFrequency = 200,
    lineIntensity = 0.3,
    curvature = 0.2,
    scanlineSharpness = 0.5,
  } = props || {}

  const _uv = inputUV().toVar()

  const _lineFrequency = float(lineFrequency)
  const _lineIntensity = float(lineIntensity)
  const _curvature = float(curvature)
  const _scanlineSharpness = float(scanlineSharpness)

  // Apply barrel distortion if curvature > 0
  const centered = _uv.sub(0.5).toVar()
  const distortion = centered.mul(_curvature.mul(centered.dot(centered))).toVar()
  const distortedUV = _uv.add(distortion).toVar()

  // Create horizontal scanlines
  const scanline = sin(distortedUV.y.mul(_lineFrequency).mul(3.14159)).toVar()
  const scanlinePattern = pow(scanline.mul(0.5).add(0.5), _scanlineSharpness).toVar()

  // Mix between full brightness and darkened by intensity
  const effect = mix(float(1.0).sub(_lineIntensity), float(1.0), scanlinePattern).toVar()

  const originalColor = input.sample(_uv)
  return originalColor.mul(effect)
})
