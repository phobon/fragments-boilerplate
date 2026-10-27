// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186. App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
//
// Mask-builder vocabulary (docs/adr/0013). A mask is a 0–1 analytic scalar field:
// 1 inside the shape, 0 outside, feathered across the edge. The `mask*` wrappers
// take a uv plus an options bag (center / rotation / size|radius / feather),
// transform the uv into the shape's local frame, evaluate an SDF, and return the
// feathered fill. Combine ops read those 0–1 values (union = max, intersect =
// min, subtract = a AND NOT b, smooth union = smax). Ramps produce a value
// interpolated across fixed 2- or 3-color/scalar stops along a line or radius.
//
// These compile to GPU code and are not unit-testable; verification is visual
// (the generator/handle-inference logic in later slices is the testable surface).
import { clamp, cos, dot, Fn, float, length, max, min, mix, select, sin, smoothstep, vec2 } from 'three/tsl'
import { smax } from './operations'
import { sdRoundedBox, sdSphere } from './shapes'

type MaskCircleOptions = {
  center?: ReturnType<typeof vec2>
  radius?: ReturnType<typeof float>
  feather?: ReturnType<typeof float>
}

type MaskBoxOptions = {
  center?: ReturnType<typeof vec2>
  size?: ReturnType<typeof vec2>
  rotation?: ReturnType<typeof float>
  feather?: ReturnType<typeof float>
}

type MaskRoundedBoxOptions = MaskBoxOptions & {
  cornerRadius?: ReturnType<typeof float>
}

type LinearRampOptions = {
  start?: ReturnType<typeof vec2>
  end?: ReturnType<typeof vec2>
}

type RadialRampOptions = {
  center?: ReturnType<typeof vec2>
  radius?: ReturnType<typeof float>
}

// Feather can't be 0 (smoothstep with equal edges is a divide-by-zero → NaN), so
// clamp it to a tiny floor. `smoothstep(feather, -feather, sd)` returns 1 where
// sd < -feather (fully inside) and 0 where sd > feather (fully outside).
const FEATHER_FLOOR = float(1e-4)
const maskFill = Fn(([sd, feather]) => {
  const f = max(feather, FEATHER_FLOOR)
  return smoothstep(f, f.negate(), sd)
})

// Bring `uv` into a shape's local frame: translate by `center`, then rotate by
// `-rotation` (rotating the sample point opposite the shape's rotation).
const toLocal = Fn(([uv, center, rotation]) => {
  const p = uv.sub(center)
  const c = cos(rotation)
  const s = sin(rotation)
  return vec2(p.x.mul(c).add(p.y.mul(s)), p.y.mul(c).sub(p.x.mul(s)))
})

// --- shape masks -------------------------------------------------------------

/**
 * Circular mask. Returns a feathered 0–1 fill (1 inside the circle).
 * @param {vec2} uv - The sample coordinate.
 * @param {Object} [options]
 * @param {vec2} [options.center=vec2(0)] - Circle center.
 * @param {number} [options.radius=0.5] - Circle radius.
 * @param {number} [options.feather=0.01] - Edge softness (half-width of the transition).
 * @returns {number} 0–1 mask value.
 */
export const maskCircle = Fn(([uv, options = {}]) => {
  const { center = vec2(0), radius = float(0.5), feather = float(0.01) } = options as MaskCircleOptions
  // Rotation is meaningless for a circle, so it isn't part of the API (a
  // generated `circle*Rotation` uniform would be dead — see ADR 0013's handle
  // inference).
  const sd = sdSphere(uv.sub(center), radius)
  return maskFill(sd, feather)
})

/**
 * Rectangular mask (independent width/height, rotatable). Returns a feathered 0–1 fill.
 * @param {vec2} uv - The sample coordinate.
 * @param {Object} [options]
 * @param {vec2} [options.center=vec2(0)] - Box center.
 * @param {vec2} [options.size=vec2(0.5)] - Half-extents along x/y.
 * @param {number} [options.rotation=0] - Rotation in radians.
 * @param {number} [options.feather=0.01] - Edge softness.
 * @returns {number} 0–1 mask value.
 */
export const maskBox = Fn(([uv, options = {}]) => {
  const { center = vec2(0), size = vec2(0.5), rotation = float(0), feather = float(0.01) } = options as MaskBoxOptions
  const p = toLocal(uv, center, rotation)
  // A rounded box with radius 0 is an exact box with vec2 half-extents.
  const sd = sdRoundedBox(p, size, float(0))
  return maskFill(sd, feather)
})

/**
 * Rounded-rectangle mask (independent width/height, corner radius, rotatable).
 * @param {vec2} uv - The sample coordinate.
 * @param {Object} [options]
 * @param {vec2} [options.center=vec2(0)] - Box center.
 * @param {vec2} [options.size=vec2(0.5)] - Half-extents along x/y.
 * @param {number} [options.cornerRadius=0.1] - Corner radius.
 * @param {number} [options.rotation=0] - Rotation in radians.
 * @param {number} [options.feather=0.01] - Edge softness.
 * @returns {number} 0–1 mask value.
 */
export const maskRoundedBox = Fn(([uv, options = {}]) => {
  const {
    center = vec2(0),
    size = vec2(0.5),
    cornerRadius = float(0.1),
    rotation = float(0),
    feather = float(0.01),
  } = options as MaskRoundedBoxOptions
  const p = toLocal(uv, center, rotation)
  const sd = sdRoundedBox(p, size, cornerRadius)
  return maskFill(sd, feather)
})

// --- combine ops (mask space: 0–1 values) ------------------------------------

/**
 * Union of two masks — the region covered by either (max).
 * @param {number} a - First mask (0–1).
 * @param {number} b - Second mask (0–1).
 * @returns {number} 0–1 mask value.
 */
