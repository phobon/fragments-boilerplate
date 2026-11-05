import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { array, Fn, float, floor, hash, If, instanceIndex, Loop, storage, uniform, uv, vec2, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { WebGPUShader } from '@/components/shader/webgpu_shader'
import { CA_MAX_PASSES, CaSketchFraming, CaSketchPropsBase, resolveCaFraming } from './ca_common'

// 2D life-like CA: ping-pong cell state; Moore neighbourhood; B/S, step bands, or custom rulesFn.
// Optional multi-pass mirrors Wolfram (stacked fields, same tick). Single-field can use colorNodeFn.

export const hexToRgbArray = (hex: string): number[] | null => {
  const rgb = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  return rgb ? rgb.slice(1).map((n) => parseInt(n, 16) / 255) : null
}

const DEFAULT_BIRTH = [3]
const DEFAULT_SURVIVE = [2, 3]
/** When maxIterations is 0 (unbounded), preallocate this many time-step → rule slot entries. */
const MAX_RULE_STEPS = 10_000

/**
 * 2D CA: for **`steps`** simulation ticks, use this `birth` / `survive` (totalistic) until the next band.
 * After the last band, the last rules repeat (same as Wolfram row bands).
 */
export type CA2DRuleBand = {
  birth?: number[]
  survive?: number[]
  /** How many simulation steps this birth/survive pair runs before the next band advances. */
  steps: number
}

export type CellularPassLayer = {
  birth?: number[]
  survive?: number[]
  /** Time-step bands: each uses its birth/survive for **`steps`** ticks. Omitted = one implicit band from top-level birth/survive. Ignored for stepping if `rulesFn` is set. */
  ruleBands?: CA2DRuleBand[]
  /**
   * Custom neighborhood step (same signature as top-level `CellularAutomata` `rulesFn`).
   * When set, B/S and `ruleBands` are not used for this pass’s update.
   */
  rulesFn?: any
  /** Stable id for cache keys (e.g. configurator rule name). */
  rulesFnKey?: string
  seed?: 'random' | 'apex-top'
  seedDensity?: number
  foreground?: number[]
  mask?: any[]
  initialSingleCell?: { column: number; row: number }
  boundary?: 'torus' | 'dead'
}

/**
 * `params` for `CellularAutomata`. See `ca_common.ts` for how this differs from Wolfram params.
 */
export type CellularAutomataParams = {
  /**
   * Multiple 2D CA layers — same grid, same step clock — composited bottom → top
   * (live = opaque `foreground`, dead = transparent). Shape matches `WolframCellularAutomataParams.passes`
   * conceptually; each layer carries 2D-specific rule fields.
   */
  passes?: CellularPassLayer[]
  birth?: number[]
  survive?: number[]
  /** When `passes` is omitted: time-varying B/S for the single field. Ignored if `rulesFn` is set. */
  ruleBands?: CA2DRuleBand[]
  seedDensity?: number
  foreground?: number[]
  /** Merged after `framing?.background`: `resolveCaFraming` uses `framing?.background ?? this`. */
  background?: number[]
  /** Shared with Wolfram; 2D also honors `margin` / `marginX` / `marginY` when scale ≥ 1. */
  framing?: CaSketchFraming
  boundary?: 'torus' | 'dead'
  initialSingleCell?: { column: number; row: number }
  seed?: 'random' | 'apex-top'
}

/** Props for `CellularAutomata`. Extends `CaSketchPropsBase` (shared with Wolfram: grid + export name). */
export type CellularAutomataProps = CaSketchPropsBase & {
  /** Z-layers for the single-field path only; must be `1` when using `params.passes`. */
  depth?: number
  maxIterations?: number
  params?: CellularAutomataParams
  /** Single-field only; use `params.passes[].rulesFn` for multi-layer custom rules. */
  colorNodeFn?: any
  rulesFn?: any
}

type CompiledBands = { stepToSlot: number[]; bandRules: { birth: number[]; survive: number[] }[] }

/** Precomputes step index → band slot and per-band B/S (2D bands are in *time*, not screen rows). */
const compileIterationRuleBands = (
  maxStepSlots: number,
  ruleBands: CA2DRuleBand[] | undefined,
  fallbackBirth: number[],
  fallbackSurvive: number[],
): CompiledBands => {
  if (!ruleBands?.length) {
    return {
      stepToSlot: Array.from({ length: maxStepSlots }, () => 0),
      bandRules: [{ birth: fallbackBirth, survive: fallbackSurvive }],
    }
  }
  const bandRules = ruleBands.map((b) => ({
    birth: b.birth ?? DEFAULT_BIRTH,
    survive: b.survive ?? DEFAULT_SURVIVE,
  }))
  const stepToSlot: number[] = new Array(maxStepSlots)
  let step = 0
  for (let bandIndex = 0; bandIndex < ruleBands.length && step < maxStepSlots; bandIndex++) {
    const band = ruleBands[bandIndex]!
    const legacy = band as CA2DRuleBand & { height?: number }
    const bandStepCount = Math.max(0, band.steps ?? legacy.height ?? 0)
    for (let k = 0; k < bandStepCount && step < maxStepSlots; k++) {
      stepToSlot[step++] = bandIndex
    }
  }
  const lastBandIndex = ruleBands.length - 1
  while (step < maxStepSlots) {
    stepToSlot[step++] = lastBandIndex
  }
  return { stepToSlot, bandRules }
}

type CaGpuState =
  | { kind: 'legacy'; computeA: any; computeB: any; colorNode: any; displayIsA: any }
  | { kind: 'multi'; computePasses: { computeA: any; computeB: any; displayIsA: any }[]; colorNode: any }

/** TSL helper: true if n equals any entry in values (for birth / survive list checks). */
const countMatch = (n: any, values: number[]) => {
  const first = values[0]
  if (first === undefined) {
    return
  }

  n.equal(1).and(n.equal(0))
  let match = n.equal(float(first))
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!
    match = match.or(n.equal(float(v)))
  }
  return match
}

