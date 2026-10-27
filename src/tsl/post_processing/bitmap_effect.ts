// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, floor, mix, screenSize, step, uv, vec2, vec3, vec4 } from 'three/tsl'

/**
 * Creates a bitmap/rasterize effect for post-processing at low PPI.
 * Hard 1-bit black/white quantization at chunky pixel resolution, like Illustrator's Rasterize → Bitmap.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Optional UV coordinates to sample from (defaults to built-in uv)
 * @param {number} [props.size=20.0] - Size of the bitmap blocks (higher values = larger pixels)
 * @param {number} [props.threshold=0.5] - Luminance threshold for black/white conversion (0-1)
 * @param {vec3} [props.darkColor=vec3(0,0,0)] - Color for dark (bit = 0) regions
 * @param {vec3} [props.lightColor=vec3(1,1,1)] - Color for light (bit = 1) regions
 * @returns {vec4} The bitmap-quantized color
 */
export const bitmapEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    size = 20.0,
    threshold = 0.5,
    darkColor = vec3(0, 0, 0),
    lightColor = vec3(1, 1, 1),
  } = props || {}

  const _uv = inputUV().toVar()
  const _size = float(size)
  const _threshold = float(threshold)

  // Aspect correct UV coordinates
  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(_uv.x.mul(aspect), _uv.y).toVar()

  // Quantize into square cells (same as pixellation_effect)
  const cellSize = _size.div(1000.0) // Normalize to reasonable range
  const quantizedUV = floor(aspectCorrectedUV.div(cellSize)).mul(cellSize).toVar()

  // Reverse aspect correction for sampling
  const samplingUV = vec2(quantizedUV.x.div(aspect), quantizedUV.y).toVar()

  // Sample the input at the snapped UV
  const sampledColor = input.sample(samplingUV).toVar()

  // Compute luminance (Rec. 709)
  const luminance = dot(sampledColor.rgb, vec3(0.2126, 0.7152, 0.0722)).toVar()

  // Hard threshold: step(threshold, luma) returns 1 if luma >= threshold, else 0
  const bit = step(_threshold, luminance).toVar()

  // Mix between dark and light colors
  const finalRgb = mix(darkColor, lightColor, bit)

  // Original alpha sampled at the snapped UV
  return vec4(finalRgb, sampledColor.a)
})
