import { wgslFn } from 'three/tsl'

/**
 * Pixel-sort validator functions consumed by the pixel-sort compute kernel
 * (`pixel_sort.tsx`'s `computePingPongWGSL`, via its `validateFn` include)
 * and by `PixelSort`'s `validateFn` prop. Every validator shares one WGSL
 * signature:
 *
 *   fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool
 *
 * Returning `false` skips the pair for the current pass (no swap
 * considered); `true` allows `sort`'s comparator to run on the pair. These
 * stay `wgslFn` rather than `Fn` on purpose: they're referenced by name
 * (`validate(...)`) from inside the kernel's raw WGSL string, and
 * `wgslFn`'s `includes` array only accepts other WGSL function nodes (see
 * three's `FunctionNode`/`nativeFn`), not plain TSL `Fn` closures. They're
 * also re-exported individually as a function-node starter preset —
 * `SORT_VALIDATORS_PRESET_CODE` in the host app's `function_editor_default.ts`.
 *
 * @param {vec3} pixel Current pixel color
 * @param {vec3} neighbor Neighbor pixel color
 * @param {vec2i} pixelPos Current pixel's grid position
 * @param {vec2i} neighborPos Neighbor pixel's grid position
 * @param {vec2i} gridSize Buffer dimensions
 * @param {float} threshold Validator-specific cutoff (meaning varies per function; see each doc comment)
 * @returns {bool} True if the pair is eligible to sort this pass
 */

/** Always eligible — no filtering, every pair may sort. */
export const allValid = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    return true;
  }
`)

/** Eligible within `threshold` of the top edge (normalized y above `1 - threshold`). */
export const topY = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThreshold = f32(pixelPos.y) / f32(gridSize.y);
    return uvThreshold > 1.0 - threshold;
  }
`)

/** Eligible within `threshold` of the bottom edge (normalized y below `threshold`). */
export const bottomY = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThreshold = f32(pixelPos.y) / f32(gridSize.y);
    return uvThreshold < threshold;
  }
`)

/** Eligible within `threshold` of the left edge (normalized x below `threshold`). */
export const leftX = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThreshold = f32(pixelPos.x) / f32(gridSize.x);
    return uvThreshold < threshold;
  }
`)

/** Eligible within `threshold` of the right edge (normalized x above `1 - threshold`). */
export const rightX = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThreshold = f32(pixelPos.x) / f32(gridSize.x);
    return uvThreshold > 1.0 - threshold;
  }
`)

/** Eligible when the pixel's luminance (Rec. 601 weights) exceeds `threshold`. */
export const brightnessThreshold = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let brightness = dot(pixel.rgb, vec3<f32>(0.299, 0.587, 0.114));
    return brightness > threshold;
  }
`)

/** Eligible in the outer horizontal band — within `threshold` of either the left or right edge. */
export const rectOuter = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThreshold = f32(pixelPos.x) / f32(gridSize.x);
    return uvThreshold < threshold || uvThreshold > 1.0 - threshold;
  }
`)

/** Eligible in the inner horizontal band — beyond `threshold` from both the left and right edges. */
export const rectInner = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThreshold = f32(pixelPos.x) / f32(gridSize.x);
    return uvThreshold > threshold && uvThreshold < 1.0 - threshold;
  }
`)

/** Eligible in the inner square — beyond `threshold` from all four edges on both axes. */
export const squareInner = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThresholdX = f32(pixelPos.x) / f32(gridSize.x);
    let uvThresholdY = f32(pixelPos.y) / f32(gridSize.y);

    return uvThresholdX > threshold && uvThresholdX < 1.0 - threshold && uvThresholdY > threshold && uvThresholdY < 1.0 - threshold;
  }
`)

/** Eligible in the outer square frame — within `threshold` of any of the four edges. */
export const squareOuter = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let uvThresholdX = f32(pixelPos.x) / f32(gridSize.x);
    let uvThresholdY = f32(pixelPos.y) / f32(gridSize.y);

    return uvThresholdX < threshold || uvThresholdX > 1.0 - threshold || uvThresholdY < threshold || uvThresholdY > 1.0 - threshold;
  }
`)

