// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  abs,
  cos,
  dot,
  Fn,
  float,
  fract,
  fwidth,
  mix,
  screenSize,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

/**
 * Creates a line halftone pattern effect (Illustrator Sketch → Halftone Pattern: Line),
 * where parallel line thickness is modulated by local luminance.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates to sample from (defaults to built-in uv)
 * @param {number} [props.frequency=80] - Frequency of lines (lines per unit)
 * @param {number} [props.angle=0] - Rotation angle of lines in radians (0 = horizontal)
 * @param {number} [props.smoothness=0.15] - Extra edge softness added on top of the fwidth edge
 * @param {vec3} [props.inkColor=vec3(0,0,0)] - Color of the lines (dark areas)
 * @param {vec3} [props.paperColor=vec3(1,1,1)] - Color of the background (bright areas)
 * @param {boolean} [props.useSourceColor=false] - If true, use source image colors instead of inkColor/paperColor
 * @returns {vec4} The line halftone processed color with original alpha
 */
export const lineHalftoneEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    frequency = 80,
    angle = 0,
    smoothness = 0.15,
    inkColor = null,
    paperColor = null,
    useSourceColor = false,
  } = props || {}

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

  // Create line pattern using rotated Y coordinate
  const t = fract(rotatedUV.y.mul(_frequency)).toVar()
  const d = abs(t.sub(0.5).mul(2)).toVar()

  // Sample original color and compute luminance
  const originalColor = input.sample(_uv)
  const luma = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114)).toVar()

  // Coverage is driven by luminance: dark areas have high coverage, bright areas have low coverage.
  // Line ink area scales linearly with thickness, so (unlike round dots) linear coverage is already
  // perceptually correct here — no sqrt needed.
  const cov = float(1).sub(luma).toVar()

  // Resolution- & frequency-independent edge via fwidth, so line boundaries
  // stay a consistent ~1px regardless of frequency / render resolution.
  const edge = fwidth(d).mul(1.5).add(_smoothness).toVar()
  const mask = smoothstep(cov.sub(edge), cov.add(edge), d).toVar()

  // Determine output colors based on useSourceColor flag
  let finalColor
  if (useSourceColor) {
    finalColor = mix(originalColor.rgb, vec3(1), mask)
  } else {
    const _inkColor = inkColor ? vec3(inkColor) : vec3(0, 0, 0)
    const _paperColor = paperColor ? vec3(paperColor) : vec3(1, 1, 1)
    finalColor = mix(_inkColor, _paperColor, mask)
  }

  return vec4(finalColor, originalColor.a)
})
