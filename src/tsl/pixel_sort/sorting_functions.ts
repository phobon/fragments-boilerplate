import { wgslFn } from 'three/tsl'

/**
 * Pixel-sort comparator functions consumed by the pixel-sort compute kernel
 * (`pixel_sort.tsx`'s `computePingPongWGSL`, via its `sortFn` include) and by
 * `PixelSort`'s `sortFn` prop. Every comparator shares one WGSL signature:
 *
 *   fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool
 *
 * Returning `true` swaps `pixel` ahead of `neighbor` for the current pass.
 * These stay `wgslFn` rather than `Fn` on purpose: they're referenced by
 * name (`sort(...)`) from inside the kernel's raw WGSL string, and
 * `wgslFn`'s `includes` array only accepts other WGSL function nodes (see
 * three's `FunctionNode`/`nativeFn`), not plain TSL `Fn` closures. They're
 * also re-exported individually as a function-node starter preset —
 * `SORT_FUNCTIONS_PRESET_CODE` in the host app's `function_editor_default.ts`.
 *
 * @param {vec3} pixel Current pixel color
 * @param {vec3} neighbor Neighbor pixel color
 * @param {vec2i} pixelPos Current pixel's grid position
 * @param {vec2i} neighborPos Neighbor pixel's grid position
 * @param {vec2i} gridSize Buffer dimensions
 * @returns {bool} True to swap `pixel` ahead of `neighbor`
 */

/** Sorts by luminance (Rec. 601 weights), brightest first. */
export const sortLuminance = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelLum = dot(pixel, vec3<f32>(0.299, 0.587, 0.114));
    let neighborLum = dot(neighbor, vec3<f32>(0.299, 0.587, 0.114));

    return pixelLum > neighborLum;
  }
`)

/** Sorts by brightness (max of the r/g/b channels), brightest first. */
export const sortBrightness = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelBrightness = max(pixel.r, max(pixel.g, pixel.b));
    let neighborBrightness = max(neighbor.r, max(neighbor.g, neighbor.b));

    return pixelBrightness > neighborBrightness;
  }
`)

/** Sorts by the average of the r/g/b channels, highest average first. */
export const sortAverage = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelAverage = (pixel.r + pixel.g + pixel.b) / 3.0;
    let neighborAverage = (neighbor.r + neighbor.g + neighbor.b) / 3.0;

    return pixelAverage > neighborAverage;
  }
`)

/** Sorts by the red channel, ascending (smaller red values move left). */
export const sortRed = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    // Only swap if current pixel's red is greater than neighbor's red
    // This implements ascending sort (smaller red values to the left)
    return pixel.r > neighbor.r;
  }
`)

/** Sorts by the red channel, descending (larger red values move left). */
export const sortRedDescending = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    // Descending sort (larger red values to left)
    return pixel.r < neighbor.r;
  }
`)

/** Sorts by the red channel, but only swaps past a 0.01 difference threshold to prevent infinite sorting of near-identical pixels. */
export const sortRedStable = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    // Only swap if there's a significant difference to prevent infinite sorting
    let redDiff = pixel.r - neighbor.r;
    return redDiff > 0.01; // Only swap if difference is meaningful
  }
`)

/** Sorts by the green channel, highest first. */
export const sortGreen = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    return pixel.g > neighbor.g;
  }
`)

/** Sorts by the blue channel, highest first. */
export const sortBlue = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    return pixel.b > neighbor.b;
  }
`)

/** Pseudo-random ordering derived from a position-based hash (Blum Blum Shub), independent of pixel color. */
export const sortRandom = wgslFn(`
  fn sortSeed(p: vec2<u32>) -> u32 {
    return 19u * p.x + 47u * p.y + 101u;
  }

  fn sortBbs(s: u32) -> u32 {
    var v = s;
    v = v % 65521u;
    v = (v * v) % 65521u;
    v = (v * v) % 65521u;
    return v;
  }

  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let v = vec2<u32>(u32(pixelPos.x), u32(pixelPos.y));
    let h = sortBbs(sortSeed(v));

    return f32(h) / 65520.0 > 0.05;
  }
`)

// Enhanced sorting functions for better segment-based sorting

/** Sorts by perceptual luminance (Rec. 709 weights), brightest first. */
export const sortLuminancePerceptual = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    return pixelLum > neighborLum;
  }
`)

/** Sorts by HSV value (the max of the r/g/b channels), highest first. */
export const sortHSVValue = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelValue = max(pixel.r, max(pixel.g, pixel.b));
    let neighborValue = max(neighbor.r, max(neighbor.g, neighbor.b));

    return pixelValue > neighborValue;
  }
`)

