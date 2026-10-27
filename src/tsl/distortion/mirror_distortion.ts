// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { abs, cos, dot, Fn, float, sin, vec2 } from 'three/tsl'

const TAU = Math.PI * 2

type MirrorDistortionOptions = {
  center?: ReturnType<typeof vec2>
  angle?: ReturnType<typeof float>
  offset?: ReturnType<typeof float>
}

/**
 * Mirrors the UV across a line. Everything on the near side of the line is folded
 * onto the far side, producing a clean reflection. The line passes through
 * `center` (shifted by `offset` along its normal) at orientation `angle`.
 * @param {vec2} _uv - The UV coordinates - aspect corrected provide best results
 * @param {Object} [options] - Optional configuration values.
 * @param {vec2} [options.center=vec2(0.5)] - Point the mirror line passes through
 * @param {number} [options.angle=0.0] - Orientation of the mirror normal in turns (0–1)
 * @param {number} [options.offset=0.0] - Shift of the mirror line along its normal
 * @returns {vec2} Distorted UV coordinates
 */
export const mirrorDistortion = Fn(([_uv, options = {}]) => {
  const { center = vec2(0.5), angle = float(0), offset = float(0) } = options as MirrorDistortionOptions
  const uv = _uv.toVar()

  const _angle = float(angle).mul(TAU).toVar()
  const normal = vec2(cos(_angle), sin(_angle)).toVar()
  const centered = uv.sub(center).toVar()

  // Signed distance from the mirror line; fold the negative side over.
  const signed = dot(centered, normal).sub(offset).toVar()
  const delta = abs(signed).sub(signed).toVar()
  const mirrored = centered.add(normal.mul(delta)).toVar()

  return center.add(mirrored)
})