const assignConwayToVar = (
  currentAlive: any,
  liveNeighborCount: any,
  birth: number[],
  survive: number[],
  nextState: any,
) => {
  const birthMatch = countMatch(liveNeighborCount, birth)
  const surviveMatch = countMatch(liveNeighborCount, survive)
  // Alive: must match survive; dead: must match birth
  If(currentAlive.equal(1), () => {
    If(surviveMatch, () => nextState.assign(1)).Else(() => nextState.assign(0))
  }).Else(() => {
    If(birthMatch, () => nextState.assign(1)).Else(() => nextState.assign(0))
  })
}

const assignConway = (currentAlive: any, liveNeighborCount: any, birth: number[], survive: number[], writeBuf: any) => {
  const nextState = float(0).toVar()
  assignConwayToVar(currentAlive, liveNeighborCount, birth, survive, nextState)
  writeBuf.element(instanceIndex).assign(nextState)
}

/**
 * `If(s==0,a0).Else( If(s==1,a1).Else(… an-1 on last))` for totalistic per-step bands.
 */
const buildSlotIfElseTree = (
  slotF: any,
  bandRules: { birth: number[]; survive: number[] }[],
  fromBandIndex: number,
  nextState: any,
  currentAlive: any,
  liveNeighborCount: any,
) => {
  if (fromBandIndex === bandRules.length - 1) {
    assignConwayToVar(
      currentAlive,
      liveNeighborCount,
      bandRules[fromBandIndex]!.birth,
      bandRules[fromBandIndex]!.survive,
      nextState,
    )
    return
  }
  If(slotF.equal(float(fromBandIndex)), () =>
    assignConwayToVar(
      currentAlive,
      liveNeighborCount,
      bandRules[fromBandIndex]!.birth,
      bandRules[fromBandIndex]!.survive,
      nextState,
    ),
  ).Else(() => buildSlotIfElseTree(slotF, bandRules, fromBandIndex + 1, nextState, currentAlive, liveNeighborCount))
}

