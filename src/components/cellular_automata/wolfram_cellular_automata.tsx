import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { array, Fn, float, floor, hash, If, instanceIndex, storage, uniform, uv, vec2, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { WebGPUShader } from '@/components/shader/webgpu_shader'
import {
  CA_MAX_PASSES,
  type CaPassMaskRegion,
  type CaSketchFraming,
  type CaSketchPropsBase,
  resolveCaFraming,
} from './ca_common'

// 1D elementary (Wolfram) CA: one storage buffer (space × time), one generation row per tick in compute.
// Fragment: UV → grid with resolveCaFraming, optional multi-pass composite + masks.

/** Convert rule number (0–255) to 8-element ruleset array (Wolfram order 111..000). */
export const ruleToArray = (rule: number): number[] => {
  const out: number[] = []
  for (let i = 0; i < 8; i++) {
    out.push((rule >> (7 - i)) & 1)
  }
  return out
}

/** Wolfram rules as 8 bits: index 0 = pattern 111, index 7 = 000. Rule 90 = [0,1,0,1,1,0,1,0]. */
export const RULE_30 = ruleToArray(30)
export const RULE_90 = ruleToArray(90)
export const RULE_110 = ruleToArray(110)
export const RULE_126 = ruleToArray(126)
export const RULE_150 = ruleToArray(150)
export const RULE_182 = ruleToArray(182)
export const RULE_190 = ruleToArray(190)
export const RULE_222 = ruleToArray(222)
export const RULE_246 = ruleToArray(246)
export const RULE_250 = ruleToArray(250)
export const RULE_254 = ruleToArray(254)

/** Vertical segment: this many generation rows use `ruleset` (row 0 = seed). Rows past the last band use the last band’s rule. */
export type WolframRuleBand = {
  ruleset: number[]
  height: number
}

/** Flattens optional vertical bands into one rule bit table + per-row band index for the GPU. */
const compileRuleBands = (rows: number, bands: WolframRuleBand[] | undefined, fallbackRuleset: number[]) => {
  if (!bands?.length) {
    return {
      flatRules: [...fallbackRuleset],
      rowSlot: Array.from({ length: rows }, () => 0),
    }
  }
  const rowSlot = new Array<number>(rows)
  let rowIndex = 0
  for (let bandIndex = 0; bandIndex < bands.length && rowIndex < rows; bandIndex++) {
    const { height, ruleset } = bands[bandIndex]!
    const rowEnd = Math.min(rowIndex + Math.max(0, height), rows)
    for (; rowIndex < rowEnd; rowIndex++) {
      rowSlot[rowIndex] = bandIndex
    }
  }
  const lastBandIndex = bands.length - 1
  while (rowIndex < rows) {
    rowSlot[rowIndex++] = lastBandIndex
  }
  const flatRules = bands.flatMap((b) => b.ruleset)
  return { flatRules, rowSlot }
}

/** One Wolfram field in a multi-pass stack (composited bottom → top). */
export type WolframPassLayer = {
  ruleset?: number[]
  /** Row bands: each segment uses its `ruleset` for that many rows; omit to use `ruleset` for all rows. */
  ruleBands?: WolframRuleBand[]
  seed?: 'center' | 'sparse'
  sparseDensity?: number
  foreground?: number[]
  /** Same semantics as 2D CA: `CaPassMaskRegion[]` in grid UV after framing. */
  mask?: CaPassMaskRegion[]
}

/**
 * `params` for `WolframCellularAutomata`. See `ca_common.ts` for differences vs 2D `CellularAutomataParams`.
 */
export type WolframCellularAutomataParams = {
  /**
   * Multiple elementary CA fields — same grid, same generation clock — composited bottom → top
   * (live = opaque `foreground`, dead = transparent). Mirrors `CellularAutomataParams.passes` conceptually.
   */
  passes?: WolframPassLayer[]
  /** Single-field: 8-bit ruleset when `passes` is omitted. Default Rule 90. */
  ruleset?: number[]
  /** Single-field: varying rules by **output row** (generation). When `passes` is set, use each layer’s `ruleBands` instead. */
  ruleBands?: WolframRuleBand[]
  seed?: 'center' | 'sparse'
  sparseDensity?: number
  foreground?: number[]
  /** Merged after `framing?.background`: `resolveCaFraming` uses `framing?.background ?? this`. */
  background?: number[]
  /** Shared with 2D CA (`CaSketchFraming`); margins apply the same way when scale ≥ 1. */
  framing?: CaSketchFraming
}

/** Props for `WolframCellularAutomata`. Extends `CaSketchPropsBase` (same grid + export name as 2D). */
export type WolframCellularAutomataProps = CaSketchPropsBase & {
  params?: WolframCellularAutomataParams
}

const DEFAULT_RULESET = RULE_90

type WolframGpuState =
  | {
      kind: 'legacy'
      computeUpdate: ReturnType<ReturnType<typeof Fn>['compute']>
      colorNode: ReturnType<typeof Fn>
    }
  | {
      kind: 'multi'
      computeUpdates: ReturnType<ReturnType<typeof Fn>['compute']>[]
      colorNode: ReturnType<typeof Fn>
    }

export const WolframCellularAutomata = ({
  rows = 512,
  columns = 512,
  params = {},
  exportFilename = 'wolfram',
}: WolframCellularAutomataProps) => {
  const gl = useThree((state) => state.gl) as any

  const passList = params.passes
  const multiPass = Boolean(passList && passList.length > 0)

  // Snapshot pass layers so the GPU graph only rebuilds when their shape changes
  const passesConfigKey =
    multiPass && passList
      ? JSON.stringify(
          passList.slice(0, CA_MAX_PASSES).map((passLayer) => ({
            ruleset: passLayer.ruleset ?? DEFAULT_RULESET,
            ruleBands: passLayer.ruleBands ?? null,
            seed: passLayer.seed ?? 'center',
            sparseDensity: passLayer.sparseDensity ?? 0.04,
            foreground: passLayer.foreground ?? [1, 1, 1],
            mask:
              passLayer.mask && passLayer.mask.length > 0
                ? passLayer.mask.map((r) => ({
                    start: r.start,
                    end: r.end,
                    yStart: r.yStart ?? 0,
                    yEnd: r.yEnd ?? 1,
                  }))
                : null,
          })),
        )
      : ''

  const legacyRuleBands = params.ruleBands
  const legacyRuleKey = JSON.stringify(legacyRuleBands ?? null)

  const {
    ruleset = DEFAULT_RULESET,
    framing,
    seed: seedMode = 'center',
    sparseDensity = 0.04,
    foreground = [1, 1, 1] as number[],
    background: paramsBackground,
  } = params

  const { background, effectiveScaleX, effectiveScaleY } = resolveCaFraming(framing, paramsBackground)

  const seedSparse = seedMode === 'sparse'
  const centerColumn = Math.floor(columns / 2)

  /** Tracks current generation row for the interval (JS side); uniform drives the compute shader. */
  const activeGenerationRef = useRef(0)
  const currentGenUniform = useRef(uniform(0)).current

  // biome-ignore lint/correctness/useExhaustiveDependencies: passesConfigKey serializes `passes` so inline arrays do not rebuild the graph every render.
  const gpuState: WolframGpuState = useMemo(() => {
    const WOLFRAM_GRID_SIZE = columns * rows
    const currentGen = currentGenUniform

    // Letterboxed background + effective grid scale (shared with 2D CA)
    const backgroundVector = vec3(float(background[0]), float(background[1]), float(background[2]))
    const xCellSize = 1 / columns
    const yCellSize = 1 / rows

    const cappedPasses = params.passes?.length ? params.passes.slice(0, CA_MAX_PASSES) : null

    const buildSingleFieldState = (): WolframGpuState => {
      // One float per cell: full space–time image in a single buffer (no ping-pong)
      const stateBuffer = storage(
        new THREE.StorageInstancedBufferAttribute(WOLFRAM_GRID_SIZE, 1),
        'float',
        WOLFRAM_GRID_SIZE,
      )
      const { flatRules, rowSlot } = compileRuleBands(rows, legacyRuleBands, ruleset)
      const ruleBits = array(flatRules.map((bit) => float(bit)))
      const rowToBandSlot = array(rowSlot.map((slot) => float(slot)))

      const gridInitCompute = seedSparse
        ? Fn(() => {
            const cellX = floor(float(instanceIndex.mod(columns)))
            const cellY = floor(float(instanceIndex.div(columns)))
            const initialState = float(0).toVar()
            If(cellY.equal(0), () => {
              const noise = hash(cellX.mul(float(12.9898)))
              If(noise.lessThan(float(sparseDensity)), () => {
                initialState.assign(1)
              })
            })
            stateBuffer.element(instanceIndex).assign(initialState)
          })().compute(WOLFRAM_GRID_SIZE)
        : Fn(() => {
            const cellX = floor(float(instanceIndex.mod(columns)))
            const cellY = floor(float(instanceIndex.div(columns)))
            const initialState = float(0).toVar()
            If(cellY.equal(0).and(cellX.equal(float(centerColumn))), () => {
              initialState.assign(1)
            })
            stateBuffer.element(instanceIndex).assign(initialState)
          })().compute(WOLFRAM_GRID_SIZE)
      gl.compute(gridInitCompute)

      // One thread per column: read L/C/R on previous row, 8-bit lookup, write this generation row
      const generationStepCompute = Fn(() => {
        const cellColumn = instanceIndex
        const previousGeneration = currentGen.sub(1)
        const wrapColumn = (i: any) => i.add(columns).mod(columns)
        const leftColumn = wrapColumn(cellColumn.sub(1))
        const rightColumn = wrapColumn(cellColumn.add(1))
        const flatIndex = (generation: any, column: any) => generation.mul(columns).add(column)
        const leftAlive = stateBuffer.element(flatIndex(previousGeneration, leftColumn))
        const centerAlive = stateBuffer.element(flatIndex(previousGeneration, cellColumn))
        const rightAlive = stateBuffer.element(flatIndex(previousGeneration, rightColumn))
        const neighborhoodBits = float(7).sub(leftAlive.mul(4).add(centerAlive.mul(2)).add(rightAlive))
        const ruleLookupIndex = floor(neighborhoodBits.clamp(0, 7))
        const bandSlot = floor(rowToBandSlot.element(currentGen))
        const ruleTableOffset = bandSlot.mul(8)
        const nextAlive = ruleBits.element(ruleTableOffset.add(ruleLookupIndex))
        const writeIndex = currentGen.mul(columns).add(cellColumn)
        stateBuffer.element(writeIndex).assign(nextAlive)
      })().compute(columns)

      const foregroundVector = vec3(float(foreground[0]), float(foreground[1]), float(foreground[2]))

      // Duotone: sample buffer by cell; Y flip so time matches 2D CA convention
      const colorNode = Fn(() => {
        const rawUv = uv().toVar()
        const gridUv = vec2(
          rawUv.x.sub(0.5).div(float(effectiveScaleX)).add(0.5),
          rawUv.y.sub(0.5).div(float(effectiveScaleY)).add(0.5),
        ).toVar()
        const outsideFraming = gridUv.x
          .lessThan(0)
          .or(gridUv.x.greaterThan(1))
          .or(gridUv.y.lessThan(0))
          .or(gridUv.y.greaterThan(1))

        const fragmentColor = vec3(0).toVar()
        If(outsideFraming, () => {
          fragmentColor.assign(backgroundVector)
        }).Else(() => {
          const cellColumn = floor(gridUv.x.div(xCellSize)).clamp(0, columns - 1)
          const cellRowFromUv = floor(gridUv.y.div(yCellSize)).clamp(0, rows - 1)
          const cellRow = float(rows - 1).sub(cellRowFromUv)
          const flatCellIndex = cellRow.mul(columns).add(cellColumn)
          const cellAlive = stateBuffer.element(flatCellIndex)
          If(cellAlive.equal(1), () => {
            fragmentColor.assign(foregroundVector)
          }).Else(() => {
            fragmentColor.assign(backgroundVector)
          })
        })

        return fragmentColor
      })

      return { kind: 'legacy' as const, computeUpdate: generationStepCompute, colorNode }
    }

    // Stacked Wolfram fields: each pass gets its own space-time buffer + generation compute;
    // the fragment shader alpha-blends live cells bottom -> top (same idea as 2D multi-pass).
    const buildMultiPassState = (): WolframGpuState => {
      const layers = cappedPasses!
      const layerBuffers: ReturnType<typeof storage>[] = []
      const generationStepComputes: ReturnType<ReturnType<typeof Fn>['compute']>[] = []

      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const passLayer = layers[layerIndex]!
        const layerRuleset = passLayer.ruleset ?? DEFAULT_RULESET
        // Flatten rule bands into one GPU bit table + per-output-row band index (same as single-field).
        const { flatRules, rowSlot } = compileRuleBands(rows, passLayer.ruleBands, layerRuleset)
        const ruleBits = array(flatRules.map((bit) => float(bit)))
        const rowToBandSlot = array(rowSlot.map((slot) => float(slot)))
        const layerUsesSparseSeed = (passLayer.seed ?? 'center') === 'sparse'
        const layerSparseDensity = passLayer.sparseDensity ?? 0.04
        // Per-layer salt so sparse seeds decorrelate between passes when columns align.
        const layerHashSalt = float(layerIndex * 79.123 + 12.9898)

        const stateBuffer = storage(
          new THREE.StorageInstancedBufferAttribute(WOLFRAM_GRID_SIZE, 1),
          'float',
          WOLFRAM_GRID_SIZE,
        )
        layerBuffers.push(stateBuffer)

        // Row 0 only: center = one live cell, sparse = random bits along the top row; rest stay 0.
        const gridInitCompute = layerUsesSparseSeed
          ? Fn(() => {
              const cellX = floor(float(instanceIndex.mod(columns)))
              const cellY = floor(float(instanceIndex.div(columns)))
              const initialState = float(0).toVar()
              If(cellY.equal(0), () => {
                const noise = hash(cellX.mul(layerHashSalt))
                If(noise.lessThan(float(layerSparseDensity)), () => {
                  initialState.assign(1)
                })
              })
              stateBuffer.element(instanceIndex).assign(initialState)
            })().compute(WOLFRAM_GRID_SIZE)
          : Fn(() => {
              const cellX = floor(float(instanceIndex.mod(columns)))
              const cellY = floor(float(instanceIndex.div(columns)))
              const initialState = float(0).toVar()
              If(cellY.equal(0).and(cellX.equal(float(centerColumn))), () => {
                initialState.assign(1)
              })
              stateBuffer.element(instanceIndex).assign(initialState)
            })().compute(WOLFRAM_GRID_SIZE)
        gl.compute(gridInitCompute)

        // One thread per column: fill current generation row from the row above (this layer's buffer only).
        const generationStepCompute = Fn(() => {
          const cellColumn = instanceIndex
          const previousGeneration = currentGen.sub(1)
          const wrapColumn = (i: any) => i.add(columns).mod(columns)
          const leftColumn = wrapColumn(cellColumn.sub(1))
          const rightColumn = wrapColumn(cellColumn.add(1))
          const flatIndex = (generation: any, column: any) => generation.mul(columns).add(column)
          const leftAlive = stateBuffer.element(flatIndex(previousGeneration, leftColumn))
          const centerAlive = stateBuffer.element(flatIndex(previousGeneration, cellColumn))
          const rightAlive = stateBuffer.element(flatIndex(previousGeneration, rightColumn))
          const neighborhoodBits = float(7).sub(leftAlive.mul(4).add(centerAlive.mul(2)).add(rightAlive))
          const ruleLookupIndex = floor(neighborhoodBits.clamp(0, 7))
          const bandSlot = floor(rowToBandSlot.element(currentGen))
          const ruleTableOffset = bandSlot.mul(8)
          const nextAlive = ruleBits.element(ruleTableOffset.add(ruleLookupIndex))
          const writeIndex = currentGen.mul(columns).add(cellColumn)
          stateBuffer.element(writeIndex).assign(nextAlive)
        })().compute(columns)

        generationStepComputes.push(generationStepCompute)
      }

      const foregroundVectors = layers.map((layer) => {
        const fg = layer.foreground ?? [1, 1, 1]
        return vec3(float(fg[0]), float(fg[1]), float(fg[2]))
      })

      // Sample every layer at this pixel's cell; composite: live -> pass foreground, dead -> show beneath.
      const colorNode = Fn(() => {
        const rawUv = uv().toVar()
        const gridUv = vec2(
          rawUv.x.sub(0.5).div(float(effectiveScaleX)).add(0.5),
          rawUv.y.sub(0.5).div(float(effectiveScaleY)).add(0.5),
        ).toVar()
        const outsideFraming = gridUv.x
          .lessThan(0)
          .or(gridUv.x.greaterThan(1))
          .or(gridUv.y.lessThan(0))
          .or(gridUv.y.greaterThan(1))

        const fragmentColor = vec3(0).toVar()
        If(outsideFraming, () => {
          fragmentColor.assign(backgroundVector)
        }).Else(() => {
          const cellColumn = floor(gridUv.x.div(xCellSize)).clamp(0, columns - 1)
          const cellRowFromUv = floor(gridUv.y.div(yCellSize)).clamp(0, rows - 1)
          const cellRow = float(rows - 1).sub(cellRowFromUv)
          const flatCellIndex = cellRow.mul(columns).add(cellColumn)

          // Start from letterbox colour; each pass only adds its foreground where the cell is alive.
          const compositedRgb = backgroundVector.toVar()

          for (let i = 0; i < layers.length; i++) {
            const cellAlive = layerBuffers[i]!.element(flatCellIndex)
            const maskRegions = layers[i]!.mask
            // No mask => full grid; else union of half-open UV rects in grid space (same as 2D CA).
            const maskWeight = float(1).toVar()
            if (maskRegions && maskRegions.length > 0) {
              maskWeight.assign(0)
              for (const region of maskRegions) {
                const x0 = float(region.start)
                const x1 = float(region.end)
                const y0 = float(region.yStart ?? 0)
                const y1 = float(region.yEnd ?? 1)
                const inColumnRange = gridUv.x.greaterThanEqual(x0).and(gridUv.x.lessThan(x1))
                const inRowRange = gridUv.y.greaterThanEqual(y0).and(gridUv.y.lessThan(y1))
                If(inColumnRange.and(inRowRange), () => {
                  maskWeight.assign(1)
                })
              }
            }
            const layerOpacity = cellAlive.mul(maskWeight)
            const foregroundRgb = foregroundVectors[i]!
            const backgroundWeight = float(1).sub(layerOpacity)
            compositedRgb.assign(foregroundRgb.mul(layerOpacity).add(compositedRgb.mul(backgroundWeight)))
          }

          fragmentColor.assign(compositedRgb)
        })

        return fragmentColor
      })

      return { kind: 'multi' as const, computeUpdates: generationStepComputes, colorNode }
    }

    if (!multiPass || !cappedPasses) {
      return buildSingleFieldState()
    }
    return buildMultiPassState()
  }, [
    columns * rows,
    columns,
    rows,
    ruleset,
    effectiveScaleX,
    effectiveScaleY,
    foreground,
    background,
    seedSparse,
    sparseDensity,
    centerColumn,
    currentGenUniform,
    gl,
    multiPass,
    passesConfigKey,
    legacyRuleKey,
  ])

  // JS drives which row is "current" via uniform; compute fills that row from the one above
  useEffect(() => {
    activeGenerationRef.current = 1
    let cancelled = false

    const intervalId = setInterval(() => {
      if (cancelled || activeGenerationRef.current >= rows) {
        return
      }
      currentGenUniform.value = activeGenerationRef.current

      if (gpuState.kind === 'legacy') {
        gl.compute(gpuState.computeUpdate)
      } else {
        for (const stepCompute of gpuState.computeUpdates) {
          gl.compute(stepCompute)
        }
      }

      activeGenerationRef.current += 1
    }, 16)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [rows, gl, gpuState, currentGenUniform])

  return <WebGPUShader colorNode={gpuState.colorNode()} />
}
