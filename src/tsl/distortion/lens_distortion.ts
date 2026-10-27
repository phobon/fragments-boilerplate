// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { dot, Fn, float, select, vec2 } from 'three/tsl'

type LensDistortionOptions = {
  distortion?: ReturnType<typeof float>
  center?: ReturnType<typeof vec2>
  aspect?: ReturnType<typeof vec2>
}

/**
 * Applies a "CC Lens"-style radial lens distortion to UV coordinates, ported
 * from the Codrops tutorial "Building a Mouse-Following Square Lens Effect with
 * Three.js and GLSL" (getCCLensScale / getCCLensUv).
 *
 * Positive `distortion` bulges outward from `center` (magnifying the middle),
 * negative pinches inward. The displacement grows with the squared distance
 * from the centre, so it stays sharp at the focal point and curves more toward
 * the edges — the classic barrel/pincushion lens look.
 *
 * @param {vec2} _uv - The UV coordinates (0..1). Aspect-corrected input, or the
 *   `aspect` option below, keeps the lens circular on non-square viewports.
 * @param {Object} [options] - Optional configuration values.
 * @param {number} [options.distortion=1.5] - Lens strength (positive=bulge, negative=pinch)
 * @param {vec2} [options.center=vec2(0.5, 0.5)] - Focal point where distortion is zero
 * @param {vec2} [options.aspect=vec2(1, 1)] - Aspect scale (e.g. vec2(width/height, 1)) applied to the centred position so the lens is round rather than elliptical
 * @returns {vec2} Distorted UV coordinates
 */
export const lensDistortion = Fn(([_uv, options = {}]) => {
  const { distortion = float(1.5), center = vec2(0.5), aspect = vec2(1, 1) } = options as LensDistortionOptions

  const uv = _uv.toVar()
  const _distortion = float(distortion).toVar()
  const _aspect = vec2(aspect).toVar()

  // Move the origin to the focal point and apply the aspect scale so distance
  // is measured in a round coordinate space.
  const centeredPosition = uv.sub(center).mul(_aspect).toVar()

  // Squared radius from the centre drives the scale (dot(p, p) == |p|²).
  const radius2 = dot(centeredPosition, centeredPosition).toVar()

  // getCCLensScale: positive distortion => 1 + d·r² (bulge); negative =>
  // 1 / (1 - d·r²) (pinch). select() evaluates both but keeps only the picked
  // branch — and for the negative branch d<0 makes (1 - d·r²) ≥ 1, so no
  // division by zero occurs regardless of which branch is discarded.
  const scalePositive = float(1).add(_distortion.mul(radius2))
  const scaleNegative = float(1).div(float(1).sub(_distortion.mul(radius2)))
  const lensScale = select(_distortion.greaterThanEqual(0), scalePositive, scaleNegative).toVar()

  // Scale the centred position, undo the aspect scale, and return to UV space.
  const distortedUv = centeredPosition.mul(lensScale).div(_aspect).add(center).toVar()

  // Invert the offset so sampling the source at this UV reads the magnified
  // centre outward (matches the tutorial's `uv - distortionOffset`).
  const distortionOffset = distortedUv.sub(uv).toVar()

  return uv.sub(distortionOffset)
})
