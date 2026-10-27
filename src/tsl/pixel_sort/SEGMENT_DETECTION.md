# Pixel Sort Segment Detection

## Overview

The enhanced pixel sort implementation now includes sophisticated segment detection capabilities that identify continuous regions of pixels that can be sorted together. This creates more natural and visually interesting sorting effects compared to the previous pixel-pair approach.

## Key Improvements

### 1. Enhanced Segment Detection

**Previous Approach**: Both pixels in a pair had to meet validation criteria

```wgsl
// Old restrictive approach
return pixelRedDominance > threshold && neighborRedDominance > threshold;
```

**New Approach**: At least one pixel needs to meet criteria to form/extend segments

```wgsl
// New flexible approach
return pixelRedDominance > threshold || neighborRedDominance > threshold;
```

### 2. Advanced Validation Functions

#### Basic Segment Validators

- `validateRedSegment` - Red-dominant regions
- `validateLuminanceSegment` - Bright regions using perceptual luminance
- `validateBrightnessSegment` - High-brightness regions

#### Advanced Segment Validators

- `validateGradientSegment` - Areas with significant color changes
- `validateSimilaritySegment` - Regions with similar colors
- `validateEdgeSegment` - Areas near edges but not on them
- `validateContrastSegment` - High-contrast regions
- `validateSaturationSegment` - Highly saturated color regions
- `validateMultiCriteriaSegment` - Combines multiple criteria

### 3. Enhanced Sorting Functions

#### Perceptual Sorting

- `sortLuminancePerceptual` - Uses Rec. 709 weights for accurate luminance
- `sortHSVValue` - Sorts by HSV value (brightness)
- `sortHSVSaturation` - Sorts by color saturation

#### Advanced Sorting

- `sortColorTemperature` - Sorts by color temperature and warmth
- `sortEdgeStrength` - Sorts by edge strength
- `sortContrast` - Sorts by contrast ratio
- `sortMultiCriteria` - Combines multiple sorting criteria

#### Stability and Direction

- `sortStable` - Prevents infinite sorting of similar pixels
- `sortDescending` - High to low value sorting
- `sortAlternating` - Alternates sort direction

### 4. Convergence Detection

The system now includes intelligent convergence detection to stop sorting when no meaningful changes occur:

```typescript
// New props for convergence control
enableConvergenceDetection: boolean = true
stablePassesThreshold: number = 5
minSwapThreshold: number = 0.01
```

## Usage Examples

### Basic Segment Detection

```tsx
<PixelSort
  validateFn={validateRedSegment}
  sortFn={sortLuminancePerceptual}
  threshold={0.3}
  maxPasses={50}
  enableConvergenceDetection={true}
  stablePassesThreshold={3}
/>
```

### Advanced Multi-Criteria Detection

```tsx
<PixelSort
  validateFn={validateMultiCriteriaSegment}
  sortFn={sortMultiCriteria}
  threshold={0.4}
  maxPasses={90}
  enableConvergenceDetection={true}
  stablePassesThreshold={5}
/>
```

### Gradient-Aware Sorting

```tsx
<PixelSort
  validateFn={validateGradientSegment}
  sortFn={sortEdgeStrength}
  threshold={0.2}
  maxPasses={60}
  enableConvergenceDetection={true}
  stablePassesThreshold={5}
/>
```

## Segment Detection Strategies

### 1. Color-Based Segments

- **Red Segments**: Identifies red-dominant regions
- **Saturation Segments**: Finds highly saturated color areas
- **Temperature Segments**: Groups pixels by color temperature

### 2. Luminance-Based Segments

- **Brightness Segments**: High-brightness regions
- **Contrast Segments**: High-contrast areas
- **Perceptual Segments**: Uses accurate luminance weights

### 3. Edge-Aware Segments

- **Gradient Segments**: Areas with significant color changes
- **Edge Segments**: Regions near but not on edges
- **Similarity Segments**: Areas with similar colors

### 4. Multi-Criteria Segments

- **Combined Validation**: Requires multiple criteria to be met
- **Weighted Scoring**: Combines different factors with weights
- **Adaptive Thresholds**: Adjusts based on image content

## Performance Optimizations

### Convergence Detection

- Stops sorting when no meaningful changes occur
- Configurable stability thresholds
- Prevents infinite sorting loops

### Stable Sorting

- Minimum difference thresholds prevent micro-adjustments
- Reduces unnecessary compute shader calls
- Improves overall performance

### Adaptive Passes

- Different max passes for different segment types
- Early termination for simple segments
- Extended processing for complex patterns

## Configuration Guidelines

### Threshold Settings

- **Low (0.1-0.3)**: More sensitive, creates more segments
- **Medium (0.3-0.6)**: Balanced detection
- **High (0.6-0.9)**: Less sensitive, creates fewer but more distinct segments

### Max Passes

- **Simple segments**: 30-50 passes
- **Complex segments**: 60-100 passes
- **Multi-criteria**: 80-120 passes

### Convergence Detection

- **Fast convergence**: 3-5 stable passes
- **Thorough sorting**: 5-8 stable passes
- **Maximum quality**: 8+ stable passes

## Best Practices

1. **Start with basic validators** (`validateRedSegment`, `validateLuminanceSegment`)
2. **Use perceptual sorting** (`sortLuminancePerceptual`) for natural results
3. **Enable convergence detection** to prevent infinite sorting
4. **Adjust thresholds** based on image content
5. **Combine validators** for complex effects
6. **Use stable sorting** for consistent results

## Troubleshooting

### Infinite Sorting

- Enable convergence detection
- Use stable sorting functions
- Increase minimum swap threshold

### Poor Segment Detection

- Adjust threshold values
- Try different validation functions
- Use multi-criteria validation

### Performance Issues

- Reduce max passes
- Use simpler validation functions
- Enable convergence detection

## Future Enhancements

1. **True Convergence Detection**: Compute shader feedback for actual swap counts
2. **Segment Boundary Detection**: Proper segment start/end identification
3. **Adaptive Thresholds**: Automatic threshold adjustment based on image content
4. **Multi-Pass Sorting**: Different criteria per pass
5. **Real-time Controls**: Live parameter adjustment
6. **Visualization Tools**: Debug segment detection overlay
