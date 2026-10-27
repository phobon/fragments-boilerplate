// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { cos, dot, Fn, float, sin, vec2 } from 'three/tsl'

type WaveDistortionOptions = {
  frequency?: ReturnType<typeof float>
  amplitude?: ReturnType<typeof float>
  angle?: ReturnType<typeof float>
  timeOffset?: ReturnType<typeof float>
}

/**
 * Applies a wave distortion to UV coordinates.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.frequency=10.0] - Frequency of the waves.
 * @param {number} [options.amplitude=0.1] - Amplitude of the distortion.
 * @param {number} [options.angle=0.0] - Direction angle of the waves (in radians).
 * @param {number} [options.timeOffset=0.0] - Time offset for animation.
 * @returns {vec2} Distorted UV coordinates
 */
export const waveDistortion = Fn(([_uv, options = {}]) => {
  const {
    frequency = float(10.0),
    amplitude = float(0.1),
    angle = float(0),
    timeOffset = float(0),
  } = options as WaveDistortionOptions
  const uv = _uv.toVar()

  // Create direction vector from angle
  const direction = vec2(cos(angle), sin(angle)).toVar()

  // Calculate wave phase (perpendicular to direction)
  const wavePhase = dot(uv, direction).mul(frequency).add(timeOffset)

  // Create displacement perpendicular to wave direction
  const perpendicular = vec2(direction.y.negate(), direction.x).toVar()
  const displacement = perpendicular.mul(sin(wavePhase).mul(amplitude))

  // Apply displacement to UV
  const distortedUV = uv.add(displacement)

  return distortedUV
})
