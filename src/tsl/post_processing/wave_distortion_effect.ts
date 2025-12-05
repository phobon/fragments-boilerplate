import { Fn, float, uv } from 'three/tsl'
import { waveDistortion } from '@/tsl/distortion/wave_distortion'

/**
 * Creates a wave distortion effect for post-processing.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.frequency=10.0] - Frequency of the waves
 * @param {number} [props.amplitude=0.1] - Amplitude of the distortion
 * @param {number} [props.angle=0.0] - Direction angle of the waves (in radians)
 * @param {number} [props.timeOffset] - Time offset for animation
 * @returns {vec4} The wave distorted color
 */
export const waveDistortionEffect = Fn((props) => {
  const { input, inputUV = uv, frequency = 10.0, amplitude = 0.1, angle = 0.0, timeOffset = 0.0 } = props || {}

  const _uv = inputUV().toVar()

  const distortedUV = waveDistortion(_uv, {
    frequency: float(frequency),
    amplitude: float(amplitude),
    angle: float(angle),
    timeOffset: float(timeOffset),
  })
  return input.sample(distortedUV)
})
