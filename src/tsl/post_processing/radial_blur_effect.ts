// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, length, screenSize, smoothstep, uv, vec2 } from 'three/tsl'
import { diskBlur } from '../utils/function/disk_blur'

/**
 * Radial blur.
 *
 * Blur grows with distance from a focal `center`: the image stays sharp at the
 * focal point and softens toward the edges. `start`/`end` are distances (in
 * screen-height units, aspect-corrected so the falloff is circular) over which
 * the blur ramps from zero to full `strength`. Pairs naturally with a draggable
 * focal handle, like the chromatic-aberration effect.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=0.05] - Maximum blur radius (fraction of screen height)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Focal point where blur is zero
 * @param {number} [props.start=0.1] - Distance from center where blur begins
 * @param {number} [props.end=0.7] - Distance from center where blur reaches full strength
 * @returns {vec4} The radially blurred color
 */
export const radialBlurEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 0.05, center = vec2(0.5, 0.5), start = 0.1, end = 0.7 } = props || {}

  const _uv = inputUV().toVar()
  const aspect = screenSize.x.div(screenSize.y).toVar()

  // Aspect-corrected distance from the focal point, so the falloff is a circle.
  const toCenter = _uv.sub(center).mul(vec2(aspect, 1.0)).toVar()
  const dist = length(toCenter).toVar()

  const ramp = smoothstep(float(start), float(end), dist).toVar()
  const amount = float(strength).mul(ramp).toVar()

  const _radius = vec2(amount.div(aspect), amount).toVar()

  return diskBlur(input, _uv, _radius)
})
