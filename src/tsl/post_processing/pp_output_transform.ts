/**
 * Pure decision extracted from `post_processing.tsx`'s feedback-trails fix
 * (docs/plan/feedback-trails-bloom-pp.md) — kept separate from the React
 * component so it's unit-testable without a GPU/renderer.
 *
 * BACKGROUND: `THREE.RenderPipeline` (r183+; the class that used to be named
 * `THREE.PostProcessing`) has an `outputColorTransform` flag, default `true`.
 * When `true`, `RenderPipeline._update()` permanently bakes
 * `renderOutput(outputNode, toneMapping, outputColorSpace)` into the pipeline's
 * quad shader (see `RenderPipeline.js`, `_update()`), regardless of which
 * render target is bound when `.render()` is later called — unlike a plain
 * `renderer.render()` call, which only applies the transform when the CURRENT
 * render target is the canvas/output target (`Renderer.isOutputTarget`).
 * `RenderPipeline` has no such target-awareness; it always encodes tone
 * mapping + linear→sRGB into its output UNLESS `outputColorTransform` is
 * explicitly disabled.
 *
 * `post_processing.tsx`'s feedback-trails path redirects `pipeline.render()`
 * into an offscreen history "write" render target every frame (never straight
 * to the canvas) so the effect can accumulate frame-to-frame. Left at the
 * default, every write re-encodes already-sRGB pixels as if they were linear —
 * iterated gamma drives midtones to 1.0 within a few dozen frames (blacks stay
 * at 0 under any gamma), producing a white-oval / saturated-ring / black-
 * corners blowout. The fix: bake the transform ONLY when the pipeline's
 * output actually lands on screen this frame — never when it's being
 * redirected into an offscreen accumulation buffer, since in that case the
 * transform must instead be applied exactly once, later, when that buffer is
 * finally displayed (see `post_processing.tsx`'s blit step, which relies on
 * the renderer's own automatic canvas output pass for that single
 * application).
 */

/**
 * Whether `RenderPipeline.outputColorTransform` should be `true` (bake tone
 * mapping + color-space conversion into the pipeline's own shader) for this
 * frame/pipeline instance.
 *
 * @param isRedirectedToOffscreenTarget - `true` when `pipeline.render()` is
 *   about to write into (or is permanently configured to always write into)
 *   an offscreen render target rather than the screen — e.g. the
 *   feedback-trails history "write" RT. `false` for the ordinary case of
 *   rendering straight to the canvas.
 * @returns `false` when redirected offscreen (the caller must instead apply
 *   the transform exactly once, elsewhere, before final display); `true`
 *   otherwise (the pipeline's single on-screen render applies it itself).
 */
export const resolvePipelineOutputColorTransform = (isRedirectedToOffscreenTarget: boolean): boolean =>
  !isRedirectedToOffscreenTarget