export const maskUnion = Fn(([a, b]) => max(a, b))

/**
 * Intersection of two masks — the region covered by both (min).
 * @param {number} a - First mask (0–1).
 * @param {number} b - Second mask (0–1).
 * @returns {number} 0–1 mask value.
 */
export const maskIntersect = Fn(([a, b]) => min(a, b))

/**
 * Subtraction — `a` with `b` cut out (a AND NOT b).
 * @param {number} a - Base mask (0–1).
 * @param {number} b - Mask to remove (0–1).
 * @returns {number} 0–1 mask value.
 */
export const maskSubtract = Fn(([a, b]) => min(a, b.oneMinus()))

/**
 * Smooth union — union of two masks with a soft blend at the seam (smax).
 * @param {number} a - First mask (0–1).
 * @param {number} b - Second mask (0–1).
 * @param {number} [k=0.1] - Blend width.
 * @returns {number} 0–1 mask value.
 */
export const maskSmoothUnion = Fn(([a, b, k = float(0.1)]) => smax(a, b, k))

// --- ramps (fixed 2- and 3-stop) ---------------------------------------------
// Stops are generic: `mix` interpolates floats or vec3 colors identically, so
// the same helper drives a scalar falloff mask or a color gradient.

// Normalized projection of `uv` onto the start→end segment, clamped to [0,1].
const linearParam = Fn(([uv, start, end]) => {
  const dir = end.sub(start)
  return clamp(dot(uv.sub(start), dir).div(dot(dir, dir)), 0.0, 1.0)
})

// Normalized distance of `uv` from `center`, clamped to [0,1] over `radius`.
const radialParam = Fn(([uv, center, radius]) => {
  return clamp(length(uv.sub(center)).div(max(radius, float(1e-4))), 0.0, 1.0)
})

// Interpolate a→b→c with `b` sitting at parameter `mid`.
const lerp3 = Fn(([t, a, b, c, mid]) => {
  const m = clamp(mid, float(1e-4), float(0.9999))
  const lower = mix(a, b, clamp(t.div(m), 0.0, 1.0))
  const upper = mix(b, c, clamp(t.sub(m).div(m.oneMinus()), 0.0, 1.0))
  return select(t.lessThan(m), lower, upper)
})

/**
 * Linear 2-stop ramp — interpolates `a`→`b` along the start→end direction.
 * @param {vec2} uv - The sample coordinate.
 * @param {*} a - Stop at the start (float or vec3).
 * @param {*} b - Stop at the end (float or vec3).
 * @param {Object} [options]
 * @param {vec2} [options.start=vec2(-0.5,0)] - Ramp start point.
 * @param {vec2} [options.end=vec2(0.5,0)] - Ramp end point.
 * @returns {*} Interpolated value (matches the stop type).
 */
export const linearRamp = Fn(([uv, a, b, options = {}]) => {
  const { start = vec2(-0.5, 0), end = vec2(0.5, 0) } = options as LinearRampOptions
  return mix(a, b, linearParam(uv, start, end))
})

/**
 * Linear 3-stop ramp — interpolates `a`→`b`→`c` along start→end, `b` at `mid`.
 * @param {vec2} uv - The sample coordinate.
 * @param {*} a - Stop at the start (float or vec3).
 * @param {*} b - Middle stop.
 * @param {*} c - Stop at the end.
 * @param {Object} [options]
 * @param {vec2} [options.start=vec2(-0.5,0)] - Ramp start point.
 * @param {vec2} [options.end=vec2(0.5,0)] - Ramp end point.
 * @param {number} [options.mid=0.5] - Parameter position of `b`.
 * @returns {*} Interpolated value (matches the stop type).
 */
export const linearRamp3 = Fn(([uv, a, b, c, options = {}]) => {
  const {
    start = vec2(-0.5, 0),
    end = vec2(0.5, 0),
    mid = float(0.5),
  } = options as LinearRampOptions & { mid?: ReturnType<typeof float> }
  return lerp3(linearParam(uv, start, end), a, b, c, mid)
})

/**
 * Radial 2-stop ramp — interpolates `a` (center) → `b` (rim) by distance.
 * @param {vec2} uv - The sample coordinate.
 * @param {*} a - Stop at the center (float or vec3).
 * @param {*} b - Stop at the rim (float or vec3).
 * @param {Object} [options]
 * @param {vec2} [options.center=vec2(0)] - Ramp center.
 * @param {number} [options.radius=0.5] - Distance mapped to the rim stop.
 * @returns {*} Interpolated value (matches the stop type).
 */
export const radialRamp = Fn(([uv, a, b, options = {}]) => {
  const { center = vec2(0), radius = float(0.5) } = options as RadialRampOptions
  return mix(a, b, radialParam(uv, center, radius))
})

/**
 * Radial 3-stop ramp — interpolates `a`(center) → `b`(`mid`) → `c`(rim) by distance.
 * @param {vec2} uv - The sample coordinate.
 * @param {*} a - Stop at the center (float or vec3).
 * @param {*} b - Middle stop.
 * @param {*} c - Stop at the rim.
 * @param {Object} [options]
 * @param {vec2} [options.center=vec2(0)] - Ramp center.
 * @param {number} [options.radius=0.5] - Distance mapped to the rim stop.
 * @param {number} [options.mid=0.5] - Parameter position of `b`.
 * @returns {*} Interpolated value (matches the stop type).
 */
export const radialRamp3 = Fn(([uv, a, b, c, options = {}]) => {
  const {
    center = vec2(0),
    radius = float(0.5),
    mid = float(0.5),
  } = options as RadialRampOptions & { mid?: ReturnType<typeof float> }
  return lerp3(radialParam(uv, center, radius), a, b, c, mid)
})
