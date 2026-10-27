// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, length, screenSize, smoothstep, uv, vec2, vec4 } from 'three/tsl'

/**
 * Zoom blur effect (radial blur from center).
 *
 * Radial streaks emanating from a center point, simulating lens zoom motion
 * (like Illustrator/Photoshop's Radial Blur with Zoom method). Accumulates 24
 * samples moving from the current pixel toward the center point. When falloff
 * is 0, blur strength ramps naturally with distance; when falloff > 0, the
 * center remains sharp and blur begins at the falloff distance.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=0.15] - Streak intensity as fraction of distance to center
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Center point of the zoom effect
 * @param {number} [props.falloff=0.0] - Distance at which blur ramps in; center stays sharp when > 0
 * @returns {vec4} The averaged zoom-blurred color
 */
export const zoomBlurEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 0.15, center = vec2(0.5, 0.5), falloff = 0.0 } = props || {}

  const _uv = inputUV().toVar()
  const SAMPLES = 24
  const _strength = float(strength)
  const _falloff = float(falloff)
  const _center = center

  // Aspect-corrected distance for circular falloff
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const toCenter = _uv.sub(_center).mul(vec2(aspect, 1.0)).toVar()
  const distFromCenter = length(toCenter).toVar()

  // Effective strength with falloff ramp
  const falloffRamp = smoothstep(_falloff, float(1.0), distFromCenter).toVar()
  const effectiveStrength = _strength.mul(falloffRamp).toVar()

  // Accumulate samples moving from UV toward center
  const accumulator = vec4(0.0).toVar()

  for (let i = 0; i < SAMPLES; i++) {
    const t = float(i)
      .div(float(SAMPLES - 1))
      .toVar()
    const sampleUV = _uv.add(_center.sub(_uv).mul(effectiveStrength).mul(t)).toVar()
    const sample = input.sample(sampleUV)
    accumulator.addAssign(sample)
  }

  // Average the samples
  return accumulator.div(float(SAMPLES))
})
