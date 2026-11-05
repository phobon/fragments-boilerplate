/**
 * Shared types for WebGPU cellular-automata sketches (`CellularAutomata`, `WolframCellularAutomata`).
 *
 * **2D totalistic / custom** (`cellular_automata.tsx`):
 * - Moore neighborhood on a 2D grid; optional `depth` for stacked 2D layers.
 * - Rule: `birth` / `survive` lists, or per-cell `rulesFn`, optionally per-pass.
 * - **Rule bands** (`CA2DRuleBand`): change B/S by **simulation step**; each entry uses **`steps`** (how many ticks that B/S runs).
 * - Seeds: `random` | `apex-top`, `seedDensity`, `initialSingleCell`.
 * - Extra props: `maxIterations`, `colorNodeFn`, top-level `rulesFn` (single-field mode).
 *
 * **1D elementary / Wolfram** (`wolfram_cellular_automata.tsx`):
 * - One row evolves into the next; time is encoded along **rows** (growing downward).
 * - Rule: 8-bit `ruleset` (Wolfram order); optionally per-pass.
 * - **Rule bands** (`WolframRuleBand`): change ruleset by **output row** (generation index).
 * - Seeds: `center` | `sparse`, `sparseDensity`.
 *
 * **Aligned across both**
 * - `rows`, `columns`, `exportFilename` on the component (see `CaSketchPropsBase`).
 * - `params.passes[]`: multiple independent fields, same clock, composited bottom → top
 *   (live = opaque `foreground`, dead = transparent over `background`).
 * - `params.framing` + `params.background`: `CaSketchFraming`, `resolveCaFraming`.
 * - `CaPassMaskRegion` on each pass for UV clipping.
 */

/** Max layers in `params.passes` (same cap in both implementations). */
export const CA_MAX_PASSES = 8

/**
 * Half-open axis-aligned regions in **grid UV** after framing is applied:
 * `start ≤ x < end`, `yStart ≤ y < yEnd` (x left→right, y bottom→top).
 * Union defines where a pass may draw; omitted = full grid.
 */
export type CaPassMaskRegion = {
  start: number
  end: number
  yStart?: number
  yEnd?: number
}

/**
 * Maps canvas UV → simulation grid (letterboxing / crop). Shared by both CAs.
 * If `scaleX` / `scaleY` &lt; 1, they shrink the visible grid. If ≥ 1 and `marginX` / `marginY`
 * are set, inset is applied as a fraction of the full quad.
 */
export type CaSketchFraming = {
  scale?: number
  scaleX?: number
  scaleY?: number
  margin?: number
  marginX?: number
  marginY?: number
  background?: number[]
}

export type CaSketchPropsBase = {
  rows?: number
  columns?: number
  /** Base name for PNG export from the WebGPU sketch export helper. */
  exportFilename?: string
}

export const resolveCaFraming = (
  framing: CaSketchFraming | undefined,
  backgroundFallback: number[] | undefined,
): { background: number[]; effectiveScaleX: number; effectiveScaleY: number } => {
  const background = framing?.background ?? backgroundFallback ?? ([0, 0, 0] as number[])
  const { scale = 1, scaleX = scale, scaleY = scale, margin = 0, marginX = margin, marginY = margin } = framing || {}
  const effectiveScaleX = Math.max(0.01, scaleX < 1 ? scaleX : marginX > 0 ? 1 - 2 * marginX : 1)
  const effectiveScaleY = Math.max(0.01, scaleY < 1 ? scaleY : marginY > 0 ? 1 - 2 * marginY : 1)
  return { background, effectiveScaleX, effectiveScaleY }
}
