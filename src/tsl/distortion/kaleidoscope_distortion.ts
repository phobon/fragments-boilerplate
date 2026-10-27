// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { abs, atan, cos, Fn, float, length, mod, sin, vec2 } from 'three/tsl'

const TAU = Math.PI * 2

type KaleidoscopeDistortionOptions = {
  sides?: ReturnType<typeof float>
  rotation?: ReturnType<typeof float>
  center?: ReturnType<typeof vec2>
}

/**
 * Kaleidoscope mirror. The angle around `center` is folded into `sides` mirrored
 * wedges, so one slice of the source is repeated and reflected symmetrically.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.sides=6.0] - Number of mirrored segments
 * @param {number} [options.rotation=0.0] - Angular offset in turns (0–1)
 * @param {vec2} [options.center=vec2(0.5)] - Centre of the kaleidoscope
 * @returns {vec2} Distorted UV coordinates
 */
export const kaleidoscopeDistortion = Fn(([_uv, options = {}]) => {
  const { sides = float(6), rotation = float(0), center = vec2(0.5) } = options as KaleidoscopeDistortionOptions
  const uv = _uv.toVar()
  const offset = uv.sub(center).toVar()

  const radius = length(offset).toVar()
  const segment = float(TAU).div(sides).toVar()
  const angle = atan(offset.y, offset.x).add(float(rotation).mul(TAU)).toVar()

  // Fold the angle into a single wedge and mirror it about the wedge centre.
  const folded = abs(mod(angle, segment).sub(segment.mul(0.5))).toVar()
  const direction = vec2(cos(folded), sin(folded)).toVar()

  return center.add(direction.mul(radius))
})
