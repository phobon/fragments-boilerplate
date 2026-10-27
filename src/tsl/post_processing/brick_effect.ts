// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  clamp,
  dot,
  Fn,
  float,
  floor,
  fract,
  length,
  min,
  mix,
  normalize,
  screenSize,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

/**
 * Creates a Lego / toy-brick effect for post-processing: the image is
 * quantised into square studded blocks, each filled with a flat (colour-
 * quantised) sample, embossed with a central circular "stud" lit by a
 * directional light, and separated by dark grout gaps — the studded-pixel
 * effect from Maxime Heckel's post-processing article.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - UV node function to sample at
 * @param {number} [props.cells=40] - Bricks across the aspect-corrected width
 * @param {number} [props.studSize=0.5] - Diameter of the stud ring within a cell (0–1)
 * @param {number} [props.rimSoftness=0.12] - Softness / thickness of the stud rim highlight
 * @param {number} [props.grout=0.1] - Width of the dark gap between bricks (0–1 of a cell)
 * @param {number} [props.quantize=8] - Colour levels per channel for the flat brick fill (0 = no quantize)
 * @param {vec2} [props.lightDir=vec2(-0.5,0.6)] - Direction the stud is lit from
 * @returns {vec4} The brick processed color, original alpha preserved
 */
export const brickEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    cells = 40,
    studSize = 0.5,
    rimSoftness = 0.12,
    grout = 0.1,
    quantize = 8,
    lightDir = null,
  } = props || {}

  const _uv = inputUV().toVar()
  const _cells = float(cells)
  const _studSize = float(studSize)
  const _rim = float(rimSoftness)
  const _grout = float(grout)

  const L = normalize(lightDir ? vec2(lightDir) : vec2(-0.5, 0.6)).toVar()

  // Aspect-correct so bricks stay square.
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  const grid = aspectUV.mul(_cells).toVar()
  const cellId = floor(grid).toVar()
  const cellUV = fract(grid).toVar()

  // Flat block colour sampled once at the cell centre.
  const cellCenter = cellId.add(0.5).div(_cells).toVar()
  const sampleUV = vec2(cellCenter.x.div(aspect), cellCenter.y).toVar()
  const src = input.sample(sampleUV)

  // Colour quantisation → flat toy-brick palette.
  let baseRgb
  if (quantize > 0) {
    const q = float(quantize)
    baseRgb = floor(src.rgb.mul(q)).add(0.5).div(q).toVar()
  } else {
    baseRgb = src.rgb.toVar()
  }

  // Central stud: a lit ring at radius studSize/2 (article's lighting model).
  const toC = cellUV.sub(0.5).toVar()
  const lighting = dot(normalize(toC.add(1e-5)), L)
    .mul(0.7)
    .toVar()
  const dis = length(toC).mul(2).sub(_studSize).abs().toVar()
  const studRing = smoothstep(_rim, float(0), dis).toVar()
  const lit = studRing.mul(lighting).add(1).toVar()

  // Dark grout gaps at the four cell edges.
  const edge = min(min(cellUV.x, cellUV.y), min(cellUV.x.oneMinus(), cellUV.y.oneMinus())).toVar()
  const groutMask = smoothstep(float(0), _grout, edge).toVar()
  const groutShade = mix(float(0.35), float(1), groutMask).toVar()

  const rgb = baseRgb.mul(lit).mul(groutShade).toVar()
  return vec4(clamp(rgb, 0, 1), src.a)
})
