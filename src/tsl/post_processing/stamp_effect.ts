// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, mix, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl'

const LUMA = vec3(0.2126, 0.7152, 0.0722)

/**
 * Creates a stamp filter effect reducing the image to two flat tones by thresholding smoothed luminance.
 * Illustrator's Stamp filter: pre-smooths luminance with a 3×3 box (offset by `smoothing`,
 * a no-op at 0 since all taps collapse onto the center), then applies a smoothstep
 * threshold to split the image into two colors. All params are node-safe, so they can
 * be driven by uniforms as well as plain numbers.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.threshold=0.5] - Luminance threshold for the two-tone split (0-1)
 * @param {number} [props.edgeSoftness=0.02] - Softness of the edge between dark and light tones
 * @param {number} [props.smoothing=0.002] - Pre-smoothing 3×3 box offset in UV units (0 disables)
 * @param {vec3} [props.darkColor=vec3(0,0,0)] - RGB color for dark areas
 * @param {vec3} [props.lightColor=vec3(1,1,1)] - RGB color for light areas
 * @returns {vec4} The stamp-filtered color with original alpha
 */
export const stampEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    threshold = 0.5,
    edgeSoftness = 0.02,
    smoothing = 0.002,
    darkColor = vec3(0, 0, 0),
    lightColor = vec3(1, 1, 1),
  } = props || {}

  const _uv = inputUV().toVar()
  const _threshold = float(threshold)
  const _edgeSoftness = float(edgeSoftness)
  const _smoothing = float(smoothing)

  const originalColor = input.sample(_uv)

  // 3×3 box-smoothed luminance. Offsets are node math so `smoothing` can be a
  // uniform; at 0 every tap samples the center and the average is a no-op.
  const luma = float(0).toVar()
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const tapUV = x === 0 && y === 0 ? _uv : vec2(_uv.x.add(_smoothing.mul(x)), _uv.y.add(_smoothing.mul(y)))
      const tap = x === 0 && y === 0 ? originalColor : input.sample(tapUV)
      luma.addAssign(dot(tap.rgb, LUMA))
    }
  }
  luma.divAssign(9.0)

  // Apply smoothstep to create the two-tone mask
  const mask = smoothstep(_threshold.sub(_edgeSoftness), _threshold.add(_edgeSoftness), luma).toVar()

  const finalRgb = mix(darkColor, lightColor, mask)

  return vec4(finalRgb, originalColor.a)
})
