// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { cos, dot, Fn, float, sin, vec2 } from 'three/tsl'

const TAU = Math.PI * 2

type StretchDistortionOptions = {
  center?: ReturnType<typeof vec2>
  angle?: ReturnType<typeof float>
  strength?: ReturnType<typeof float>
}

/**
 * Directional stretch (or squeeze) about a centre. The component of the UV along
 * `angle` is scaled, magnifying the content there when `strength` is positive and
 * compressing it when negative; the perpendicular axis is untouched.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {vec2} [options.center=vec2(0.5)] - Anchor the stretch pulls from
 * @param {number} [options.angle=0.0] - Stretch axis in turns (0–1); 0 = horizontal
 * @param {number} [options.strength=0.5] - Stretch amount (>0 stretch, <0 squeeze; keep > -1)
 * @returns {vec2} Distorted UV coordinates
 */
export const stretchDistortion = Fn(([_uv, options = {}]) => {
  const { center = vec2(0.5), angle = float(0), strength = float(0.5) } = options as StretchDistortionOptions
  const uv = _uv.toVar()

  const _angle = float(angle).mul(TAU).toVar()
  const direction = vec2(cos(_angle), sin(_angle)).toVar()
  const centered = uv.sub(center).toVar()

  // Split into along-axis / perpendicular, scale only the along-axis part.
  const along = dot(centered, direction).toVar()
  const perpendicular = centered.sub(direction.mul(along)).toVar()
  const scaledAlong = along.div(float(strength).add(1.0)).toVar()

  const distorted = direction.mul(scaledAlong).add(perpendicular).toVar()

  return center.add(distorted)
})
