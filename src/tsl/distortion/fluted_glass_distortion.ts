// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { abs, clamp, cos, dot, Fn, float, fract, mix, sign, sin, smoothstep, sqrt, vec2 } from 'three/tsl'

const TAU = Math.PI * 2

/** Maps the artist-facing refraction index onto a sane UV displacement. */
export const FLUTED_REFRACT_SCALE = 0.02

type FlutedGlassOptions = {
  shape?: string
  frequency?: ReturnType<typeof float>
  angle?: ReturnType<typeof float>
  softness?: ReturnType<typeof float>
  waveAmplitude?: ReturnType<typeof float>
  waveFrequency?: ReturnType<typeof float>
  refraction?: ReturnType<typeof float>
}

/**
 * Cross-section of one flute, returned as vec2(slope, groove):
 *  - `slope` (-1..1): surface slope across the rib. Bends the light (refraction)
 *    and tilts the surface normal (shading), so everything derives from it.
 *  - `groove` (0..1): proximity to the seam between ribs, used to darken the gap
 *    so flat-topped shapes (bars) read as separated panels rather than one sheet.
 *
 * `shape` is a build-time string selecting the profile; `softness` eases each
 * shape's edges. Add new shapes as extra cases.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - See {@link flutedGlassDistortion}.
 * @returns {vec2} vec2(slope, groove)
 */
export const flutedGlassProfile = Fn(([_uv, options = {}]) => {
  const {
    shape = 'waves',
    frequency = float(10),
    angle = float(0),
    softness = float(0.5),
    waveAmplitude = float(0.06),
    waveFrequency = float(1.5),
  } = options as FlutedGlassOptions
  const uv = _uv.toVar()

  const _angle = float(angle).mul(TAU).toVar()
  const direction = vec2(cos(_angle), sin(_angle)).toVar() // across the ribs

  // Coordinate across the ribs. Only "waves" undulates along the rib length;
  // bars/rounded stay straight.
  const coord = dot(uv, direction).toVar()
  if (shape !== 'bars' && shape !== 'rounded') {
    const ribAxis = vec2(direction.y.negate(), direction.x)
    const along = dot(uv, ribAxis)
    coord.addAssign(sin(along.mul(waveFrequency).mul(TAU)).mul(waveAmplitude))
  }

  const phase = fract(coord.mul(frequency)).toVar()
  const x = phase.mul(2.0).sub(1.0).toVar() // -1..1 within the rib
  const ax = abs(x).toVar()
  const _soft = float(softness).toVar()

  const slope = float(0).toVar()
  const groove = float(0).toVar()
  switch (shape) {
    case 'bars': {
      // Trapezoid: flat top + constant-slope facets (hard creases), with a
      // crisp dark seam between bars.
      const flat = float(0.5)
      const width = float(0.04).add(_soft.mul(0.3))
      slope.assign(sign(x).mul(smoothstep(flat, flat.add(width), ax)))
      groove.assign(smoothstep(float(0.8).sub(_soft.mul(0.25)), 1.0, ax))
      break
    }
    case 'rounded': {
      // Flat top + smooth curved shoulders, with a soft wide groove.
      const flat = float(0.3).mul(float(1).sub(_soft))
      slope.assign(sign(x).mul(smoothstep(flat, 1.0, ax)))
      groove.assign(smoothstep(float(0.55).sub(_soft.mul(0.2)), 1.0, ax))
      break
    }
    default: {
      // "waves": half-round lens ridge blended toward a soft sine; no groove
      // (the shaded valleys already separate the ridges).
      const lens = clamp(x.negate().div(sqrt(float(1.04).sub(x.mul(x)))), -1.0, 1.0)
      slope.assign(mix(lens, sin(phase.mul(TAU)), _soft))
    }
  }
  return vec2(slope, groove)
})

/**
 * Fluted / ribbed glass UV refraction (the reusable distortion). Returns the
 * sampling UV displaced across the ribs; the lit, full-glass look lives in
 * {@link flutedGlassDistortionEffect}.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {string} [options.shape="waves"] - Rib profile: "waves", "bars", or "rounded"
 * @param {number} [options.frequency=10.0] - Number of flutes across the UV
 * @param {number} [options.angle=0.0] - Orientation of the flutes in turns (0–1); 0 = vertical ribs
 * @param {number} [options.softness=0.5] - Edge softness of the ribs (0 sharp → 1 smooth)
 * @param {number} [options.waveAmplitude=0.06] - How far the ribs wave along their length
 * @param {number} [options.waveFrequency=1.5] - Frequency of the wave along the ribs
 * @param {number} [options.refraction=1.5] - Refraction strength (displacement magnitude)
 * @returns {vec2} Distorted UV coordinates
 */
export const flutedGlassDistortion = Fn(([_uv, options = {}]) => {
  const { angle = float(0), refraction = float(1.5) } = options as FlutedGlassOptions
  const uv = _uv.toVar()

  const _angle = float(angle).mul(TAU).toVar()
  const direction = vec2(cos(_angle), sin(_angle)).toVar()
  const slope = flutedGlassProfile(uv, options).x.toVar()

  const displacement = direction.mul(slope.mul(float(refraction)).mul(FLUTED_REFRACT_SCALE)).toVar()
  return uv.add(displacement)
})
