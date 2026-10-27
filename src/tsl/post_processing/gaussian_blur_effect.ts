// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, screenSize, uv, vec2 } from 'three/tsl'
import { diskBlur } from '../utils/function/disk_blur'

/**
 * Uniform gaussian blur.
 *
 * Applies the same gaussian-weighted disk kernel to every pixel, so the whole
 * frame is softened evenly. `radius` is expressed as a fraction of screen height
 * and aspect-corrected on the x axis, keeping the blur circular on any viewport.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.radius=0.02] - Blur radius as a fraction of screen height (0 = none)
 * @returns {vec4} The blurred color
 */
export const gaussianBlurEffect = Fn((props) => {
  const { input, inputUV = uv, radius = 0.02 } = props || {}

  const _uv = inputUV().toVar()
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const _radius = vec2(float(radius).div(aspect), float(radius)).toVar()

  return diskBlur(input, _uv, _radius)
})
