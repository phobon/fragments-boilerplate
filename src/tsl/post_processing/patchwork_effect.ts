// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, floor, fract, mix, screenSize, sin, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl'

// Cheap 2D hash: tile position in, pseudo-random scalar out (0..1)
const hash21 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123))

/**
 * Creates a patchwork mosaic-tile effect for post-processing, mimicking
 * Illustrator's Texture → Patchwork filter: the image is broken into a grid
 * of small square tiles separated by dark grout gaps, with each tile given a
 * subtle random relief (lighter/raised or darker/recessed) and a beveled edge
 * highlight/shadow so the tiles read as small raised ceramic squares.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.density=80] - Number of tiles across the screen (higher = smaller tiles)
 * @param {number} [props.relief=0.25] - Strength of per-tile random brightness variation (0-1)
 * @param {number} [props.bevelWidth=0.15] - Width of the beveled edge highlight/shadow band, in tile-local units (0-0.5)
 * @param {number} [props.bevelStrength=0.2] - Strength of the bevel light/dark shading (0-1)
 * @param {number} [props.gapWidth=0.06] - Width of the grout gap on each tile's leading edges, in tile-local units (0-0.5)
 * @param {vec3} [props.groutColor=vec3(0.15, 0.13, 0.12)] - Color of the grout showing between tiles
 * @returns {vec4} The patchwork mosaic tiled color
 */
export const patchworkEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    density = 80,
    relief = 0.25,
    bevelWidth = 0.15,
    bevelStrength = 0.2,
    gapWidth = 0.06,
    groutColor = vec3(0.15, 0.13, 0.12),
  } = props || {}

  const _uv = inputUV().toVar()
  const _density = float(density)
  const _relief = float(relief)
  const _bevelWidth = float(bevelWidth)
  const _bevelStrength = float(bevelStrength)
  const _gapWidth = float(gapWidth)

  // Aspect correct UV coordinates so tiles are square on screen
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Scale into the tile grid
  const scaledUV = aspectCorrectedUV.mul(_density).toVar()
  const tileId = floor(scaledUV).toVar()
  const local = fract(scaledUV).toVar()

  // Sample the input at each tile's center (undo aspect + density scale)
  const tileCenterAspectUV = tileId.add(0.5).div(_density)
  const tileCenterUV = vec2(tileCenterAspectUV.x.div(aspect), tileCenterAspectUV.y).toVar()
  const tileSample = input.sample(tileCenterUV).toVar()

  // Per-tile relief: random height variation multiplies tile brightness
  const tileHash = hash21(tileId).toVar()
  const heightVariation = mix(float(1.0).sub(_relief), float(1.0).add(_relief), tileHash)
  const reliefRgb = tileSample.rgb.mul(heightVariation).toVar()

  // Bevel: brighten top-left edges, darken bottom-right edges of each tile
  const light = float(1.0)
    .sub(smoothstep(0.0, _bevelWidth, local.x))
    .add(smoothstep(float(1.0).sub(_bevelWidth), 1.0, local.y))
  const dark = smoothstep(float(1.0).sub(_bevelWidth), 1.0, local.x).add(
    float(1.0).sub(smoothstep(0.0, _bevelWidth, local.y)),
  )
  const beveledRgb = reliefRgb.mul(float(1.0).add(light.sub(dark).mul(_bevelStrength)))

  // Grout: mask out a gap band on each tile's leading edges
  const inside = smoothstep(_gapWidth, _gapWidth.mul(1.5), local.x).mul(
    smoothstep(_gapWidth, _gapWidth.mul(1.5), local.y),
  )

  const finalRgb = mix(groutColor, beveledRgb, inside)

  return vec4(finalRgb, tileSample.a)
})
