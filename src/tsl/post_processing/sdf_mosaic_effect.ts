// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, floor, fract, mix, screenSize, select, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl'
import { sdDiamond, sdEquilateralTriangle, sdSphere } from '../utils/sdf/shapes'

/**
 * Creates an SDF-glyph mosaic effect for post-processing: the image is broken
 * into cells and each cell is rebuilt from a signed-distance glyph chosen by
 * the cell's luminance band (dark → circle, mid → diamond, light → triangle),
 * sized by inverse luminance — the per-cell SDF-pattern idea from Maxime
 * Heckel's post-processing article, reusing this repo's `utils/sdf/shapes`.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - UV node function to sample at
 * @param {number} [props.cells=40] - Cells across the aspect-corrected width
 * @param {number} [props.smoothness=0.05] - Edge softness of the glyphs
 * @param {vec3} [props.inkColor=vec3(0,0,0)] - Glyph colour
 * @param {vec3} [props.paperColor=vec3(1,1,1)] - Background colour
 * @param {boolean} [props.useSourceColor=false] - Draw glyphs in the source colour instead of inkColor
 * @returns {vec4} The SDF-mosaic processed color, original alpha preserved
 */
export const sdfMosaicEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    cells = 40,
    smoothness = 0.05,
    inkColor = null,
    paperColor = null,
    useSourceColor = false,
  } = props || {}

  const _uv = inputUV().toVar()
  const _cells = float(cells)
  const _sm = float(smoothness)

  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  const grid = aspectUV.mul(_cells).toVar()
  const cellId = floor(grid).toVar()
  const cellUV = fract(grid).toVar()

  const cc = cellId.add(0.5).div(_cells).toVar()
  const sampleUV = vec2(cc.x.div(aspect), cc.y).toVar()
  const src = input.sample(sampleUV)

  const luma = dot(src.rgb, vec3(0.299, 0.587, 0.114)).toVar()
  const coverage = luma.oneMinus().toVar()

  const p = cellUV.sub(0.5).toVar() // -0.5..0.5 within the cell
  const r = coverage.mul(0.5).toVar() // glyph grows as the cell darkens

  // Evaluate the candidate glyphs, then pick one by luminance band.
  const sdC = sdSphere(p, r).toVar()
  const sdD = sdDiamond(p, r).toVar()
  const sdT = sdEquilateralTriangle(p, r).toVar()
  const sd = select(luma.lessThan(0.33), sdC, select(luma.lessThan(0.66), sdD, sdT)).toVar()

  const fill = smoothstep(_sm, _sm.negate(), sd).toVar() // 1 inside the glyph

  const _ink = inkColor ? vec3(inkColor) : vec3(0, 0, 0)
  const _paper = paperColor ? vec3(paperColor) : vec3(1, 1, 1)
  const finalColor = useSourceColor ? mix(_paper, src.rgb, fill) : mix(_paper, _ink, fill)

  return vec4(finalColor, src.a)
})