/** Eligible via a position-based pseudo-random hash (Blum Blum Shub) exceeding `threshold`. */
export const validateRandom = wgslFn(`
  fn validateSeed(p: vec2<u32>) -> u32 {
    return 19u * p.x + 47u * p.y + 101u;
  }

  fn validateBbs(s: u32) -> u32 {
    var v = s;
    v = v % 65521u;
    v = (v * v) % 65521u;
    v = (v * v) % 65521u;
    return v;
  }

  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let v = vec2<u32>(u32(pixelPos.x), u32(pixelPos.y));
    let h = validateBbs(validateSeed(v));
    return f32(h) / 65520.0 > threshold;
  }
`)

/** Eligible when perceptual luminance (Rec. 709) exceeds `threshold` AND pixel/neighbor contrast exceeds 0.1. */
export const validateLuminance = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Use perceptual luminance weights (Rec. 709)
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Only validate if there's sufficient contrast
    let contrast = abs(pixelLum - neighborLum);
    return pixelLum > threshold && contrast > 0.1;
  }
`)

/** Eligible when brightness (max of the r/g/b channels) exceeds `threshold`. */
export const validateBrightness = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let pixelBrightness = max(pixel.r, max(pixel.g, pixel.b));

    return pixelBrightness > threshold;
  }
`)

/** Eligible when the average of the r/g/b channels exceeds `threshold`. */
export const validateAverage = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let pixelAverage = (pixel.r + pixel.g + pixel.b) / 3.0;

    return pixelAverage > threshold;
  }
`)

/** Eligible when red dominance over green/blue exceeds `threshold` and red is above a 0.1 floor. */
export const validateRed = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // More sophisticated red detection - check if red is dominant
    let redDominance = pixel.r - max(pixel.g, pixel.b);
    return redDominance > threshold && pixel.r > 0.1;
  }
`)

/** Like `validateRed`, but only considers every 2nd pixel (by grid index) to break up sorting patterns. */
export const validateRedPassBased = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Only validate every 2nd pixel to break up sorting patterns
    let pixelIndex = pixelPos.y * gridSize.x + pixelPos.x;
    if (pixelIndex % 2 != 0) {
      return false;
    }

    let redDominance = pixel.r - max(pixel.g, pixel.b);
    return redDominance > threshold && pixel.r > 0.05;
  }
`)

/** Like `validateLuminance`, but only considers every 4th pixel (by grid index) to break up sorting patterns. */
export const validateLuminancePassBased = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Only validate every 4th pixel to break up sorting patterns
    let pixelIndex = pixelPos.y * gridSize.x + pixelPos.x;
    if (pixelIndex % 4 != 0) {
      return false;
    }

    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));
    let contrast = abs(pixelLum - neighborLum);

    return pixelLum > threshold && contrast > 0.1;
  }
`)

/** Eligible when saturation exceeds `threshold`, but only considers every 5th pixel (by grid index) to break up sorting patterns. */
export const validateSaturationPassBased = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Only validate every 5th pixel to break up sorting patterns
    let pixelIndex = pixelPos.y * gridSize.x + pixelPos.x;
    if (pixelIndex % 5 != 0) {
      return false;
    }

    let pixelMax = max(pixel.r, max(pixel.g, pixel.b));
    let pixelMin = min(pixel.r, min(pixel.g, pixel.b));
    var pixelSaturation: f32;
    if (pixelMax > 0.0) {
      pixelSaturation = (pixelMax - pixelMin) / pixelMax;
    } else {
      pixelSaturation = 0.0;
    }

    return pixelSaturation > threshold;
  }
`)

/** Eligible for a position-hashed ~30% random subset of pixels whose luminance (Rec. 709) exceeds `threshold`. */
export const validateRandomPass = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Use position-based randomness to determine validation
    let pixelIndex = pixelPos.y * gridSize.x + pixelPos.x;
    let randomSeed = (pixelIndex * 7u + 13u) % 100u;

    // Only validate ~30% of pixels randomly
    if (f32(randomSeed) / 100.0 > 0.3) {
      return false;
    }

    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    return pixelLum > threshold;
  }
`)

/** Like `validateRed`, but without the 0.1 red floor — a looser, more permissive red-dominance check. */
export const validateRedLoose = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // More permissive red validation - just check if red is higher than other channels
    let redDominance = pixel.r - max(pixel.g, pixel.b);
    return redDominance > threshold;
  }
