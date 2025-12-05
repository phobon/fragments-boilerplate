import { Fn, sin, Loop, float, mat2 } from 'three/tsl'

type TurbulenceOptions = {
  _num?: number
  _amp?: number
  _speed?: number
  _freq?: number
  _exp?: number
}

/**
 * Turbulence noise function originally created by @XorDev
 * https://www.shadertoy.com/view/WclSWn
 * @param {vec2} p - Input coordinates.
 * @param {float} _time - Time uniform for animation.
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options._num=10.0] - Number of octaves to evaluate.
 * @param {number} [options._amp=0.7] - Amplitude multiplier per octave.
 * @param {number} [options._speed=0.3] - Scroll speed for animation.
 * @param {number} [options._freq=2.0] - Base frequency.
 * @param {number} [options._exp=1.4] - Frequency growth factor per octave.
 */
export const turbulence = Fn(([p, _time, options = {}]) => {
  const { _num = 10.0, _amp = 0.7, _speed = 0.3, _freq = 2.0, _exp = 1.4 } = options as TurbulenceOptions
  // Turbulence starting scale
  const freq = float(_freq).toVar()
  const speed = float(_speed).toVar()
  const amp = float(_amp).toVar()

  // Turbulence rotation matrix
  const rot = mat2(0.6, -0.8, 0.8, 0.6).toVar()

  //Loop through turbulence octaves
  Loop({ start: 0.0, end: _num, type: 'float' }, ({ i }) => {
    //Scroll along the rotated y coordinate
    const phase = freq.mul(p.mul(rot).y).add(speed.mul(_time)).add(i)

    //Add a perpendicular sine wave offset
    p.addAssign(amp.mul(rot[0]).mul(sin(phase)).div(freq))

    //Rotate for the next octave
    rot.mulAssign(mat2(0.6, -0.8, 0.8, 0.6))

    //Scale down for the next octave
    freq.mulAssign(_exp)
  })

  return p
})
