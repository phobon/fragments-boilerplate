import { PixelSort } from './pixel_sort'
import {
  sortAlternating,
  sortColorTemperature,
  sortContrast,
  sortDescending,
  sortEdgeStrength,
  sortHSVSaturation,
  sortHSVValue,
  sortLuminancePerceptual,
  sortMultiCriteria,
  sortStable,
} from './sorting_functions'
import {
  validateContrastSegment,
  validateEdgeSegment,
  validateGradientSegment,
  validateLuminanceSegment,
  validateMultiCriteriaSegment,
  validateRedSegment,
  validateSaturationSegment,
  validateSimilaritySegment,
} from './sorting_validators'

// Example configurations for different segment detection strategies

export const SegmentDetectionExamples = {
  // Basic segment detection - red-dominant regions
  redSegments: {
    validateFn: validateRedSegment,
    sortFn: sortLuminancePerceptual,
    threshold: 0.3,
    passesPerFrame: 50,
  },

  // Luminance-based segments with perceptual accuracy
  luminanceSegments: {
    validateFn: validateLuminanceSegment,
    sortFn: sortLuminancePerceptual,
    threshold: 0.4,
    passesPerFrame: 75,
  },

  // Gradient-aware segments for interesting patterns
  gradientSegments: {
    validateFn: validateGradientSegment,
    sortFn: sortEdgeStrength,
    threshold: 0.2,
    passesPerFrame: 60,
  },

  // Color similarity segments for smooth regions
  similaritySegments: {
    validateFn: validateSimilaritySegment,
    sortFn: sortHSVSaturation,
    threshold: 0.15,
    passesPerFrame: 500,
  }, // Broken

  // Edge-aware segments for complex patterns
  edgeSegments: {
    validateFn: validateEdgeSegment,
    sortFn: sortContrast,
    threshold: 0.25,
    passesPerFrame: 80,
  },

  // High-contrast segments
  contrastSegments: {
    validateFn: validateContrastSegment,
    sortFn: sortContrast,
    threshold: 0.3,
    passesPerFrame: 70,
  },

  // Saturation-based segments for colorful regions
  saturationSegments: {
    validateFn: validateSaturationSegment,
    sortFn: sortHSVSaturation,
    threshold: 0.35,
    passesPerFrame: 55,
  },

  // Multi-criteria segments for sophisticated detection
  multiCriteriaSegments: {
    validateFn: validateMultiCriteriaSegment,
    sortFn: sortMultiCriteria,
    threshold: 0.2,
    passesPerFrame: 90,
  },

  // Stable sorting with convergence detection
  stableSegments: {
    validateFn: validateLuminanceSegment,
    sortFn: sortStable,
    threshold: 0.3,
    passesPerFrame: 100,
    minSwapThreshold: 0.01,
  },

  // Descending sort for different visual effects
  descendingSegments: {
    validateFn: validateRedSegment,
    sortFn: sortDescending,
    threshold: 0.25,
    passesPerFrame: 60,
  },

  // Alternating sort direction for complex patterns
  alternatingSegments: {
    validateFn: validateGradientSegment,
    sortFn: sortAlternating,
    threshold: 0.2,
    passesPerFrame: 80,
  },

  // Color temperature-based segments
  temperatureSegments: {
    validateFn: validateLuminanceSegment,
    sortFn: sortColorTemperature,
    threshold: 0.35,
    passesPerFrame: 65,
  },
}

// Helper function to create a PixelSort component with segment detection
export const createSegmentPixelSort = (config: keyof typeof SegmentDetectionExamples) => {
  const example = SegmentDetectionExamples[config]

  return (props: Partial<typeof example> = {}) => <PixelSort {...example} {...props} />
}

// Usage examples:
// const RedSegmentSort = createSegmentPixelSort('redSegments')
// const GradientSegmentSort = createSegmentPixelSort('gradientSegments')
// const MultiCriteriaSort = createSegmentPixelSort('multiCriteriaSegments')