`)

/** Like `validateLuminance`, but without the contrast requirement — a looser, more permissive luminance check. */
export const validateLuminanceLoose = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // More permissive luminance validation
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    return pixelLum > threshold;
  }
`)

// Advanced segment detection validators that find continuous sortable regions

/** Segment-forming: eligible when either the pixel or its neighbor is red-dominant past `threshold`. */
export const validateRedSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // At least one pixel must be red-dominant to start/extend a segment
    let pixelRedDominance = pixel.r - max(pixel.g, pixel.b);
    let neighborRedDominance = neighbor.r - max(neighbor.g, neighbor.b);

    // Allow segment formation if either pixel meets criteria
    // This creates more natural segment boundaries
    return pixelRedDominance > threshold || neighborRedDominance > threshold;
  }
`)

/** Segment-forming: eligible when either the pixel or its neighbor is blue-dominant past `threshold`. */
export const validateBlueSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // At least one pixel must be red-dominant to start/extend a segment
    let pixelBlueDominance = pixel.b - max(pixel.r, pixel.g);
    let neighborBlueDominance = neighbor.b - max(neighbor.r, neighbor.g);

    // Allow segment formation if either pixel meets criteria
    // This creates more natural segment boundaries
    return pixelBlueDominance > threshold || neighborBlueDominance > threshold;
  }
`)

/** Segment-forming: eligible when either the pixel's or neighbor's luminance (Rec. 709) exceeds `threshold`. */
export const validateLuminanceSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // At least one pixel must have sufficient luminance to form a sortable segment
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Allow segment formation if either pixel meets criteria
    return pixelLum > threshold || neighborLum > threshold;
  }
`)

/** Segment-forming: eligible when either the pixel's or neighbor's brightness (max channel) exceeds `threshold`. */
export const validateBrightnessSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // At least one pixel must be bright enough to form a sortable segment
    let pixelBrightness = max(pixel.r, max(pixel.g, pixel.b));
    let neighborBrightness = max(neighbor.r, max(neighbor.g, neighbor.b));

    // Allow segment formation if either pixel meets criteria
    return pixelBrightness > threshold || neighborBrightness > threshold;
  }
`)

/** Segment-forming: eligible where the luminance gradient between pixel and neighbor exceeds `threshold`. */
export const validateGradientSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Calculate gradient magnitude between pixels
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));
    let gradient = abs(pixelLum - neighborLum);

    // Form segments in areas with significant color changes
    // This creates more interesting sorting patterns
    return gradient > threshold;
  }
`)

/** Segment-forming: eligible where pixel and neighbor colors are similar (Euclidean distance below `threshold`). */
export const validateSimilaritySegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Calculate color distance between pixels
    let colorDiff = length(pixel - neighbor);

    // Form segments where colors are similar (low distance)
    // This creates smooth sorting regions
    return colorDiff < threshold;
  }
`)

/** Segment-forming: eligible in a band around `threshold` — edge strength between half and 1.5x the threshold (near, not on, edges). */
export const validateEdgeSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Calculate edge strength
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));
    let edgeStrength = abs(pixelLum - neighborLum);

    // Form segments near edges but not on them
    // This creates interesting sorting patterns around edges
    return edgeStrength > threshold * 0.5 && edgeStrength < threshold * 1.5;
  }
`)

/** Segment-forming: eligible where the pixel/neighbor contrast ratio exceeds `threshold`. */
export const validateContrastSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Calculate contrast between pixels
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));
    let contrast = abs(pixelLum - neighborLum) / max(pixelLum, neighborLum);

    // Form segments in high-contrast areas
    return contrast > threshold;
  }
`)

/** Segment-forming: eligible when either the pixel's or neighbor's saturation exceeds `threshold`. */
export const validateSaturationSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Calculate saturation for both pixels
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

    // Form segments where at least one pixel has high saturation
    return pixelSaturation > threshold || neighborSaturation > threshold;
  }
