// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  abs,
  cos,
  dot,
  Fn,
  float,
  floor,
  fract,
  mix,
  pow,
  screenSize,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

const hash21 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123))

/**
 * Creates a monochrome pen-and-ink "Graphic Pen" effect (Illustrator Sketch > Graphic Pen),
 * rebuilding the image from fine, single-direction diagonal strokes: dense overlapping
 * hatching in dark areas, paper-white in the highlights.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.frequency=220] - Density of the stroke lines (rows per unit, along the rotated axis)
 * @param {number} [props.angle=Math.PI/4] - Stroke direction, in radians (default 45 degrees)
 * @param {number} [props.strokeWidth=0.35] - Base width/spread of ink strokes; larger values merge strokes into darker fills
 * @param {number} [props.contrast=1.0] - Exponent applied to luminance before shaping (lower = darker/denser overall, higher = lighter/sparser)
 * @param {vec3|Array<number>} [props.inkColor=[0.05, 0.05, 0.06]] - Color of the ink strokes
 * @param {vec3|Array<number>} [props.paperColor=[0.96, 0.95, 0.92]] - Color of the untouched paper
 * @returns {vec4} The graphic-pen processed color
 */
export const graphicPenEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    frequency = 220,
    angle = Math.PI / 4,
    strokeWidth = 0.35,
    contrast = 1.0,
    inkColor = vec3(0.05, 0.05, 0.06),
    paperColor = vec3(0.96, 0.95, 0.92),
  } = props || {}

  const _uv = inputUV().toVar()

  const _frequency = float(frequency)
  const _angle = float(angle)
  const _strokeWidth = float(strokeWidth)
  const _contrast = float(contrast)
  const _inkColor = Array.isArray(inkColor) ? vec3(inkColor[0], inkColor[1], inkColor[2]) : inkColor
  const _paperColor = Array.isArray(paperColor) ? vec3(paperColor[0], paperColor[1], paperColor[2]) : paperColor

  // Aspect correct UV coordinates so strokes read at a consistent angle on screen
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Rotate UV coordinates to the stroke direction
  const c = cos(_angle).toVar()
  const s = sin(_angle).toVar()
  const rotatedUV = vec2(dot(aspectCorrectedUV, vec2(c, s.negate())), dot(aspectCorrectedUV, vec2(s, c))).toVar()

  // Strokes are thin lines along the rotated x axis, broken into dashes with noise
  const sy = rotatedUV.y.mul(_frequency).toVar()
  const f = fract(sy).toVar()
  const d = abs(f.sub(0.5)).mul(2).toVar()
  const row = floor(sy).toVar()

  // Along-stroke variation: coarse hash for dash breakup, finer hash for jaggedness
  const coarseHash = hash21(vec2(floor(rotatedUV.x.mul(_frequency).mul(0.35)), row)).toVar()
  const fineHash = hash21(vec2(floor(rotatedUV.x.mul(_frequency).mul(2.5)), row.mul(3.17))).toVar()
  const n = coarseHash.mul(0.7).add(fineHash.mul(0.3)).toVar()

  const originalColor = input.sample(_uv)
  const rawLuma = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114)).toVar()
  const luma = pow(rawLuma.max(0.0001), _contrast).toVar()

  // Bright luma -> almost no ink, dark luma -> wide merged strokes
  const jaggedD = d.mul(mix(0.75, 1.25, n)).toVar()
  const ink = smoothstep(luma.add(_strokeWidth), luma.sub(_strokeWidth), jaggedD).toVar()

  const finalColor = mix(_paperColor, _inkColor, ink)

  return vec4(finalColor, originalColor.a)
})
