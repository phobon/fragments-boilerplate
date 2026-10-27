// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { cos, dot, Fn, float, screenSize, sin, smoothstep, uv, vec2 } from 'three/tsl'
import { diskBlur } from '../utils/function/disk_blur'

const TAU = Math.PI * 2

/**
 * Progressive (linear) blur.
 *
 * The blur amount ramps along a single axis: the frame stays sharp on one side
 * and grows progressively softer toward the other. The gradient direction is set
 * by `angle`, and `start`/`end` mark where along that axis the blur ramps from
 * zero to full `strength`. Because the per-fragment radius is just scaled by a
 * gradient, it reuses the same disk kernel as the uniform gaussian.
 *
 * Defaults blur from the top (sharp) to the bottom (soft) of the frame.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=0.04] - Maximum blur radius (fraction of screen height)
 * @param {number} [props.angle=0.75] - Gradient direction in turns (0–1); 0.75 ≈ top→bottom
 * @param {number} [props.start=0.0] - Axis position (0–1) where blur begins
 * @param {number} [props.end=1.0] - Axis position (0–1) where blur reaches full strength
 * @returns {vec4} The progressively blurred color
 */
export const progressiveBlurEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 0.04, angle = 0.75, start = 0.0, end = 1.0 } = props || {}

  const _uv = inputUV().toVar()
  const _angle = float(angle).mul(TAU).toVar()
  const direction = vec2(cos(_angle), sin(_angle)).toVar()

  // Position along the gradient axis, remapped from centred coords back to 0–1.
  const projected = dot(_uv.sub(0.5), direction).add(0.5).toVar()
  const ramp = smoothstep(float(start), float(end), projected).toVar()
  const amount = float(strength).mul(ramp).toVar()

  const aspect = screenSize.x.div(screenSize.y).toVar()
  const _radius = vec2(amount.div(aspect), amount).toVar()

  return diskBlur(input, _uv, _radius)
})
