// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  Fn,
  float,
  floor,
  fract,
  length,
  mod,
  pow,
  screenSize,
  smoothstep,
  step,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

/**
 * Creates an LED / CRT screen-panel effect for post-processing. The image is
 * quantised into square cells; each cell is a rounded LED element, optionally
 * split into vertical R/G/B sub-pixel slices (aperture-grille look), with
 * brick-laid row staggering between columns and a soft per-cell border mask —
 * the "staggered LED panel" from Maxime Heckel's post-processing article.
 * @param {Object} props - The effect properties
 * @param {vec4} props.input - The input color texture from the scene
 * @param {number} [props.scalar=100] - Cell density (cells across the aspect-corrected width)
 * @param {number} [props.zoom=2] - Size of the round LED element within a cell
 * @param {number} [props.exponent=1.2] - Sharpness of the LED element edge
 * @param {number} [props.edge=0.1] - Threshold of the LED element
 * @param {number} [props.stagger=0.5] - Vertical brick-lay offset (cells) applied to alternate columns
 * @param {number} [props.border=0.6] - Strength of the per-cell border darkening (0 disables)
 * @param {boolean} [props.rgbSubpixels=true] - Split each cell into R/G/B vertical sub-pixel slices
 * @returns {vec4} The LED processed color
 */
export const ledEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    scalar = 100,
    zoom = 2,
    exponent = 1.2,
    edge = 0.1,
    stagger = 0.5,
    border = 0.6,
    rgbSubpixels = true,
  } = props || {}

  const _uv = inputUV().toVar()

  const _scalar = float(scalar)
  const _zoom = float(zoom)
  const _exponent = float(exponent)
  const _edge = float(edge)
  const _stagger = float(stagger)
  const _border = float(border)

  // Aspect-correct so cells stay square on non-square targets.
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Brick-lay: alternate columns are shifted vertically by `stagger` cells.
  const col = floor(aspectUV.x.mul(_scalar)).toVar()
  const yStagger = mod(col, float(2)).mul(_stagger).toVar()

  const grid = vec2(aspectUV.x.mul(_scalar), aspectUV.y.mul(_scalar).add(yStagger)).toVar()
  const cellId = floor(grid).toVar()
  const cellUV = fract(grid).toVar()

  // Block-sample the source once per cell (reverse the stagger + aspect) so
  // each LED shows a single flat colour, like a real panel.
  const cellCenter = cellId.add(0.5).toVar()
  const sampleUV = vec2(cellCenter.x.div(_scalar).div(aspect), cellCenter.y.sub(yStagger).div(_scalar)).toVar()
  const originalColor = input.sample(sampleUV)

  // Rounded LED element (same falloff as the original effect).
  const gridUV = cellUV.sub(0.5).toVar()
  const element = length(gridUV.mul(_zoom)).oneMinus().toVar()
  element.assign(smoothstep(_edge, float(1), element))
  element.assign(pow(element, _exponent))

  // R/G/B sub-pixel triads: split the cell into three vertical slices, each
  // lighting one channel. Costs 2/3 of the energy, so gain it back.
  let tint
  let gain
  if (rgbSubpixels) {
    const sub = floor(cellUV.x.mul(3)).toVar()
    const s05 = step(float(0.5), sub).toVar()
    const s15 = step(float(1.5), sub).toVar()
    tint = vec3(float(1).sub(s05), s05.sub(s15), s15)
    gain = float(2.4)
  } else {
    tint = vec3(1)
    gain = float(1)
  }

  // Soft per-cell border mask (darkens toward the cell edges).
  const p = cellUV.sub(0.5).abs().mul(2).toVar()
  const bx = p.x.mul(p.x).mul(_border).oneMinus()
  const by = p.y.mul(p.y).mul(_border).oneMinus()
  const cellMask = smoothstep(float(0), float(0.95), bx.mul(by)).toVar()

  const rgb = originalColor.rgb.mul(tint).mul(element).mul(cellMask).mul(gain).toVar()

  return vec4(rgb, originalColor.a)
})