/** Two compute passes (A→B and B→A) for one complete grid update each way. */
const buildConwayPipelines = ({
  readA,
  readB,
  columns,
  rows,
  CA_SIZE,
  boundary,
  bandRules,
  numBands,
  slotF,
  rulesFn,
}: {
  readA: any
  readB: any
  columns: number
  rows: number
  CA_SIZE: number
  boundary: 'torus' | 'dead'
  bandRules: { birth: number[]; survive: number[] }[]
  numBands: number
  slotF: any | null
  rulesFn: any | null
}) => {
  const makeStep = (readBuf: any, writeBuf: any) =>
    Fn(() => {
      const cellX = floor(float(instanceIndex.mod(columns)))
      const cellY = floor(float(instanceIndex.div(columns)))
      // Moore (8) offsets — order must match how rulesFn uses directional samples if custom
      const mooreDx = array([float(-1), float(1), float(0), float(0), float(-1), float(1), float(-1), float(1)])
      const mooreDy = array([float(0), float(0), float(-1), float(1), float(-1), float(-1), float(1), float(1)])

      const neighbourCells: any[] =
        boundary === 'dead'
          ? [
              vec2(cellX.sub(1), cellY),
              vec2(cellX.add(1), cellY),
              vec2(cellX, cellY.sub(1)),
              vec2(cellX, cellY.add(1)),
              vec2(cellX.sub(1), cellY.sub(1)),
              vec2(cellX.add(1), cellY.sub(1)),
              vec2(cellX.sub(1), cellY.add(1)),
              vec2(cellX.add(1), cellY.add(1)),
            ]
          : (() => {
              const wrapX = (x: any) => x.add(columns).mod(columns)
              const wrapY = (y: any) => y.add(rows).mod(rows)
              return [
                vec2(wrapX(cellX.sub(1)), wrapY(cellY)),
                vec2(wrapX(cellX.add(1)), wrapY(cellY)),
                vec2(wrapX(cellX), wrapY(cellY.sub(1))),
                vec2(wrapX(cellX), wrapY(cellY.add(1))),
                vec2(wrapX(cellX.sub(1)), wrapY(cellY.sub(1))),
                vec2(wrapX(cellX.add(1)), wrapY(cellY.sub(1))),
                vec2(wrapX(cellX.sub(1)), wrapY(cellY.add(1))),
                vec2(wrapX(cellX.add(1)), wrapY(cellY.add(1))),
              ]
            })()
      const neighbourFlatIndices = array(neighbourCells.map((coord) => coord.y.mul(columns).add(coord.x)))

      const currentAlive = readBuf.element(instanceIndex).toVar()
      const liveNeighborCount = float(0).toVar()
      // Dead border: only count in-bounds; torus: always eight wrapped reads
      if (boundary === 'dead') {
        Loop({ start: 0, end: 8, type: 'int', condition: '<' }, ({ i: neighborIndex }) => {
          const neighborX = cellX.add(mooreDx.element(neighborIndex))
          const neighborY = cellY.add(mooreDy.element(neighborIndex))
          If(
            neighborX
              .greaterThanEqual(0)
              .and(neighborX.lessThan(columns))
              .and(neighborY.greaterThanEqual(0))
              .and(neighborY.lessThan(rows)),
            () => {
              const neighborFlat = neighborY.mul(columns).add(neighborX)
              If(readBuf.element(neighborFlat).equal(1), () => liveNeighborCount.addAssign(1))
            },
          )
        })
      } else {
        Loop({ start: 0, end: 8, type: 'int', condition: '<' }, ({ i: neighborIndex }) => {
          const neighborFlat = neighbourFlatIndices.element(neighborIndex)
          If(readBuf.element(neighborFlat).equal(1), () => liveNeighborCount.addAssign(1))
        })
      }

      if (rulesFn) {
        // Expose directional cells for makeWolframRulesFn and other non-totalistic steps
        const readNeighbor = (deltaX: number, deltaY: number) => {
          const neighborX = cellX.add(deltaX)
          const neighborY = cellY.add(deltaY)
          const value = float(0).toVar()
          if (boundary === 'dead') {
            If(
              neighborX
                .greaterThanEqual(0)
                .and(neighborX.lessThan(columns))
                .and(neighborY.greaterThanEqual(0))
                .and(neighborY.lessThan(rows)),
              () => value.assign(readBuf.element(neighborY.mul(columns).add(neighborX))),
            )
          } else {
            const wrappedX = neighborX.add(columns).mod(columns)
            const wrappedY = neighborY.add(rows).mod(rows)
            value.assign(readBuf.element(wrappedY.mul(columns).add(wrappedX)))
          }
          return value
        }
        const nw = readNeighbor(-1, -1)
        const ne = readNeighbor(1, -1)
        const north = readNeighbor(0, -1)
        const west = readNeighbor(-1, 0)
        const east = readNeighbor(1, 0)
        const nextAlive = rulesFn(currentAlive, liveNeighborCount, cellX, cellY, nw, ne, north, west, east)
        writeBuf.element(instanceIndex).assign(nextAlive)
        return
      }

      if (numBands === 1 || !slotF) {
        // Standard Game-of-Life style B/S from neighbour count
        const { birth, survive } = bandRules[0]!
        assignConway(currentAlive, liveNeighborCount, birth, survive, writeBuf)
        return
      }

      // simStepUniform → slotF picks which B/S band applies this step
      const nextState = float(0).toVar()
      buildSlotIfElseTree(slotF, bandRules, 0, nextState, currentAlive, liveNeighborCount)
      writeBuf.element(instanceIndex).assign(nextState)
    })().compute(CA_SIZE)

  return { computeA: makeStep(readA, readB), computeB: makeStep(readB, readA) }
}

