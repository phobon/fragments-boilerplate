import { Fn, float, vec3, Loop, mul, add, div, vec2 } from 'three/tsl'
import { simplexNoise3d } from './simplex_noise_3d'

type FbmOptions = {
  octaves?: number
  frequency?: number
  amplitude?: number
  lacunarity?: number
  gain?: number
}

type DomainWarpedFbmOptions = FbmOptions & {
  warpStrength?: number
}

type WarpedFbmCoordsOptions = {
  frequency?: number
  offset1?: number
  offset2?: number
  oscillation1?: number
  oscillation2?: number
  contribution1?: number
  contribution2?: number
}

/**
 * Fractal Brownian Motion (FBM) using 3D simplex noise.
 * Combines multiple octaves of noise at different frequencies and amplitudes.
 * @param {vec3} p - Input 3D position.
 * @param {Object} [options] - Optional configuration values.
 * @param {float} [options.octaves=4.0] - Number of noise octaves.
 * @param {float} [options.frequency=1.0] - Base frequency.
 * @param {float} [options.amplitude=1.0] - Base amplitude.
 * @param {float} [options.lacunarity=2.0] - Frequency multiplier between octaves.
 * @param {float} [options.gain=0.5] - Amplitude multiplier between octaves.
 * @returns {float} FBM noise value.
 */
export const fbm = Fn(([p, options = {}]) => {
  const { octaves = 4.0, frequency = 1.0, amplitude = 1.0, lacunarity = 2.0, gain = 0.5 } =
    options as FbmOptions
  const value = float(0.0).toVar()
  const currentAmplitude = float(amplitude).toVar()
  const currentFrequency = float(frequency).toVar()
  const maxValue = float(0.0).toVar()

  // @ts-ignore
  Loop({ start: 0.0, end: octaves, type: 'float' }, ({ i }) => {
    // Sample noise at current frequency
    const noiseValue = simplexNoise3d(mul(p, currentFrequency))

    // Add to accumulated value
    value.addAssign(mul(noiseValue, currentAmplitude))

    // Track maximum possible value for normalization
    maxValue.addAssign(currentAmplitude)

    // Update frequency and amplitude for next octave
    currentFrequency.mulAssign(lacunarity)
    currentAmplitude.mulAssign(gain)
  })

  // Normalize the result to [-1, 1] range
  return div(value, maxValue)
})

/**
 * Ridged FBM variant that creates sharp ridges.
 * @param {vec3} p - Input 3D position.
 * @param {Object} [options] - Optional configuration values.
 * @param {float} [options.octaves=4.0] - Number of noise octaves.
 * @param {float} [options.frequency=1.0] - Base frequency.
 * @param {float} [options.amplitude=1.0] - Base amplitude.
 * @param {float} [options.lacunarity=2.0] - Frequency multiplier between octaves.
 * @param {float} [options.gain=0.5] - Amplitude multiplier between octaves.
 * @returns {float} Ridged FBM noise value.
 */
export const ridgedFbm = Fn(([p, options = {}]) => {
  const { octaves = 4.0, frequency = 1.0, amplitude = 1.0, lacunarity = 2.0, gain = 0.5 } =
    options as FbmOptions
  const value = float(0.0).toVar()
  const currentAmplitude = float(amplitude).toVar()
  const currentFrequency = float(frequency).toVar()
  const maxValue = float(0.0).toVar()

  // @ts-ignore
  Loop({ start: 0.0, end: octaves, type: 'float' }, ({ i }) => {
    // Sample noise and create ridges by taking absolute value and inverting
    const noiseValue = simplexNoise3d(mul(p, currentFrequency))
    const ridgedValue = float(1.0).sub(noiseValue.abs())

    // Square the ridged value to make ridges sharper
    const sharpRidges = ridgedValue.mul(ridgedValue)

    // Add to accumulated value
    value.addAssign(mul(sharpRidges, currentAmplitude))

    // Track maximum possible value for normalization
    maxValue.addAssign(currentAmplitude)

    // Update frequency and amplitude for next octave
    currentFrequency.mulAssign(lacunarity)
    currentAmplitude.mulAssign(gain)
  })

  // Normalize the result to [0, 1] range
  return div(value, maxValue)
})

