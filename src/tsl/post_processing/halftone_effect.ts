// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  cos,
  dot,
  Fn,
  float,
  fract,
  fwidth,
  length,
  screenSize,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

/**
 * Creates a halftone dot pattern effect for print/comic book aesthetics in post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.frequency=100] - Frequency of the halftone dots
 * @param {number} [props.angle=0.5] - Rotation angle of the pattern (radians)
 * @param {number} [props.smoothness=0.1] - Extra edge softness added on top of the
 *   resolution-adaptive fwidth edge. Set low (0–0.02) for crisp dots.
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

  // Dot radius from coverage: a dot's ink area grows with r², so radius ∝
  // sqrt(coverage) keeps the tonal response perceptually linear (the same
  // mapping colorHalftoneEffect already uses). Replaces the old linear
  // brightness→radius mapping, which crushed the midtones.
  const dotSize = brightness.max(0).sqrt().mul(0.7).add(0.1).toVar()

  const dist = length(gridUV).toVar()

  // Resolution- & frequency-independent edge: fwidth(dist) is ~one pixel wide
  // in grid space at any zoom, so dots stay crisp instead of smearing when the
  // frequency or the render resolution changes. _smoothness adds optional
  // extra softness on top of that adaptive band.
  const edge = fwidth(dist).mul(1.5).add(_smoothness).toVar()
  const d = smoothstep(dotSize.add(edge), dotSize.sub(edge), dist).toVar()

  const finalColor = color ? vec3(d).mul(color) : vec3(d).mul(originalColor.rgb)

  return vec4(finalColor, originalColor.a)
})