export const CellularAutomata = ({
  rows = 250,
  columns = 250,
  depth = 1,
  maxIterations = 0,
  params = {},
  colorNodeFn,
  rulesFn,
}: CellularAutomataProps) => {
  const gl = useThree((state) => state.gl) as any

  // Drives rule-band slot in TSL (same role as time-varying uniforms elsewhere).
  const simStepUniform = useRef(uniform(0)).current

  /** `params.passes` wins; top-level `rulesFn` is only used for the legacy single-field path. */
  const hasPasses = Boolean(params.passes && params.passes.length > 0 && depth === 1)

  // Per-layer params serialized for useMemo (inline arrays in JSX won’t spuriously rebuild the graph)
  const passesConfigKey = hasPasses
    ? JSON.stringify(
        (params.passes || []).slice(0, CA_MAX_PASSES).map((passLayer) => ({
          birth: passLayer.birth ?? DEFAULT_BIRTH,
          survive: passLayer.survive ?? DEFAULT_SURVIVE,
          ruleBands: passLayer.ruleBands ?? null,
          rulesFnKey: passLayer.rulesFnKey ?? null,
          seed: passLayer.seed ?? 'random',
          seedDensity: passLayer.seedDensity ?? 0.25,
          foreground: passLayer.foreground ?? [1, 1, 1],
          initialSingleCell: passLayer.initialSingleCell ?? null,
          boundary: passLayer.boundary ?? 'torus',
          mask: passLayer.mask?.length
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

  const legacyRuleBandKey = JSON.stringify(params.ruleBands ?? null)

  const { background, effectiveScaleX, effectiveScaleY } = useMemo(
    () => resolveCaFraming(params.framing, params.background),
    [params.framing, params.background],
  )

  const {
    birth = DEFAULT_BIRTH,
    survive = DEFAULT_SURVIVE,
    seedDensity = 0.25,
    boundary = 'torus',
    initialSingleCell: paramsInitialCell,
    seed: seedMode = 'random',
    foreground = [1, 1, 1] as [number, number, number],
  } = params

  const maxStepSlots = maxIterations > 0 ? maxIterations : MAX_RULE_STEPS

  // biome-ignore lint/correctness/useExhaustiveDependencies: passesConfigKey / band keys track structural params.
  const gpuState: CaGpuState = useMemo(() => {
    const CA_GRID_SIZE = columns * rows * depth

    // One ping-pong pair + pipeline per pass; fragment composites bottom → top
    const buildMultiPassState = (): CaGpuState => {
      const layers = params.passes!.slice(0, CA_MAX_PASSES)
      const layerBuffers: ReturnType<typeof storage>[] = []
      const layerInitComputes: { compute: any }[] = []
      const computePasses: { computeA: any; computeB: any; displayIsA: any }[] = []

      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const passLayer = layers[layerIndex]
        const layerBirth = passLayer.birth ?? DEFAULT_BIRTH
        const layerSurvive = passLayer.survive ?? DEFAULT_SURVIVE
        const layerBoundary = passLayer.boundary ?? 'torus'
        const layerSeed = passLayer.seed ?? 'random'
        const layerSeedDensity = passLayer.seedDensity ?? 0.25
        const layerInitialCell = passLayer.initialSingleCell
        const layerHashSalt = layerIndex * 79.123 + 12.9898
        const layerRulesFn = passLayer.rulesFn

        const { stepToSlot, bandRules } = compileIterationRuleBands(
          maxStepSlots,
          layerRulesFn ? undefined : passLayer.ruleBands,
          layerBirth,
          layerSurvive,
        )
        const bandCount = bandRules.length

        // Ping-pong cell state (float 0/1 per cell).
        const bufferA = storage(new THREE.StorageInstancedBufferAttribute(CA_GRID_SIZE, 1), 'float', CA_GRID_SIZE)
        const bufferB = storage(new THREE.StorageInstancedBufferAttribute(CA_GRID_SIZE, 1), 'float', CA_GRID_SIZE)
        layerBuffers.push(bufferA, bufferB)

        // One-time grid seeding into buffer A.
        const gridInitCompute = Fn(() => {
          const cellX = floor(float(instanceIndex.mod(columns)))
          const cellY = floor(float(instanceIndex.div(columns)))
          const initialState = float(0).toVar()
          if (layerInitialCell) {
            If(cellX.equal(float(layerInitialCell.column)).and(cellY.equal(float(layerInitialCell.row))), () =>
              initialState.assign(1),
            )
          } else if (layerSeed === 'apex-top') {
            If(cellX.equal(float(Math.floor(columns / 2))).and(cellY.equal(0)), () => initialState.assign(1))
          } else {
            const noise = hash(instanceIndex.add(float(layerHashSalt * 1e3)))
            If(noise.lessThan(float(layerSeedDensity)), () => initialState.assign(1))
          }
          bufferA.element(instanceIndex).assign(initialState)
        })().compute(CA_GRID_SIZE)
        layerInitComputes.push(gridInitCompute)

        const stepSlotValues = array(stepToSlot.map((slotIndex) => float(slotIndex)))
        const lastSlotIndex = float(Math.max(0, stepToSlot.length - 1))
        const clampedStepIndex = floor(simStepUniform.clamp(0, lastSlotIndex))
        const activeRuleSlot = bandCount > 1 && !layerRulesFn ? stepSlotValues.element(clampedStepIndex) : null
        const displayIsA = uniform(1)

        const { computeA, computeB } = buildConwayPipelines({
          readA: bufferA,
          readB: bufferB,
          columns,
          rows,
          CA_SIZE: CA_GRID_SIZE,
          boundary: layerBoundary,
          bandRules,
          numBands: bandCount,
          slotF: activeRuleSlot,
          rulesFn: layerRulesFn ?? null,
        })

        computePasses.push({ computeA, computeB, displayIsA })
      }

      for (const initCompute of layerInitComputes) {
        gl.compute(initCompute)
      }

      const foregroundVectors = layers.map((passLayer) => {
        const fg = passLayer.foreground ?? [1, 1, 1]
        return vec3(float(fg[0]), float(fg[1]), float(fg[2]))
      })
      const backgroundVector = vec3(float(background[0]), float(background[1]), float(background[2]))
      const xCellSize = 1 / columns
      const yCellSize = 1 / rows

      // Fragment color: composite passes bottom → top inside the framed grid.
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

        const cellColumn = floor(gridUv.x.div(xCellSize)).clamp(0, columns - 1)
        const cellRowFromUv = floor(gridUv.y.div(yCellSize)).clamp(0, rows - 1)
        const cellRow = float(rows - 1).sub(cellRowFromUv)
        const flatCellIndex = cellRow.mul(columns).add(cellColumn)

        const fragmentColor = vec3(0).toVar()
        If(outsideFraming, () => fragmentColor.assign(backgroundVector)).Else(() => {
          const composited = backgroundVector.toVar()
          for (let i = 0; i < layers.length; i++) {
            const pass = computePasses[i]!
            const readBufferA = layerBuffers[i * 2]!
            const readBufferB = layerBuffers[i * 2 + 1]!
            const cellAlive = float(0).toVar()
            If(pass.displayIsA.equal(1), () => cellAlive.assign(readBufferA.element(flatCellIndex))).Else(() =>
              cellAlive.assign(readBufferB.element(flatCellIndex)),
            )
            const maskRegions = layers[i]!.mask
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
                If(inColumnRange.and(inRowRange), () => maskWeight.assign(1))
              }
            }
            const layerOpacity = cellAlive.mul(maskWeight)
            const backgroundWeight = float(1).sub(layerOpacity)
            composited.assign(foregroundVectors[i]!.mul(layerOpacity).add(composited.mul(backgroundWeight)))
          }
          fragmentColor.assign(composited)
        })
        return fragmentColor
      })

      return { kind: 'multi' as const, computePasses, colorNode }
    }

    // Classic path: one field, optional B/S bands or top-level rulesFn, optional colorNodeFn
    const buildSingleFieldState = (): CaGpuState => {
      const { stepToSlot, bandRules } = compileIterationRuleBands(
        maxStepSlots,
        rulesFn ? undefined : params.ruleBands,
        birth,
        survive,
      )
      const bandCount = bandRules.length
      const stepSlotValues = array(stepToSlot.map((slotIndex) => float(slotIndex)))
      const lastSlotIndex = float(Math.max(0, stepToSlot.length - 1))
      const clampedStepIndex = floor(simStepUniform.clamp(0, lastSlotIndex))
      const activeRuleSlot = bandCount > 1 && !rulesFn ? stepSlotValues.element(clampedStepIndex) : float(0)

      const bufferA = storage(new THREE.StorageInstancedBufferAttribute(CA_GRID_SIZE, 1), 'float', CA_GRID_SIZE)
      const bufferB = storage(new THREE.StorageInstancedBufferAttribute(CA_GRID_SIZE, 1), 'float', CA_GRID_SIZE)
      const displayIsA = uniform(1)

      const gridInitCompute = Fn(() => {
        const cellX = floor(float(instanceIndex.mod(columns)))
        const cellY = floor(float(instanceIndex.div(columns)))
        const initialState = float(0).toVar()
        if (paramsInitialCell) {
          If(cellX.equal(float(paramsInitialCell.column)).and(cellY.equal(float(paramsInitialCell.row))), () =>
            initialState.assign(1),
          )
        } else if (seedMode === 'apex-top') {
          If(cellX.equal(float(Math.floor(columns / 2))).and(cellY.equal(0)), () => initialState.assign(1))
        } else {
          const noise = hash(instanceIndex)
          If(noise.lessThan(float(seedDensity)), () => initialState.assign(1))
        }
        bufferA.element(instanceIndex).assign(initialState)
      })().compute(CA_GRID_SIZE)
      gl.compute(gridInitCompute)

      const { computeA, computeB } = buildConwayPipelines({
        readA: bufferA,
        readB: bufferB,
        columns,
        rows,
        CA_SIZE: CA_GRID_SIZE,
        boundary,
        bandRules,
        numBands: bandCount,
        slotF: bandCount > 1 && !rulesFn ? activeRuleSlot : null,
        rulesFn: rulesFn ?? null,
      })

      const foregroundVector = vec3(float(foreground[0]), float(foreground[1]), float(foreground[2]))
      const xCellSize = 1 / columns
      const yCellSize = 1 / rows

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
          fragmentColor.assign(vec3(float(background[0]), float(background[1]), float(background[2])))
        }).Else(() => {
          const cellColumn = floor(gridUv.x.div(xCellSize)).clamp(0, columns - 1)
          const cellRowFromUv = floor(gridUv.y.div(yCellSize)).clamp(0, rows - 1)
          const cellRow = float(rows - 1).sub(cellRowFromUv)
          const flatCellIndex = cellRow.mul(columns).add(cellColumn)
          const cellAlive = float(0).toVar()
          If(displayIsA.equal(1), () => {
            cellAlive.assign(bufferA.element(flatCellIndex))
          }).Else(() => {
            cellAlive.assign(bufferB.element(flatCellIndex))
          })
          If(cellAlive.equal(1), () => {
            if (colorNodeFn) {
              fragmentColor.assign(colorNodeFn(cellAlive, flatCellIndex))
            } else {
              fragmentColor.assign(foregroundVector)
            }
          }).Else(() => {
            fragmentColor.assign(vec3(float(background[0]), float(background[1]), float(background[2])))
          })
        })
        return fragmentColor
      })

      return { kind: 'legacy' as const, computeA, computeB, colorNode, displayIsA }
    }

    if (hasPasses && params.passes) {
      return buildMultiPassState()
    }
    return buildSingleFieldState()
  }, [
    rulesFn,
    colorNodeFn,
    birth,
    survive,
    effectiveScaleX,
    effectiveScaleY,
    seedDensity,
    background,
    foreground,
    columns * rows * depth,
    columns,
    rows,
    depth,
    gl,
    boundary,
    paramsInitialCell,
    seedMode,
    hasPasses,
    passesConfigKey,
    maxStepSlots,
    legacyRuleBandKey,
    simStepUniform,
  ])

  // Step the sim every 125ms so each generation is visible (vs updating every frame).
  // Each tick: feed `simStepUniform` (step bands), then run one ping-pong half per field.
  // `computeA` reads A → writes B; `computeB` reads B → writes A. We await so the GPU
  // finishes before toggling. `displayIsA` tells the material which buffer is current (0 = B, 1 = A).
  // Multi-pass: one `nextStepReadsFromA` slot per pass so every layer advances on the same tick.
  useEffect(() => {
    let stepCount = 0
    const state = gpuState
    /** Per pass/single field: if true, this tick uses `computeA` (source is buffer A). */
    const nextStepReadsFromA = state.kind === 'multi' ? state.computePasses.map(() => true) : [true]

    const intervalId = setInterval(() => {
      simStepUniform.value = stepCount

      if (state.kind === 'multi') {
        // Same interval for all passes; each maintains its own A/B phase.
        for (let passIndex = 0; passIndex < state.computePasses.length; passIndex++) {
          const pass = state.computePasses[passIndex]!
          if (nextStepReadsFromA[passIndex]) {
            gl.compute(pass.computeA)
            nextStepReadsFromA[passIndex] = false
            pass.displayIsA.value = 0
          } else {
            gl.compute(pass.computeB)
            nextStepReadsFromA[passIndex] = true
            pass.displayIsA.value = 1
          }
        }
      } else {
        if (nextStepReadsFromA[0]) {
          gl.compute(state.computeA)
          nextStepReadsFromA[0] = false
          state.displayIsA.value = 0
        } else {
          gl.compute(state.computeB)
          nextStepReadsFromA[0] = true
          state.displayIsA.value = 1
        }
      }

      stepCount++
      if (maxIterations > 0 && stepCount >= maxIterations) {
        clearInterval(intervalId)
      }
    }, 125)

    return () => {
      clearInterval(intervalId)
    }
  }, [gpuState, gl, maxIterations, simStepUniform])

  return <WebGPUShader colorNode={gpuState.colorNode()} />
}