/**
 * Domain warped FBM that uses FBM to warp the input coordinates.
 * @param {vec3} p - Input 3D position.
 * @param {Object} [options] - Optional configuration values.
 * @param {float} [options.octaves=4.0] - Number of noise octaves.
 * @param {float} [options.frequency=1.0] - Base frequency.
 * @param {float} [options.amplitude=1.0] - Base amplitude.
 * @param {float} [options.lacunarity=2.0] - Frequency multiplier between octaves.
 * @param {float} [options.gain=0.5] - Amplitude multiplier between octaves.
 * @param {float} [options.warpStrength=0.1] - Strength of domain warping.
 * @returns {float} Domain warped FBM noise value.
 */
export const domainWarpedFbm = Fn(([p, options = {}]) => {
  const {
    octaves = 4.0,
    frequency = 1.0,
    amplitude = 1.0,
    lacunarity = 2.0,
    gain = 0.5,
    warpStrength = 0.1,
  } = options as DomainWarpedFbmOptions
  // Create warping offset using FBM
  const warpOffset = vec3(
    fbm(p, { octaves, frequency, amplitude, lacunarity, gain }),
    fbm(add(p, vec3(100.0)), { octaves, frequency, amplitude, lacunarity, gain }),
    fbm(add(p, vec3(200.0)), { octaves, frequency, amplitude, lacunarity, gain }),
  )

  // Apply warping to input position
  const warpedP = add(p, mul(warpOffset, warpStrength))

  // Sample FBM at warped position
  return fbm(warpedP, { octaves, frequency, amplitude, lacunarity, gain })
})

/**
 * Warped FBM coordinates that uses FBM to warp the input coordinates.
 * @param {vec2} uv0 - Input 2D position.
 * @param {float} _time - Time.
 * @param {Object} [options] - Optional configuration values.
 * @param {float} [options.frequency=25] - Frequency multiplier.
 * @param {float} [options.offset1=25] - First offset amount.
 * @param {float} [options.offset2=75] - Second offset amount.
 * @param {float} [options.oscillation1=10] - Primary oscillation frequency.
 * @param {float} [options.oscillation2=3] - Secondary oscillation frequency.
 * @param {float} [options.contribution1=0.2] - Primary contribution weight.
 * @param {float} [options.contribution2=0.1] - Secondary contribution weight.
 * @returns {float} Warped FBM noise value.
 * @example
 */
export const warpedFbmCoords = Fn(([uv0, _time, options = {}]) => {
  const {
    frequency = 25,
    offset1 = 25,
    offset2 = 75,
    oscillation1 = 10,
    oscillation2 = 3,
    contribution1 = 0.2,
    contribution2 = 0.1,
  } = options as WarpedFbmCoordsOptions
  const _uv = uv0.toVar()

  // // First layer of warping
  const warp1X = fbm(vec3(_uv.mul(oscillation1), _time))
  const warp1Y = fbm(vec3(_uv.mul(oscillation1).add(offset1), _time))
  const warp1 = vec2(warp1X, warp1Y).sub(0.5).mul(contribution1)
  const warpedUV1 = _uv.add(warp1)

  // Second layer of warping on the already warped coordinates
  const warp2X = fbm(vec3(warpedUV1.mul(oscillation2), _time.mul(0.5)))
  const warp2Y = fbm(vec3(warpedUV1.mul(oscillation2).add(offset2), _time.mul(0.5)))
  const warp2 = vec2(warp2X, warp2Y).sub(0.5).mul(contribution2)
  const finalUV = warpedUV1.add(warp2)

  // Sample final pattern with warped coordinates
  const n = simplexNoise3d(vec3(finalUV.mul(frequency), _time))
  return n
})
