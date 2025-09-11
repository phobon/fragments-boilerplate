import {
  dot,
  vec4,
  uniformArray,
  float,
  uniform,
  vec2,
  int,
  length,
  exp,
  Loop,
  If,
  Fn,
  mix,
  vec3,
  clamp,
  smoothstep,
  mul,
  sqrt,
  abs,
  atan,
  cos,
  sin,
  debug,
  PI,
  uv,
} from 'three/tsl'

/**
 * Computes a bilinear gradient between four colors using barycentric coordinates
 * @param _st - UV coordinates for the gradient
 * @param color1 - First color (top-left)
 * @param color2 - Second color (top-right)
 * @param color3 - Third color (bottom-left)
 * @param color4 - Fourth color (bottom-right)
 * @returns Interpolated color based on the four corner colors
 */
export const grad = Fn(([_st, color1, color2, color3, color4]) => {
  // Compute a bilinear gradient between four colors
  const _uv = vec2(_st).toVar()
  const _color0 = vec4(color1, 1.0).toVar()
  const _color1 = vec4(color2, 1.0).toVar()
  const _color2 = vec4(color3, 1.0).toVar()
  const _color3 = vec4(color4, 1.0).toVar()
  const P0 = vec2(0.31, 0.3).toVar()
  const P1 = vec2(0.7, 0.32).toVar()
  const P2 = vec2(0.28, 0.71).toVar()
  const P3 = vec2(0.72, 0.75).toVar()
  const Q = vec2(P0.sub(P2)).toVar()
  const R = vec2(P1.sub(P0)).toVar()
  const S = vec2(R.add(P2.sub(P3))).toVar()
  const T = vec2(P0.sub(_uv)).toVar()
  const u = float().toVar()
  const t = float().toVar()

  If(Q.x.equal(0.0).and(S.x.equal(0.0)), () => {
    u.assign(T.x.negate().div(R.x))
    t.assign(T.y.add(u.mul(R.y)).div(Q.y.add(u.mul(S.y))))
  })
    .ElseIf(Q.y.equal(0.0).and(S.y.equal(0.0)), () => {
      u.assign(T.y.negate().div(R.y))
      t.assign(T.x.add(u.mul(R.x)).div(Q.x.add(u.mul(S.x))))
    })
    .Else(() => {
      const A = float(S.x.mul(R.y).sub(R.x.mul(S.y))).toVar()
      const B = float(
        S.x
          .mul(T.y)
          .sub(T.x.mul(S.y))
          .add(Q.x.mul(R.y).sub(R.x.mul(Q.y))),
      ).toVar()
      const C = float(Q.x.mul(T.y).sub(T.x.mul(Q.y))).toVar()

      If(abs(A).lessThan(0.0001), () => {
        u.assign(C.negate().div(B))
      }).Else(() => {
        u.assign(
          B.negate()
            .add(sqrt(B.mul(B).sub(mul(4.0, A).mul(C))))
            .div(mul(2.0, A)),
        )
      })

      t.assign(T.y.add(u.mul(R.y)).div(Q.y.add(u.mul(S.y))))
    })

  u.assign(clamp(u, 0.0, 1.0))
  t.assign(clamp(t, 0.0, 1.0))
  t.assign(smoothstep(0.0, 1.0, t))
  u.assign(smoothstep(0.0, 1.0, u))
  const colorA = vec4(mix(_color0, _color1, u)).toVar()
  const colorB = vec4(mix(_color2, _color3, u)).toVar()

  return mix(colorA, colorB, t)
})

/**
 * Converts Cartesian coordinates to polar coordinates
 * @param _p - 2D Cartesian coordinates (x, y)
 * @returns Polar coordinates (radius, angle) where angle is in radians
 */
export const cartesianToPolar = Fn(([_p]) => {
  const r = length(_p)
  const theta = atan(_p.y, _p.x)
  return vec2(r, theta)
})

/**
 * Converts polar coordinates to Cartesian coordinates
 * @param _p - Polar coordinates (radius, angle) where angle is in radians
 * @returns Cartesian coordinates (x, y)
 */
export const polarToCartesian = Fn(([_p]) => {
  const polar = vec2(_p).toVar()
  const r = float(polar.x).toVar()
  const theta = float(polar.y).toVar()

  return vec2(r.mul(cos(theta)), r.mul(sin(theta)))
})
