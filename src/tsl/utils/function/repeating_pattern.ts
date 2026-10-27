import { Fn, float, sin } from 'three/tsl'

/**
 * Returns a repeating pattern of a sine function.
 * @param {float} pattern - The input pattern value.
 * @param {float} repeat - The repeat frequency.
 * @param {float} [_time=0] - The time offset.
 * @returns {float} The repeated sine pattern value.
 */
export const repeatingPattern = Fn(([pattern, repeat, _time = float(0)]) => {
  pattern.assign(sin(pattern.mul(repeat).add(_time)).div(repeat))
  return pattern
})
