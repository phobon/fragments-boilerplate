import { abs, dot, Fn, float, floor, fract, lessThan, mod, mul, overloadingFn, sub, vec3, vec4 } from 'three/tsl'

export const mod289_0 = /*#__PURE__*/ Fn(([x_immutable]) => {
  const x = vec3(x_immutable).toVar()

  return x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0))
}).setLayout({
  name: 'mod289_0',
  type: 'vec3',
  inputs: [{ name: 'x', type: 'vec3' }],
})

export const mod289_1 = /*#__PURE__*/ Fn(([x_immutable]) => {
  const x = vec4(x_immutable).toVar()

  return x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0))
}).setLayout({
  name: 'mod289_1',
  type: 'vec4',
  inputs: [{ name: 'x', type: 'vec4' }],
})

export const mod289 = /*#__PURE__*/ overloadingFn([mod289_0, mod289_1])

export const fade = /*#__PURE__*/ Fn(([t_immutable]) => {
  const t = vec3(t_immutable).toVar()

  return t
    .mul(t)
    .mul(t)
    .mul(t.mul(t.mul(6.0).sub(15.0)).add(10.0))
}).setLayout({
  name: 'fade',
  type: 'vec3',
  inputs: [{ name: 't', type: 'vec3' }],
})

/**
 * Permutes a vec4 using a specific formula.
 * @param {vec4} x - Input vector.
 * @returns {vec4} Permuted vector.
 */
export const permute_0 = /*#__PURE__*/ Fn(([x_immutable]) => {
  const x = vec4(x_immutable).toVar()

  return mod(x.mul(34.0).add(1.0).mul(x), 289.0)
}).setLayout({
  name: 'permute_0',
  type: 'vec4',
  inputs: [{ name: 'x', type: 'vec4' }],
})

/**
 * Permutes a float using a specific formula.
 * @param {float} x - Input value.
 * @returns {float} Permuted value.
 */
export const permute_1 = /*#__PURE__*/ Fn(([x_immutable]) => {
  const x = float(x_immutable).toVar()

  return floor(mod(x.mul(34.0).add(1.0).mul(x), 289.0))
}).setLayout({
  name: 'permute_1',
  type: 'float',
  inputs: [{ name: 'x', type: 'float' }],
})

/**
 * Overloaded permute function for vec4 and float.
 * @param {vec4|float} x - Input value.
 * @returns {vec4|float} Permuted value.
 */

export const permute = /*#__PURE__*/ overloadingFn([permute_0, permute_1])

/**
 * Taylor inverse square root for vec4.
 * @param {vec4} r - Input vector.
 * @returns {vec4} Result vector.
 */
export const taylorInvSqrt_0 = /*#__PURE__*/ Fn(([r_immutable]) => {
  const r = vec4(r_immutable).toVar()

  return sub(1.79284291400159, mul(0.85373472095314, r))
}).setLayout({
  name: 'taylorInvSqrt_0',
  type: 'vec4',
  inputs: [{ name: 'r', type: 'vec4' }],
})

/**
 * Taylor inverse square root for float.
 * @param {float} r - Input value.
 * @returns {float} Result value.
 */
export const taylorInvSqrt_1 = /*#__PURE__*/ Fn(([r_immutable]) => {
  const r = float(r_immutable).toVar()

  return sub(1.79284291400159, mul(0.85373472095314, r))
}).setLayout({
  name: 'taylorInvSqrt_1',
  type: 'float',
  inputs: [{ name: 'r', type: 'float' }],
})

/**
 * Overloaded taylorInvSqrt function for vec4 and float.
 * @param {vec4|float} r - Input value.
 * @returns {vec4|float} Result value.
 */

export const taylorInvSqrt = /*#__PURE__*/ overloadingFn([taylorInvSqrt_0, taylorInvSqrt_1])

/**
 * 4D gradient function for simplex noise.
 * @param {float} j - Index value.
 * @param {vec4} ip - Input permutation vector.
 * @returns {vec4} Gradient vector.
 */
export const grad4 = /*#__PURE__*/ Fn(([j_immutable, ip_immutable]) => {
  const ip = vec4(ip_immutable).toVar()
  const j = float(j_immutable).toVar()
  const ones = vec4(1.0, 1.0, 1.0, -1.0)
  const p = vec4().toVar(),
    s = vec4().toVar()
  p.xyz.assign(
    floor(fract(vec3(j).mul(ip.xyz)).mul(7.0))
      .mul(ip.z)
      .sub(1.0),
  )
  p.w.assign(sub(1.5, dot(abs(p.xyz), ones.xyz)))
  s.assign(vec4(lessThan(p, vec4(0.0))))
  p.xyz.assign(p.xyz.add(s.xyz.mul(2.0).sub(1.0).mul(s.www)))

  return p
}).setLayout({
  name: 'grad4',
  type: 'vec4',
  inputs: [
    { name: 'j', type: 'float' },
    { name: 'ip', type: 'vec4' },
  ],
})