/** Sorts by HSV saturation, most saturated first. */
export const sortHSVSaturation = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelMax = max(pixel.r, max(pixel.g, pixel.b));
    let pixelMin = min(pixel.r, min(pixel.g, pixel.b));
    var pixelSaturation: f32;
    if (pixelMax > 0.0) {
      pixelSaturation = (pixelMax - pixelMin) / pixelMax;
    } else {
      pixelSaturation = 0.0;
    }

    let neighborMax = max(neighbor.r, max(neighbor.g, neighbor.b));
    let neighborMin = min(neighbor.r, min(neighbor.g, neighbor.b));
    var neighborSaturation: f32;
    if (neighborMax > 0.0) {
      neighborSaturation = (neighborMax - neighborMin) / neighborMax;
    } else {
      neighborSaturation = 0.0;
    }

    return pixelSaturation > neighborSaturation;
  }
`)

/** Sorts by an approximate color temperature (average level biased by red-blue warmth), warmest first. */
export const sortColorTemperature = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    // Calculate color temperature approximation
    let pixelTemp = (pixel.r + pixel.g + pixel.b) / 3.0;
    let neighborTemp = (neighbor.r + neighbor.g + neighbor.b) / 3.0;

    // Also consider warmth (red-blue difference)
    let pixelWarmth = pixel.r - pixel.b;
    let neighborWarmth = neighbor.r - neighbor.b;

    // Combine temperature and warmth for more accurate sorting
    let pixelScore = pixelTemp + pixelWarmth * 0.5;
    let neighborScore = neighborTemp + neighborWarmth * 0.5;

    return pixelScore > neighborScore;
  }
`)

/** Sorts by edge strength (the luminance difference between pixel and neighbor). */
export const sortEdgeStrength = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    // Calculate edge strength for both pixels
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Use the difference as edge strength
    let pixelEdgeStrength = abs(pixelLum - neighborLum);
    let neighborEdgeStrength = abs(neighborLum - pixelLum);

    return pixelEdgeStrength > neighborEdgeStrength;
  }
`)

/** Sorts by local contrast ratio (luminance difference over the brighter of the pair), highest contrast first. */
export const sortContrast = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Calculate contrast ratio
    let pixelContrast = abs(pixelLum - neighborLum) / max(pixelLum, neighborLum);
    let neighborContrast = abs(neighborLum - pixelLum) / max(neighborLum, pixelLum);

    return pixelContrast > neighborContrast;
  }
`)

/** Sorts by a weighted blend of luminance, saturation and red dominance. */
export const sortMultiCriteria = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    // Luminance score
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Saturation score
    let pixelMax = max(pixel.r, max(pixel.g, pixel.b));
    let pixelMin = min(pixel.r, min(pixel.g, pixel.b));
    var pixelSaturation: f32;
    if (pixelMax > 0.0) {
      pixelSaturation = (pixelMax - pixelMin) / pixelMax;
    } else {
      pixelSaturation = 0.0;
    }

    let neighborMax = max(neighbor.r, max(neighbor.g, neighbor.b));
    let neighborMin = min(neighbor.r, min(neighbor.g, neighbor.b));
    var neighborSaturation: f32;
    if (neighborMax > 0.0) {
      neighborSaturation = (neighborMax - neighborMin) / neighborMax;
    } else {
      neighborSaturation = 0.0;
    }

    // Color dominance score
    let pixelRedDominance = pixel.r - max(pixel.g, pixel.b);
    let neighborRedDominance = neighbor.r - max(neighbor.g, neighbor.b);

    // Combine scores with weights
    let pixelScore = pixelLum * 0.4 + pixelSaturation * 0.3 + pixelRedDominance * 0.3;
    let neighborScore = neighborLum * 0.4 + neighborSaturation * 0.3 + neighborRedDominance * 0.3;

    return pixelScore > neighborScore;
  }
`)

/** Sorts by luminance, but only swaps past a 0.01 difference threshold to prevent infinite sorting of near-identical pixels. */
export const sortStable = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    let diff = pixelLum - neighborLum;

    // Only swap if there's a meaningful difference
    // This prevents infinite sorting of nearly identical pixels
    return diff > 0.01;
  }
`)

/** Sorts by luminance, descending (darkest first). */
export const sortDescending = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    return pixelLum < neighborLum; // Reversed for descending
  }
`)

/** Sorts by luminance, alternating ascending/descending per row based on pixel index parity. */
export const sortAlternating = wgslFn(`
  fn sort(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i) -> bool {
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Alternate sort direction based on position
    let pixelIndex = pixelPos.y * gridSize.x + pixelPos.x;
    let shouldReverse = (pixelIndex % 2) == 0;

    if (shouldReverse) {
      return pixelLum < neighborLum;
    } else {
      return pixelLum > neighborLum;
    }
  }
`)
