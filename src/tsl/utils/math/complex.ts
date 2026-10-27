import { add, atan, cos, div, Fn, length, log, mul, PI, pow, select, sin, vec2 } from 'three/tsl'
import { cosh, sinh } from '../color/tonemapping'

/**
 * Complex division: (a / b) for complex numbers a, b (vec2)
 * @param {vec2} a Dividend complex number
 * @param {vec2} b Divisor complex number
 * @returns {vec2} Result of division
 */
export const complexDiv = Fn(([a, b]) => {
  return vec2(
    div(a.x.mul(b.x).add(mul(a.y, b.y)), add(b.x.mul(b.x), b.y.mul(b.y))),
    div(a.y.mul(b.x).sub(mul(a.x, b.y)), add(b.x.mul(b.x), b.y.mul(b.y))),
  )
})

/**
 * Complex logarithm: log(a) for complex number a (vec2)
 * @param {vec2} a Complex number
 * @returns {vec2} Logarithm in complex form
 */
export const complexLog = Fn(([a]) => {
  const polar = asPolar(a)
  const rPart = polar.x
  const iPart = polar.y.toVar()
  select(iPart.greaterThan(PI), iPart.assign(iPart.sub(mul(2.0, PI))), iPart.assign(polar.y))

  return vec2(log(rPart), iPart)
})

/**
 * Complex multiplication: (a * b) for complex numbers a, b (vec2)
 * @param {vec2} a First complex number
 * @param {vec2} b Second complex number
 * @returns {vec2} Product
 */
export const complexMul = Fn(([a, b]) => {
  return vec2(a.x.mul(b.x).sub(mul(a.y, b.y)), a.x.mul(b.y).add(mul(a.y, b.x)))
})

/**
 * Complex power: v^p for complex number v (vec2) and real p
 * @param {vec2} v Base complex number
 * @param {number} p Real exponent
 * @returns {vec2} Power result
 */
export const complexPow = Fn(([v, p]) => {
  const z = asPolar(v)
  return pow(z.x, p).mul(vec2(cos(z.y.mul(p)), sin(z.y.mul(p))))
})

/**
 * Complex sine: sin(a) for complex number a (vec2)
 * @param {vec2} a Complex number
 * @returns {vec2} Sine in complex form
 */
export const complexSin = Fn(([a]) => {
  return vec2(sin(a.x).mul(cosh(a.y)), cos(a.x).mul(sinh(a.y)))
})

/**
 * Complex cosine: cos(a) for complex number a (vec2)
 * @param {vec2} a Complex number
 * @returns {vec2} Cosine in complex form
 */
export const complexCos = Fn(([a]) => {
  return vec2(cos(a.x).mul(cosh(a.y)), sin(a.x).mul(sinh(a.y)).negate())
})

/**
 * Complex tangent: tan(a) for complex number a (vec2)
 * @param {vec2} a Complex number
 * @returns {vec2} Tangent in complex form
 */
export const complexTan = Fn(([a]) => {
  return complexDiv(complexSin(a), complexCos(a))
})

/**
 * Convert complex number z (vec2) to polar form (r, theta)
 * @param {vec2} z Complex number
 * @returns {vec2} Polar form: (radius, angle)
 */
export const asPolar = Fn(([z]) => {
  return vec2(length(z), atan(z.y, z.x))
})
