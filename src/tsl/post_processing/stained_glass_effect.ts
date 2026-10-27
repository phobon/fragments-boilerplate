// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import {
  dot,
  Fn,
  float,
  floor,
  fract,
  If,
  length,
  min,
  mix,
  normalize,
  screenSize,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

const hash22 = (p) => {
  const q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))
  return fract(sin(q).mul(43758.5453123))
}

/**
 * Recreates Illustrator's Texture → Stained Glass filter: the image is broken
 * into flat Voronoi cells (as in a crystallize effect), each cell filled with a
 * single sampled color, and separated by dark "leaded" borders — like glass
 * panes held together with strips of lead came.
 *
 * The cell partition uses the standard jittered-grid Voronoi (aspect-corrected
 * UV scaled by `density`, feature points jittered by `hash22` with
 * `randomness`, unrolled 3×3 neighborhood search). The border is found with
 * the classic two-pass Voronoi trick, itself unrolled into a second static 3×3
 * pass: having found the nearest feature point in pass one, pass two walks the
 * neighboring feature points again and, for each one, measures the signed
 * distance to the perpendicular bisector plane between it and the nearest
 * point — the minimum of those distances is the distance to the cell edge.
 * That edge distance is smoothstepped against `borderWidth` to produce the
 * lead-line mask.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.density=40] - Number of Voronoi cells across the aspect-corrected UV space (higher = smaller panes)
 * @param {number} [props.randomness=1.0] - How far feature points jitter from their grid cell center (0 = regular grid, 1 = fully jittered)
 * @param {number} [props.borderWidth=0.06] - Half-width of the lead border, in cell units (distance from the cell edge)
 * @param {number} [props.softness=0.02] - Softness of the border edge, in cell units
 * @param {vec3} [props.borderColor=vec3(0.05, 0.04, 0.04)] - Color of the lead border lines
 * @param {number} [props.brightness=1.0] - Multiplier on the sampled cell color, to fake glass backlighting
 * @returns {vec4} The stained-glass processed color
 */
export const stainedGlassEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    density = 40,
    randomness = 1.0,
    borderWidth = 0.06,
    softness = 0.02,
    borderColor = vec3(0.05, 0.04, 0.04),
    brightness = 1.0,
  } = props || {}

  const _uv = inputUV().toVar()

  const _density = float(density)
  const _randomness = float(randomness)
  const _borderWidth = float(borderWidth)
  const _softness = float(softness)
  const _brightness = float(brightness)

  // Aspect correct UV coordinates so cells are regular on screen
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  const scaledUV = aspectCorrectedUV.mul(_density).toVar()
  const cellId = floor(scaledUV).toVar()

  // Pass 1: find the nearest jittered feature point in the 3x3 neighborhood
  const minDist = float(1e5).toVar()
  const nearestPoint = vec2(0.0, 0.0).toVar()

  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const neighborCell = cellId.add(vec2(x, y))
      const jitter = hash22(neighborCell).sub(0.5).mul(_randomness)
      const point = neighborCell.add(0.5).add(jitter)
      const dist = length(scaledUV.sub(point))

      If(dist.lessThan(minDist), () => {
        minDist.assign(dist)
        nearestPoint.assign(point)
      })
    }
  }

  // Pass 2: walk the same neighborhood again and find the closest perpendicular
  // bisector plane between the nearest point and every other neighboring point —
  // that minimum is the distance to the Voronoi cell edge.
  const edgeDist = float(1e5).toVar()

  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const neighborCell = cellId.add(vec2(x, y))
      const jitter = hash22(neighborCell).sub(0.5).mul(_randomness)
      const point = neighborCell.add(0.5).add(jitter)

      const separation = length(point.sub(nearestPoint))

      If(separation.greaterThan(1e-4), () => {
        const midpoint = nearestPoint.add(point).mul(0.5)
        const direction = normalize(point.sub(nearestPoint))
        // Distance from the pixel to the bisector plane, positive on the
        // nearest point's side (the pixel's own cell)
        const planeDist = dot(midpoint.sub(scaledUV), direction)
        edgeDist.assign(min(edgeDist, planeDist))
      })
    }
  }

  // Undo scaling and aspect correction to sample the input at the feature point
  const cellAspectUV = nearestPoint.div(_density).toVar()
  const cellUV = vec2(cellAspectUV.x.div(aspect), cellAspectUV.y).toVar()
  const cellColor = input.sample(cellUV)

  const borderMask = smoothstep(_borderWidth.sub(_softness), _borderWidth.add(_softness), edgeDist).toVar()

  const finalColor = mix(borderColor, cellColor.rgb.mul(_brightness), borderMask)

  return vec4(finalColor, cellColor.a)
})
