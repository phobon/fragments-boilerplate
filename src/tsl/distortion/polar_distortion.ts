// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { atan, Fn, float, fract, length, vec2 } from 'three/tsl'

const TAU = Math.PI * 2

type PolarDistortionOptions = {
  center?: ReturnType<typeof vec2>
  scale?: ReturnType<typeof float>
  rotation?: ReturnType<typeof float>
}

/**
 * Remaps UV coordinates into polar space — angle becomes the horizontal axis and
 * distance-from-centre the vertical axis. Wrapping an image through this produces
 * the classic "polar coordinates" / tunnel look.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {vec2} [options.center=vec2(0.5)] - Centre the angle/radius are measured from
 * @param {number} [options.scale=1.0] - Multiplier on the radius axis (zoom of the radial mapping)
 * @param {number} [options.rotation=0.0] - Angular offset in turns (0–1)
 * @returns {vec2} Distorted UV coordinates
 */
export const polarDistortion = Fn(([_uv, options = {}]) => {
  const { center = vec2(0.5), scale = float(1), rotation = float(0) } = options as PolarDistortionOptions
  const uv = _uv.toVar()
  const offset = uv.sub(center).toVar()

  const radius = length(offset).toVar()
  const angle = atan(offset.y, offset.x).toVar()

  // angle → 0..1 (with rotation, wrapped), radius → scaled vertical axis
  const u = fract(angle.div(TAU).add(0.5).add(rotation)).toVar()
  const v = radius.mul(scale).toVar()

  return vec2(u, v)
})
