// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  cos,
  dot,
  Fn,
  float,
  floor,
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
 * Creates a receipt / thermal-printer bar effect for post-processing: each
 * cell draws a single horizontal bar whose length tracks the cell's inverse
 * luminance (dark → long bar, bright → short/none), on an optionally rotated
 * grid — the "receipt bar pattern" from Maxime Heckel's post-processing article.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - UV node function to sample at
 * @param {number} [props.cells=60] - Cells across the aspect-corrected width
 * @param {number} [props.angle=0] - Rotation of the bar grid in radians
 * @param {number} [props.thickness=0.7] - Vertical thickness of a bar within its cell (0–1)
 * @param {vec3} [props.inkColor=vec3(0,0,0)] - Bar colour
 * @param {vec3} [props.paperColor=vec3(1,1,1)] - Background colour
 * @param {boolean} [props.useSourceColor=false] - Draw bars in the source colour instead of inkColor
 * @returns {vec4} The receipt-bar processed color, original alpha preserved
 */
export const receiptBarsEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    cells = 60,
    angle = 0,
    thickness = 0.7,
    inkColor = null,
    paperColor = null,
    useSourceColor = false,
  } = props || {}

  const _uv = inputUV().toVar()
  const _cells = float(cells)
  const _angle = float(angle)
  const _thickness = float(thickness)

  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Rotate the grid by +angle.
  const c = cos(_angle).toVar()
  const s = sin(_angle).toVar()
  const rUV = vec2(aspectUV.x.mul(c).sub(aspectUV.y.mul(s)), aspectUV.x.mul(s).add(aspectUV.y.mul(c))).toVar()

  const grid = rUV.mul(_cells).toVar()
  const cellId = floor(grid).toVar()
  const cellUV = fract(grid).toVar()

  // Sample the source at the cell centre: rotate back by -angle, undo aspect.
  const ccR = cellId.add(0.5).div(_cells).toVar()
  const ccA = vec2(ccR.x.mul(c).add(ccR.y.mul(s)), ccR.x.mul(s).negate().add(ccR.y.mul(c))).toVar()
  const sampleUV = vec2(ccA.x.div(aspect), ccA.y).toVar()
  const src = input.sample(sampleUV)

  const luma = dot(src.rgb, vec3(0.299, 0.587, 0.114)).toVar()
  const coverage = luma.oneMinus().toVar() // dark → long bar

  // Resolution-independent AA on both axes.
  const aax = fwidth(cellUV.x).mul(1.5).toVar()
  const aay = fwidth(cellUV.y).mul(1.5).toVar()

  // bandX = 1 where cellUV.x < coverage; bandY = 1 inside the thickness band.
  const bandX = smoothstep(coverage.add(aax), coverage.sub(aax), cellUV.x).toVar()
  const yEdge = cellUV.y.sub(0.5).abs().toVar()
  const half = _thickness.mul(0.5).toVar()
  const bandY = smoothstep(half.add(aay), half.sub(aay), yEdge).toVar()
  const bar = bandX.mul(bandY).toVar()

  const _ink = inkColor ? vec3(inkColor) : vec3(0, 0, 0)
  const _paper = paperColor ? vec3(paperColor) : vec3(1, 1, 1)
  const finalColor = useSourceColor ? mix(_paper, src.rgb, bar) : mix(_paper, _ink, bar)

  return vec4(finalColor, src.a)
})
