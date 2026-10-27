// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, floor, fract, If, length, screenSize, sin, uv, vec2, vec4 } from 'three/tsl'

const hash22 = (p) => {
  const q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))
  return fract(sin(q).mul(43758.5453123))
}

/**
 * Creates a crystallize effect for post-processing, replicating Illustrator's
 * Pixelate → Crystallize filter: the image is broken into flat-colored
 * Voronoi (cell-noise) polygons, each facet showing the color sampled at its
 * cell's feature point.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates to sample from (defaults to built-in uv)
 * @param {number} [props.density=40] - Number of Voronoi cells across the screen (higher = smaller facets)
 * @param {number} [props.randomness=1.0] - How far feature points drift from their cell center (0 = regular grid, 1 = full jitter)
 * @returns {vec4} The crystallized color
 */
export const crystallizeEffect = Fn((props) => {
  const { input, inputUV = uv, density = 40, randomness = 1.0 } = props || {}

  const _uv = inputUV().toVar()
  const _density = float(density)
  const _randomness = float(randomness)

  // Aspect correct UV coordinates so cells are regular on screen
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  const scaledUV = aspectCorrectedUV.mul(_density).toVar()
  const baseCell = floor(scaledUV).toVar()
  const fractional = fract(scaledUV).toVar()

  const minDist = float(1e5).toVar()
  const nearestPoint = vec2(0).toVar()

  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const neighbor = vec2(x, y).toVar()
      const cellId = baseCell.add(neighbor).toVar()
      const jitter = hash22(cellId).sub(0.5).mul(_randomness).toVar()
      const point = neighbor.add(0.5).add(jitter).toVar()
      const diff = point.sub(fractional).toVar()
      const d = length(diff).toVar()

      If(d.lessThan(minDist), () => {
        minDist.assign(d)
        nearestPoint.assign(cellId.add(0.5).add(jitter))
      })
    }
  }

  // Convert the winning feature point back to sampling UV space
  const sampleUV = vec2(nearestPoint.x.div(_density).div(aspect), nearestPoint.y.div(_density)).toVar()

  return input.sample(sampleUV)
})
