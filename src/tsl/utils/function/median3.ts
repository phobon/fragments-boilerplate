import { Fn, float, If } from 'three/tsl'

export const median3 = Fn(([a, b, c]) => {
  const _a = float(a)
  const _b = float(b)
  const _c = float(c)

  const returnVal = float(_c).toVar()

  const term1 = _a.lessThanEqual(_b).and(_b.lessThanEqual(_c))
  const term2 = _c.lessThanEqual(_b).and(_b.lessThanEqual(_a))
  const term3 = _b.lessThanEqual(_a).and(_a.lessThanEqual(_c))
  const term4 = _c.lessThanEqual(_a).and(_a.lessThanEqual(_b))

  If(term1.or(term2), () => {
    returnVal.assign(_b)
  }).ElseIf(term3.or(term4), () => {
    returnVal.assign(_a)
  })

  return returnVal
})
