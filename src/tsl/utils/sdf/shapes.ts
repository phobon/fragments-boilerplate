import {
  Fn,
  length,
  min,
  max,
  abs,
  vec2,
  sqrt,
  sign,
  float,
  dot,
  vec3,
  If,
  clamp,
  select,
  mul,
  sub,
  add,
} from 'three/tsl'

type SdParallelogramOptions = {
  wi?: ReturnType<typeof float>
  he?: ReturnType<typeof float>
  sk?: ReturnType<typeof float>
}

/**
 * Returns a sphere SDF based on a given uv and radius.
 * @param {Array} _uv - The UV coordinates (vec2).
 * @param {number} [r=0.0] - The radius of the sphere.
 * @returns {number} The signed distance from the sphere surface.
 */
export const sdSphere = Fn(([_uv, r = float(0.0)]) => {
  const _r = float(r)
  return length(_uv).sub(_r)
})

/**
 * Returns a 2d box SDF based on a given uv and size.
 * @param {vec2} _uv - The UV coordinates (vec2).
 * @param {number} [_size=0.0] - The half-size (extent) of the box along each axis.
 * @returns {number} The signed distance from the box surface.
 */
export const sdBox2d = Fn(([_uv, _size = float(0.0)]) => {
  return max(abs(_uv.x), abs(_uv.y)).sub(_size)
})

/**
 * Returns a 2d box SDF based on a given uv and size.
 * @param {vec2} _uv - The UV coordinates (vec2).
 * @param {vec3} [_size=0.0] - The half-size (extent) of the box along each axis.
 * @returns {number} The signed distance from the box surface.
 */
export const sdBox3d = Fn(([p, b = vec3(0)]) => {
  const q = abs(p).sub(b)
  return length(max(q, 0.0)).add(min(max(q.x, max(q.y, q.z)), 0.0))
})

/**
 * Returns a diamond SDF based on a given uv and radius.
 * @param {Array} _uv - The UV coordinates (vec2).
 * @param {number} [r=0.0] - The radius of the diamond.
 * @returns {number} The signed distance from the diamond surface.
 */
export const sdDiamond = Fn(([_uv, r = 0.0]) => {
  return abs(_uv.x).add(abs(_uv.y)).sub(r)
})

/**
 * Returns a hexagon SDF based on a given point and radius.
 * @param {Array} p - The point coordinates (vec2).
 * @param {number} [_r=0.5] - The radius of the hexagon.
 * @returns {number} The signed distance from the hexagon surface.
 */
export const sdHexagon = Fn(([p, _r = 0.5]) => {
  const r = float(_r)
  const k = vec3(-0.866025404, 0.5, 0.577350269)

  const _p = abs(p).toVar()
  _p.subAssign(float(2.0).mul(min(dot(k.xy, _p), 0.0).mul(k.xy)))
  _p.subAssign(vec2(clamp(_p.x, k.z.negate().mul(r), k.z.mul(r)), r))

  return length(_p).mul(sign(_p.y))
})

/**
 * Returns an equilateral triangle SDF based on a given point and radius.
 * @param {Array} p - The point coordinates (vec2).
 * @param {number} [_r=0.1] - The radius of the triangle (float).
 * @returns {number} The signed distance from the triangle surface.
 */
export const sdEquilateralTriangle = Fn(([p, _r = float(0.1)]) => {
  const r = float(_r)

  const k = sqrt(3.0)
  const _p = (p ?? vec2(0)).toVar()

  _p.x = abs(_p.x).sub(r).toVar()
  _p.y = _p.y.add(r.div(k)).toVar()

  If(_p.x.add(k.mul(_p.y)).greaterThan(0), () => {
    _p.assign(vec2(_p.x.sub(k.mul(_p.y)), k.negate().mul(_p.x).sub(_p.y)).div(2))
  })

  _p.x.subAssign(clamp(_p.x, r.mul(-2), 0.0))
  return length(_p).negate().mul(sign(_p.y))
})

/**
 * Returns a line SDF for a given coordinate.
 * @param {number} p - The coordinate (float).
 * @returns {number} The signed distance from the line.
 */
export const sdLine = Fn(([p]) => {
  return abs(p)
})

/**
 * Returns a ring SDF based on a given uv and radius.
 * @param {Array} _uv - The UV coordinates (vec2).
 * @param {number} [s=0.4] - The radius of the ring.
 * @returns {number} The signed distance from the ring surface.
 */
export const sdRing = Fn(([_uv, s = float(0.4)]) => {
  return abs(length(_uv).sub(s)).toVar()
})

/**
 * Returns a parallelogram SDF based on a given uv and size.
 * @param {Array} _uv - The UV coordinates (vec2).
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.wi=0.4] - The width of the parallelogram.
 * @param {number} [options.he=0.1] - The height of the parallelogram.
 * @param {number} [options.sk=0.1] - The skew of the parallelogram.
 * @returns {number} The signed distance from the parallelogram surface.
 */
export const sdParallelogram = Fn(([_p, options = {}]) => {
  const { wi = float(0.4), he = float(0.1), sk = float(0.1) } = options as SdParallelogramOptions
  const p = _p.toVar()
  const e = vec2(sk, he)

  p.assign(select(p.y.lessThan(0.0), p.negate(), p))

  const w = p.sub(e)
  w.x.subAssign(clamp(w.x, wi.negate(), wi))

  const d = vec2(dot(w, w), w.y.negate()).toVar()
  const s = p.x.mul(e.y).sub(p.y.mul(e.x))

  p.assign(select(s.lessThan(0.0), p.negate(), p))

  const v = p.sub(vec2(wi, 0)).toVar()

  v.subAssign(e.mul(clamp(dot(v, e).div(dot(e, e)), -1.0, 1.0)))
  d.assign(min(d, vec2(dot(v, v), wi.mul(he).sub(abs(s)))))

  return sqrt(d.x).mul(sign(d.y.negate()))
})

const ndot = Fn(([a, b]) => {
  return a.x.mul(b.x).sub(a.y.mul(b.y))
})

/**
 * Returns a rhombus SDF based on a given uv and size.
 * @param {Array} _uv - The UV coordinates (vec2).
 * @param {number} [b=0.4] - The size of the rhombus.
 * @returns {number} The signed distance from the rhombus surface.
 */
export const sdRhombus = Fn(([_p, b = vec2(0.4)]) => {
  const p = _p.toVar()
  p.assign(abs(p))
  const h = clamp(ndot(b.sub(mul(2.0, p)), b).div(dot(b, b)), -1.0, 1.0)
  const d = length(p.sub(mul(0.5, b).mul(vec2(sub(1.0, h), add(1.0, h)))))

  return d.mul(sign(p.x.mul(b.y).add(p.y.mul(b.x).sub(b.x.mul(b.y)))))
})

/**
 * Returns a triangle SDF based on a given uv and size.
 * @param {Array} _uv - The UV coordinates (vec2).
 * @param {number} [size=0.4] - The size of the triangle.
 * @returns {number} The signed distance from the triangle surface.
 */
export const sdTriangle = Fn(([_p, size = float(0.4)]) => {
  const t = max(abs(_p.x.mul(size)).add(_p.y), abs(_p.y.mul(size).sub(0.5)).sub(0.5))
  return t
})
