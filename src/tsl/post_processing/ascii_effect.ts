// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { clamp, dot, Fn, float, floor, fract, screenSize, texture, uv, vec2, vec3 } from 'three/tsl'

const DEFAULT_PIXEL_SIZE = 16

/**
 * WP2 (docs/shader-perf-implementation-plan.md): the `input`-sampling UV
 * quantisation used by `asciiEffect` below, extracted verbatim (cut-paste,
 * not rewritten — identical math, identical defaults) so it can be composed
 * by WP3's chain planner without re-sampling `input`. This is ONLY the
 * input-UV transform, not the glyph-atlas lookup (`asciiUv`/`characterTexel`
 * below) — that logic samples a different texture (`asciiTexture`) and does
 * not affect this UV, so it is separable and stays in `asciiEffect`. Calling
 * convention: `asciiInputUV(uvNode, args)` — uv first, args second — the
 * same convention the other eight remap effects use (see
 * mirror_distortion_effect.ts).
 * @param {vec2} _uv - The UV coordinates to quantise (aspect corrected internally)
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.pixelSize=DEFAULT_PIXEL_SIZE] - Size of the ascii cell grid, in pixels
 * @returns {vec2} The quantised sampling UV
 */
export const asciiInputUV = Fn(([_uv, options = {}]) => {
  const { pixelSize = DEFAULT_PIXEL_SIZE } = options
  const uv = _uv.toVar()
  const _pixelSize = float(pixelSize)

  const aspect = screenSize.x.div(screenSize.y).toVar()
  const aspectCorrectedUV = vec2(uv.x.mul(aspect), uv.y).toVar()

  const pixelUvSize = _pixelSize.div(screenSize.x)
  const pixelatedUV = floor(aspectCorrectedUV.div(pixelUvSize)).mul(pixelUvSize).toVar()
  const samplingUV = vec2(pixelatedUV.x.div(aspect), pixelatedUV.y).toVar()

  return samplingUV
})

export const asciiEffect = Fn((props) => {
  const { input, inputUV = uv, asciiTexture, charCount, pixelSize = DEFAULT_PIXEL_SIZE } = props || {}

  const _uv = inputUV().toVar()
  const _pixelSize = float(pixelSize)

  const texel = input.sample(asciiInputUV(_uv, { pixelSize })).toVar()

  const perceptualBrightness = dot(vec3(0.299, 0.587, 0.114), texel.rgb)

  const normPixelSize = vec2(_pixelSize.div(screenSize.x), _pixelSize.div(screenSize.y))
  const cellUv = fract(_uv.div(normPixelSize)).toVar()

  const charIndex = clamp(floor(perceptualBrightness.mul(charCount.x.sub(1))), 0, charCount.x.sub(1))
  const asciiUv = vec2(charIndex.add(cellUv.x).div(charCount.x), cellUv.y)
  const characterTexel = texture(asciiTexture, asciiUv).toVar()

  const finalColor = vec3(1).toVar()
  finalColor.assign(characterTexel.mul(texel.rgb).mul(perceptualBrightness.add(0.1).add(finalColor)))

  return finalColor
})
