import { Fn, vec2, vec3, float, sin, cos, fract, length, smoothstep, dot, vec4, uv, screenSize } from 'three/tsl'

/**
 * Creates a halftone dot pattern effect for print/comic book aesthetics in post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.frequency=20] - Frequency of the halftone dots
 * @param {number} [props.angle=0.785] - Rotation angle of the pattern (radians, default ~45 degrees)
 * @param {number} [props.smoothness=0.05] - Edge smoothness of the dots
 * @returns {vec4} The halftone processed color
 */
export const halftoneEffect = Fn((props) => {
  const { input, inputUV = uv, frequency = 100, angle = 0.5, smoothness = 0.1, color = null } = props || {}

  const _uv = inputUV().toVar()

  const _frequency = float(frequency)
  const _angle = float(angle)
  const _smoothness = float(smoothness)

  // Aspect correct UV coordinates
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Rotate UV coordinates
  const c = cos(_angle).toVar()
  const s = sin(_angle).toVar()
  const rotatedUV = vec2(dot(aspectCorrectedUV, vec2(c, s.negate())), dot(aspectCorrectedUV, vec2(s, c))).toVar()

  // Create grid
  const gridUV = fract(rotatedUV.mul(_frequency)).sub(0.5).toVar()

  const originalColor = input.sample(_uv)
  const brightness = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114)).toVar()

  // Create dots with size based on brightness
  const dotSize = brightness.mul(0.7).add(0.15).toVar()
  const dist = length(gridUV).toVar()
  const d = smoothstep(dotSize.add(_smoothness), dotSize.sub(smoothness), dist).toVar()

  const finalColor = color ? vec3(d).mul(color) : vec3(d).mul(originalColor.rgb)

  return vec4(finalColor, originalColor.a)
})
