import { Fn, vec3, float, screenSize, vec4, uv, dot, If, int, floor } from 'three/tsl'

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

const getBayerValue8x8 = Fn(([x, y]) => {
  const index = y.mul(8).add(x).toVar()
  const value = float(0.0).toVar()

  // Unroll the array lookup using conditionals
  for (let i = 0; i < 64; i++) {
    If(index.equal(i), () => {
      value.assign(bayerMatrix8x8Values[i])
    })
  }

  return value
})

const dither = Fn(([_uv, resolution, color, colorThreshold, bias]) => {
  const colorNum = float(colorThreshold)
  const _color = color.toVar()

  const x = int(_uv.x.mul(resolution.x)).mod(8)
  const y = int(_uv.y.mul(resolution.y)).mod(8)
  const threshold = getBayerValue8x8(x, y).sub(bias).toVar()

  _color.rgb.addAssign(threshold)

  _color.r.assign(floor(_color.r.mul(colorNum.sub(1.0)).add(0.5)).div(colorNum.sub(1.0)))
  _color.g.assign(floor(_color.g.mul(colorNum.sub(1.0)).add(0.5)).div(colorNum.sub(1.0)))
  _color.b.assign(floor(_color.b.mul(colorNum.sub(1.0)).add(0.5)).div(colorNum.sub(1.0)))

  return _color
})

/**
 * Creates a dithering effect for post-processing using an 8x8 Bayer matrix.
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {Function} [props.inputUV=uv] - Function returning UV coordinates, defaults to screen UV
 * @param {number} [props.pixelSize=2] - Size of dithering pixels in screen pixels
 * @param {number} [props.colorThreshold=0.25] - Threshold for color quantization (0-1)
 * @param {number} [props.bias=0.15] - Bias added to dithering pattern (0-1)
 * @param {vec3} [props.color=null] - Optional color to tint the dithered result
 * @returns {vec4} The dithered color output
 */
export const ditherEffect = Fn((props) => {
  const { input, inputUV = uv, pixelSize = 2, colorThreshold = 0.35, bias = 0.25, color = null } = props || {}

  const _uv = inputUV().toVar()

  // Scale resolution by pixelSize so Bayer matrix tiles at the block level
  const scaledResolution = screenSize.div(float(pixelSize))

  const sourceColor = color ? vec3(dot(vec3(0.2126, 0.7152, 0.0722), input.rgb)) : input.rgb
  const finalColor = dither(_uv, scaledResolution, sourceColor, colorThreshold, bias)

  const colorizedResult = color ? finalColor.mul(color) : finalColor

  return vec4(colorizedResult, input.a)
})
