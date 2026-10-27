// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { defined, dot, Fn, float, floor, int, screenSize, uniformArray, uv, vec3, vec4 } from 'three/tsl'

const REC709_LUMA = vec3(0.2126, 0.7152, 0.0722)

const bayerMatrix8x8Values = [
  0.0 / 64.0,
  48.0 / 64.0,
  12.0 / 64.0,
  60.0 / 64.0,
  3.0 / 64.0,
  51.0 / 64.0,
  15.0 / 64.0,
  63.0 / 64.0,
  32.0 / 64.0,
  16.0 / 64.0,
  44.0 / 64.0,
  28.0 / 64.0,
  35.0 / 64.0,
  19.0 / 64.0,
  47.0 / 64.0,
  31.0 / 64.0,
  8.0 / 64.0,
  56.0 / 64.0,
  4.0 / 64.0,
  52.0 / 64.0,
  11.0 / 64.0,
  59.0 / 64.0,
  7.0 / 64.0,
  55.0 / 64.0,
  40.0 / 64.0,
  24.0 / 64.0,
  36.0 / 64.0,
  20.0 / 64.0,
  43.0 / 64.0,
  27.0 / 64.0,
  39.0 / 64.0,
  23.0 / 64.0,
  2.0 / 64.0,
  50.0 / 64.0,
  14.0 / 64.0,
  62.0 / 64.0,
  1.0 / 64.0,
  49.0 / 64.0,
  13.0 / 64.0,
  61.0 / 64.0,
  34.0 / 64.0,
  18.0 / 64.0,
  46.0 / 64.0,
  30.0 / 64.0,
  33.0 / 64.0,
  17.0 / 64.0,
  45.0 / 64.0,
  29.0 / 64.0,
  10.0 / 64.0,
  58.0 / 64.0,
  6.0 / 64.0,
  54.0 / 64.0,
  9.0 / 64.0,
  57.0 / 64.0,
  5.0 / 64.0,
  53.0 / 64.0,
  42.0 / 64.0,
  26.0 / 64.0,
  38.0 / 64.0,
  22.0 / 64.0,
  41.0 / 64.0,
  25.0 / 64.0,
  37.0 / 64.0,
  21.0 / 64.0,
]

const bayerMatrix = uniformArray(bayerMatrix8x8Values)

const getBayerValue8x8 = Fn(([x, y]) => {
  const index = y.mul(8).add(x)
  return bayerMatrix.element(index)
})

const dither = Fn(([_uv, resolution, color, colorThreshold, bias]) => {
  const levels = float(colorThreshold).sub(1.0)
  const _color = color.toVar()

  const x = int(_uv.x.mul(resolution.x)).mod(8)
  const y = int(_uv.y.mul(resolution.y)).mod(8)
  const threshold = getBayerValue8x8(x, y).sub(bias)

  _color.rgb.addAssign(threshold)

  _color.r.assign(floor(_color.r.mul(levels).add(0.5)).div(levels))
  _color.g.assign(floor(_color.g.mul(levels).add(0.5)).div(levels))
  _color.b.assign(floor(_color.b.mul(levels).add(0.5)).div(levels))

  return _color
})

const readConstValue = (value: unknown): unknown => {
  if (value != null && typeof value === 'object' && 'isNode' in value && (value as { isNode: boolean }).isNode) {
    let resolved: unknown = value
    ;(
      value as {
        traverse: (cb: (node: { isConstNode?: boolean; value?: unknown }) => void) => void
      }
    ).traverse((node) => {
      if (node.isConstNode) {
        resolved = node.value
      }
    })
    return resolved
  }

  return value
}

const parseTintVec3 = (tint: unknown) => {
  const plain = readConstValue(tint)

  if (typeof plain === 'string') {
    const hex = plain.replace('#', '')
    if (hex.length === 6) {
      return vec3(
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      )
    }
  }

  if (Array.isArray(plain) && plain.length >= 3) {
    return vec3(plain[0], plain[1], plain[2])
  }

  return vec3(1, 1, 1)
}

/**
 * Creates a dithering effect for post-processing using an 8x8 Bayer matrix.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.pixelSize=2] - Size of dithering pixels in screen pixels
 * @param {number} [props.colorThreshold=0.25] - Threshold for color quantization (0-1)
 * @param {number} [props.bias=0.15] - Bias added to dithering pattern (0-1)
 * @param {boolean} [props.useTint=false] - When true, dither luminance then multiply by tint
 * @param {string} [props.tint='#ffffff'] - Hex tint color (used when useTint is true)
 * @returns {vec4} The dithered color output
 */
export const ditherEffect = Fn((props) => {
  const {
    input,
    inputUV = uv,
    pixelSize = 2,
    colorThreshold = 0.35,
    bias = 0.25,
    useTint = false,
    tint = '#ffffff',
  } = props || {}

  const _uv = inputUV().toVar()
  const scaledResolution = screenSize.div(float(pixelSize))
  const useTintEnabled = defined(useTint)
  const tintColor = useTintEnabled ? parseTintVec3(tint) : null

  const sourceColor = tintColor ? vec3(dot(REC709_LUMA, input.rgb)) : input.rgb
  const finalColor = dither(_uv, scaledResolution, sourceColor, colorThreshold, bias)
  const colorizedResult = tintColor ? finalColor.mul(tintColor) : finalColor

  return vec4(colorizedResult, input.a)
})
