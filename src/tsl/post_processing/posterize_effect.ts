// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, floor, pow, uv, vec2, vec3, vec4 } from 'three/tsl'

/**
 * Creates a posterize effect for post-processing with flat-color quantization like Illustrator's Image Trace.
 * Reduces each RGB channel to a limited number of levels producing flat poster-like fills,
 * with a 3×3 pre-smoothing box to merge speckle (a no-op at `smoothing` 0, since all taps
 * collapse onto the center) and a gamma bias that shifts band placement (a no-op at 1).
 * All params are node-safe, so they can be driven by uniforms as well as plain numbers.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.levels=6] - Number of color levels per channel (keep ≥ 2)
 * @param {number} [props.smoothing=0.0015] - Pre-smoothing 3×3 box offset in UV units (0 disables)
 * @param {number} [props.gamma=1.0] - Gamma bias for band placement (applied via pow before quantization and inverse after)
 * @returns {vec4} The posterized color with original alpha
 */
export const posterizeEffect = Fn((props) => {
  const { input, inputUV = uv, levels = 6, smoothing = 0.0015, gamma = 1.0 } = props || {}

  const _uv = inputUV().toVar()
  const _levels = float(levels)
  const _smoothing = float(smoothing)
  const _gamma = float(gamma)

  const originalSample = input.sample(_uv)

  // 3×3 box smoothing. Offsets are node math so `smoothing` can be a uniform;
  // at 0 every tap samples the center and the average is a no-op.
  const color = vec3(0).toVar()
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const tap =
        x === 0 && y === 0
          ? originalSample
          : input.sample(vec2(_uv.x.add(_smoothing.mul(x)), _uv.y.add(_smoothing.mul(y))))
      color.addAssign(tap.rgb)
    }
  }
  color.divAssign(9.0)

  // Gamma bias before quantization (no-op at gamma 1)
  color.assign(pow(color.max(0.0), vec3(_gamma)))

  // Quantize per channel
  const quantizeFactor = _levels.sub(1.0)
  color.assign(floor(color.mul(quantizeFactor).add(0.5)).div(quantizeFactor))

  // Inverse gamma after quantization
  color.assign(pow(color.max(0.0), vec3(float(1.0).div(_gamma))))

  return vec4(color, originalSample.a)
})