`)

/** Segment-forming: eligible when at least 2 of 3 criteria (luminance, contrast, red dominance — each scaled off `threshold`) are met. */
export const validateMultiCriteriaSegment = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Combine multiple criteria for more sophisticated segment detection

    // Luminance criteria
    let pixelLum = dot(pixel, vec3<f32>(0.2126, 0.7152, 0.0722));
    let neighborLum = dot(neighbor, vec3<f32>(0.2126, 0.7152, 0.0722));
    let lumValid = pixelLum > threshold * 0.8 || neighborLum > threshold * 0.8;

    // Contrast criteria
    let contrast = abs(pixelLum - neighborLum);
    let contrastValid = contrast > threshold * 0.3;

    // Color dominance criteria
    let pixelRedDominance = pixel.r - max(pixel.g, pixel.b);
    let neighborRedDominance = neighbor.r - max(neighbor.g, neighbor.b);
    let colorValid = pixelRedDominance > threshold * 0.5 || neighborRedDominance > threshold * 0.5;

    // Require at least 2 out of 3 criteria to be met
    var criteriaCount = 0;
    if (lumValid) {
      criteriaCount++;
    }

    if (contrastValid) {
      criteriaCount++;
    }

    if (colorValid) {
      criteriaCount++;
    }

    return criteriaCount >= 2;
  }
`)

/** Eligible when green dominance over red/blue exceeds `threshold` and green is above a 0.1 floor. */
export const validateGreen = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Check green dominance over other channels
    let greenDominance = pixel.g - max(pixel.r, pixel.b);
    return greenDominance > threshold && pixel.g > 0.1;
  }
`)

/** Eligible when blue dominance over red/green exceeds `threshold` and blue is above a 0.1 floor. */
export const validateBlue = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Check blue dominance over other channels
    let blueDominance = pixel.b - max(pixel.r, pixel.g);
    return blueDominance > threshold && pixel.b > 0.1;
  }
`)

/** Eligible when saturation exceeds `threshold`. */
export const validateSaturation = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    let pixelMax = max(pixel.r, max(pixel.g, pixel.b));
    let pixelMin = min(pixel.r, min(pixel.g, pixel.b));
    var pixelSaturation: f32;
    if (pixelMax > 0.0) {
      pixelSaturation = (pixelMax - pixelMin) / pixelMax;
    } else {
      pixelSaturation = 0.0;
    }

    return pixelSaturation > threshold;
  }
`)

/** Eligible when the pixel's HSV hue (0-360) exceeds `threshold`; grayscale pixels (zero chroma) are never eligible. */
export const validateHue = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Convert to HSV and check hue range
    let pixelMax = max(pixel.r, max(pixel.g, pixel.b));
    let pixelMin = min(pixel.r, min(pixel.g, pixel.b));
    let delta = pixelMax - pixelMin;

    if (delta == 0.0) {
      return false; // Grayscale
    }

    let hue = 0.0;
    if (pixelMax == pixel.r) {
      hue = 60.0 * ((pixel.g - pixel.b) / delta);
    } else if (pixelMax == pixel.g) {
      hue = 60.0 * (2.0 + (pixel.b - pixel.r) / delta);
    } else {
      hue = 60.0 * (4.0 + (pixel.r - pixel.g) / delta);
    }

    if (hue < 0.0) {
      hue += 360.0;
    }

    // Check if hue is within threshold range (0-360)
    return hue > threshold;
  }
`)

/** Eligible where the luminance gradient (Rec. 601 weights) between pixel and neighbor exceeds `threshold`. */
export const validateEdges = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Calculate gradient magnitude
    let pixelLum = dot(pixel, vec3<f32>(0.299, 0.587, 0.114));
    let neighborLum = dot(neighbor, vec3<f32>(0.299, 0.587, 0.114));
    let gradient = abs(pixelLum - neighborLum);

    return gradient > threshold;
  }
`)

/** Eligible when an approximate color temperature exceeds `threshold` and the red-blue warmth magnitude exceeds 0.1. */
export const validateColorTemperature = wgslFn(`
  fn validate(pixel: vec3<f32>, neighbor: vec3<f32>, pixelPos: vec2i, neighborPos: vec2i, gridSize: vec2i, threshold: f32) -> bool {
    // Calculate color temperature approximation
    let temp = (pixel.r + pixel.g + pixel.b) / 3.0;
    let warmth = pixel.r - pixel.b; // Red-blue difference

    return temp > threshold && abs(warmth) > 0.1;
  }
`)
