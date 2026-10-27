// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { abs, cos, dot, Fn, float, screenSize, sin, smoothstep, uv, vec2 } from 'three/tsl'
import { diskBlur } from '../utils/function/disk_blur'

const TAU = Math.PI * 2

/**
 * Tilt-shift blur.
 *
 * Keeps a sharp band across the frame and blurs symmetrically on both sides of
 * it, the look that fakes a miniature/diorama. `center` positions the band along
 * the blur axis, `focusWidth` is the half-thickness of the fully-sharp zone, and
 * `gradient` is how far the blur takes to ramp to full `strength` beyond it.
 * `angle` rotates the band (default is a horizontal band, blur above and below).
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=0.05] - Maximum blur radius (fraction of screen height)
 * @param {number} [props.center=0.5] - Position of the sharp band along the blur axis (0–1)
 * @param {number} [props.focusWidth=0.1] - Half-thickness of the fully-sharp band
 * @param {number} [props.gradient=0.2] - Transition distance from sharp to full blur
 * @param {number} [props.angle=0.25] - Band orientation in turns (0–1); 0.25 = horizontal band
 * @returns {vec4} The tilt-shift blurred color
 */
export const tiltShiftEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    strength = 0.05,
    center = 0.5,
    focusWidth = 0.1,
    gradient = 0.2,
    angle = 0.25,
  } = props || {}

  const _uv = inputUV().toVar()
  const _angle = float(angle).mul(TAU).toVar()
  const direction = vec2(cos(_angle), sin(_angle)).toVar()

  // Signed position along the blur axis, then distance from the sharp band.
  const projected = dot(_uv.sub(0.5), direction).add(0.5).toVar()
  const distFromBand = abs(projected.sub(center)).toVar()

  const _focusWidth = float(focusWidth).toVar()
  const ramp = smoothstep(_focusWidth, _focusWidth.add(gradient), distFromBand).toVar()
  const amount = float(strength).mul(ramp).toVar()

  const aspect = screenSize.x.div(screenSize.y).toVar()
  const _radius = vec2(amount.div(aspect), amount).toVar()

  return diskBlur(input, _uv, _radius)
})
