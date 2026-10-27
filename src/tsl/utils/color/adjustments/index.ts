/**
 * Image adjustment functions — color-in/color-out helpers applied to a
 * sampled image the same way the tonemapping functions are (NOT
 * post-processing effects; chain them inside a shader's colorNode):
 *
 *   const col = texture(photo, uv()).rgb
 *   return vec4(sepia(grayscale(col, 0.5), 1.0), 1.0)
 *
 * Every `amount` argument accepts a plain number OR a TSL node (e.g. an
 * exported `uniform()` driven by the app's dial panel), and 0 always means
 * "unchanged" except where documented (brightness/contrast/saturation/gamma
 * are neutral at 1, exposure at 0).
 */

export * from './brightness'
export * from './contrast'
export * from './exposure'
export * from './gamma'
export * from './grayscale'
export * from './hue_rotate'
export * from './invert'
export * from './saturation'
export * from './sepia'
export * from './vignette'
