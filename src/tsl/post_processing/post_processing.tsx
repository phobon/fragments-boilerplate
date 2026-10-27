// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.185 (334 errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { convertToTexture, type Fn, mrt, output, pass, texture, uniform, vec4 } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { feedbackTrailsEffect } from './feedback_trails_effect'
import { resolvePipelineOutputColorTransform } from './pp_output_transform'

// --- feedback-trails history ping-pong ---------------------------------
//
// Same bookkeeping as `src/components/graph/feedback_history_ping_pong.ts`
// (unit-tested there — see that module's docblock for the mechanism):
// two render targets (A/B) ping-pong, one always the "read" side (sampled as
// history this frame) and one the "write" side (this frame's composite gets
// copied into it), swapping every frame. Duplicated here rather than imported
// because this package (fragments-functions) is deliberately standalone and
// never imports from the app's `src/` (see package.json — no `@/...` import
// anywhere in this package).
type HistoryPair<RT> = { a: RT; b: RT; readIsA: boolean }

function createHistoryPair<RT>(allocate: () => RT): HistoryPair<RT> {
  return { a: allocate(), b: allocate(), readIsA: true }
}

function historyRead<RT>(pair: HistoryPair<RT>): RT {
  return pair.readIsA ? pair.a : pair.b
}

function historyWrite<RT>(pair: HistoryPair<RT>): RT {
  return pair.readIsA ? pair.b : pair.a
}

function swapHistoryPair<RT>(pair: HistoryPair<RT>): void {
  pair.readIsA = !pair.readIsA
}

function disposeHistoryPair<RT extends { dispose: () => void }>(pair: HistoryPair<RT>): void {
  pair.a.dispose()
  pair.b.dispose()
}

function resetHistoryPair<RT extends { dispose: () => void }>(
  pair: HistoryPair<RT>,
  allocate: () => RT,
): HistoryPair<RT> {
  disposeHistoryPair(pair)
  return createHistoryPair(allocate)
}

export type PostProcessingLayer = {
  effect: Fn
  wrap?: 'none' | 'repeat' | 'mirror'
  args?: Record<string, unknown>
  /**
   * Compiled `postProcessingEffect` export of the PP node's OWN code, plus its
   * resolved upstream animation-source props (see pp_chain_renderer.tsx's
   * `ResolvedPPEffect`). When present the pass invokes this instead of the
   * registry `effect`, wrapping the promoted args as `ppArgs`
   * (`effect({ ...props, ppArgs: { input, ...args } })`) — parity with
   * buildOutputNode so code-edited PP animation renders in capture export too.
   * Falls back to `effect({ input, ...args })` on invoke throw (a bad edit
   * must not blank the pass).
   */
  resolvedEffect?: {
    // biome-ignore lint/suspicious/noExplicitAny: compiled TSL Fn export
    effect: (props: any) => any
    props: Record<string, unknown>
  }
}

export type PostProcessingProps = {
  /** Single effect (legacy). Prefer `layers` for chains. */
  effect?: Fn
  wrap?: 'none' | 'repeat' | 'mirror'
  args?: Record<string, unknown>
  /** Ordered passes: scene → layers[0] → layers[1] → … */
  layers?: PostProcessingLayer[]
}

const applyTextureWrap = (
  textureNode: { value?: { wrapS: number; wrapT: number } },
  wrap: PostProcessingLayer['wrap'],
) => {
  if (!textureNode.value) {
    return
  }

  switch (wrap) {
    case 'repeat':
      textureNode.value.wrapS = THREE.RepeatWrapping
      textureNode.value.wrapT = THREE.RepeatWrapping
      break
    case 'mirror':
      textureNode.value.wrapS = THREE.MirroredRepeatWrapping
      textureNode.value.wrapT = THREE.MirroredRepeatWrapping
      break
    default:
      break
  }
}

// --- structure vs. value separation -----------------------------------------
//
// Numeric args (the things sliders drag) are compiled into mutable `uniform()`
// nodes instead of baked-in constants. That lets us split a layer's identity
// into two keys:
//   - structureKey: effect identity, wrap, arg *names* + non-numeric arg
//                   identities. Changing this rebuilds the RenderPipeline.
//   - valueKey:     the numeric arg *values*. Changing this only writes
//                   `uniform.value`, so dragging a dial updates the preview
//                   without recompiling the shader graph.
// Previously any arg change (via JSON.stringify of all args) rebuilt the whole
// pipeline every frame of a drag.

const objectIds = new WeakMap<object, number>()
let nextObjectId = 0

/** Stable, cheap identity for non-serializable args (TSL nodes, textures, fns). */
const objectId = (value: object): number => {
  let id = objectIds.get(value)
  if (id === undefined) {
    id = nextObjectId++
    objectIds.set(value, id)
  }
  return id
}

type Vec2Arg = { x: number; y: number }

const isVec2Arg = (value: unknown): value is Vec2Arg =>
  value != null &&
  typeof value === 'object' &&
  typeof (value as Vec2Arg).x === 'number' &&
  typeof (value as Vec2Arg).y === 'number'

/** Signature that captures everything *except* numeric values. */
const structureSignatureForArg = (value: unknown): string => {
  if (typeof value === 'number') {
    return 'n'
  }
  if (isVec2Arg(value)) {
    return 'v2'
  }
  if (value === null || value === undefined) {
    return 'null'
  }
  switch (typeof value) {
    case 'boolean':
      return `b:${value}`
    case 'string':
      return `s:${value}`
    case 'object':
    case 'function':
      return `o:${objectId(value as object)}`
    default:
      return `x:${String(value)}`
  }
}

const buildStructureKey = (layers: PostProcessingLayer[]): string =>
  layers
    .map((layer, index) => {
      const args = layer.args ?? {}
      const argSignature = Object.keys(args)
        .sort()
        .map((name) => `${name}=${structureSignatureForArg(args[name])}`)
        .join(',')
      const resolvedSignature = layer.resolvedEffect
        ? `:re${objectId(layer.resolvedEffect.effect as unknown as object)}`
        : ''
      return `${index}:${objectId(layer.effect as unknown as object)}:${layer.wrap ?? 'none'}:${argSignature}${resolvedSignature}`
    })
    .join('|')

const buildValueKey = (layers: PostProcessingLayer[]): string =>
  layers
    .map((layer, index) => {
      const args = layer.args ?? {}
      const valueParts = Object.keys(args)
        .sort()
        .flatMap((name) => {
          const value = args[name]
          if (typeof value === 'number') {
            return [`${name}=${value}`]
          }
          if (isVec2Arg(value)) {
            return [`${name}=${value.x},${value.y}`]
          }
          return []
        })
        .join(',')
      return `${index}:${valueParts}`
    })
    .join('|')

const uniformKey = (layerIndex: number, argName: string) => `${layerIndex}:${argName}`

// --- runtime pixel-evidence instrumentation (stage A/B split diagnosis) -----
//
// The existing "pp-pass feedback (split)" console.debug (see the render loop
// below) confirms the split path is live and reports uniform/output-transform
// *metadata*, but never actual pixel content — insufficient to diagnose the
// still-export white-background/black-radial-blob blowout reported against a
// trails→bloom→vignette→CA chain (the graph preview of the same chain is
// correct, but that preview runs an entirely different renderer —
// `src/components/graph/pp_chain_renderer.tsx`'s per-node chain-prefix-reuse
// pipeline — which never touches this component at all; only the export
// capture path (`src/components/export/export_capture_host.tsx` →
// `src/components/shader/post_processing.tsx`) renders through here). This
// block adds pixel-level probes so the NEXT round can be fix-by-evidence
// rather than fix-by-guess. Deliberately does not attempt a fix.
//
// Gated the same way `src/components/export/export_capture_host.tsx`'s
// `exportDebugEnabled()` gates its own logging (`window.__artificeExportDebug`)
// — duplicated rather than imported, since this package never imports the
// app's `src/` (see the historyPair docblock above for the same rule).
//
// OPT-IN ONLY (native CEF export stall, 2026-07-31): this was previously
// defaulted ON so the evidence-gathering round didn't require the caller to
// flip a flag first. That default is the prime suspect for a stall reproduced
// ONLY in the native CEF shell, never in Chrome: identical fixture, identical
// code, but the native run's export session ticks its useFrame loop exactly
// ONCE (one "pp-pass feedback (split)" log, one set of all-zero probes) and
// then is never scheduled again — no thrown error, no uncaught/unhandled-
// rejection (console_mirror.ts installs both handlers), the loop simply stops
// being invoked. The probe that ran on that single tick and is UNIQUE to CEF's
// WebGPU canvas handling is `probeStageBCanvas`'s `createImageBitmap(gl.
// domElement)` on the live WebGPU-backed canvas — see its own docblock
// (removed below) for why it existed and why it's gone now. Until proven
// otherwise, assume grabbing a bitmap off the export canvas mid-presentation
// can wedge or silently lose that canvas's context in CEF, which would also
// explain R3F's demand loop never being scheduled again (R3F pauses its
// render loop on webgl/webgpu context loss and only resumes on a restore
// event that may never fire here). Set `window.__artificeExportDebug = true`
// in console to re-enable these probes for evidence-gathering; they must
// never be on by default again.
const PP_SPLIT_PROBE_DEBUG = (() => {
  if (typeof window !== 'undefined') {
    const flag = (window as { __artificeExportDebug?: boolean }).__artificeExportDebug
    if (typeof flag === 'boolean') {
      return flag
    }
  }
  return false
})()

type PixelProbePoint = 'center' | 'quarter' | 'corner'

const PIXEL_PROBE_POINT_NAMES: PixelProbePoint[] = ['center', 'quarter', 'corner']

const pixelProbeCoords = (w: number, h: number): Record<PixelProbePoint, [number, number]> => ({
  center: [Math.floor(w / 2), Math.floor(h / 2)],
  quarter: [Math.floor(w / 4), Math.floor(h / 4)],
  corner: [0, 0],
})

/**
 * three r185's WebGPU backend picks the readback's typed array type from the
 * GPU texture format (`WebGPUTextureUtils._getTypedArrayType` — 8-bit targets
 * read back as `Uint8Array`/0-255, float targets as `Float32Array`/0-1 or
 * HDR). Label which one a given probe actually got rather than assume.
 */
const formatProbePixel = (pixels: ArrayLike<number>): string => {
  const isFloat = !(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray)
  const r = pixels[0]
  const g = pixels[1]
  const b = pixels[2]
  const a = pixels[3]
  return `${r},${g},${b},${a}(${isFloat ? 'float' : 'u8'})`
}

type PixelReadbackRenderer = {
  readRenderTargetPixelsAsync: (
    renderTarget: THREE.RenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<ArrayLike<number>>
}

const hasPixelReadback = (renderer: unknown): renderer is PixelReadbackRenderer =>
  typeof (renderer as Partial<PixelReadbackRenderer> | null)?.readRenderTargetPixelsAsync === 'function'

/**
 * Probes an arbitrary render target's pixels. The renderer's only readback API
 * is `readRenderTargetPixelsAsync(rt, x, y, w, h)` — async-only, no
 * pre-allocated buffer param (same API `src/components/graph/graph_editor/
 * minimap_snapshot_driver.tsx` already uses for minimap captures). Reading a
 * 1×1 region per probe point sidesteps the 256-byte row-alignment padding the
 * WebGPU backend applies to reads wider than 1px (WebGPUTextureUtils.
 * copyTextureToBuffer) — no destriding needed for a single-texel read.
 *
 * `label` distinguishes the log line's source RT — this same function backs
 * both "stage A's just-written history RT" (the composited trails output) and
 * "scenePass's own internal RT" (the raw, un-composited scene render) so the
 * two can be diffed: if the scenePass probe is non-zero but the stage A probe
 * is all-zero, the scene rendered fine and the bug is in stage A's composite
 * draw / writeRt binding; if BOTH are all-zero, the scene itself never
 * rendered — see the scenePassRef docblock above for the fix this justifies.
 */
const probeRenderTarget = async (renderer: unknown, rt: THREE.RenderTarget, label: string): Promise<void> => {
  if (!hasPixelReadback(renderer)) {
    console.debug(`[artifice] split ${label} probe: skipped (renderer has no readRenderTargetPixelsAsync)`)
    return
  }
  const coords = pixelProbeCoords(rt.width, rt.height)
  try {
    const reads = await Promise.all(
      PIXEL_PROBE_POINT_NAMES.map((name) => {
        const [x, y] = coords[name]
        return renderer.readRenderTargetPixelsAsync(rt, x, y, 1, 1)
      }),
    )
    const parts = PIXEL_PROBE_POINT_NAMES.map((name, i) => `${name}=${formatProbePixel(reads[i])}`)
    console.debug(`[artifice] split ${label} probe: ${parts.join(' ')} size=${rt.width}x${rt.height}`)
  } catch (error) {
    console.debug(`[artifice] split ${label} probe: readback failed`, error)
  }
}

// REMOVED (native CEF export stall, 2026-07-31): this used to probe stage B's
// output via `createImageBitmap(gl.domElement)` on the live WebGPU canvas →
// OffscreenCanvas `drawImage` → `getImageData`, fire-and-forget, since
// `readRenderTargetPixelsAsync` needs an explicit RenderTarget and there's no
// renderer-level readback for "whatever's currently bound" (the canvas). It
// was the one probe that touched the canvas element itself rather than an
// off-screen RenderTarget, and it landed in the exact build that started
// stalling the export loop in the native CEF shell only (never in Chrome) —
// see PP_SPLIT_PROBE_DEBUG's docblock above. Dropped entirely rather than
// merely gated: the stage A (history write RT) and scenePass (internal RT)
// probes below already cover the diagnostic need this was added for (per-
// stage pixel evidence), so there is no case where re-adding a canvas
// readback here is worth the risk of repeating whatever this did to CEF.

/** Best-effort human identity for a layer at build time — `Fn`-wrapped effects don't reliably keep the source const's name, so pair whatever name survives with the same `objectId` the structure/value keys already use for stable identity. */
const describeLayerForLog = (layer: PostProcessingLayer, globalIndex: number): string => {
  const fnName = (layer.effect as unknown as { name?: string } | undefined)?.name
  const name = fnName && fnName.length > 0 ? fnName : 'anon'
  const resolvedTag = layer.resolvedEffect ? ':resolved' : ''
  return `${globalIndex}:${name}#${objectId(layer.effect as unknown as object)}${resolvedTag}`
}

// --- feedback-trails chain split (export-parity fix) ------------------
//
// Same decision as `src/components/graph/feedback_trails_chain_split.ts`
// (unit-tested there — see that module's docblock for the full rationale).
// Duplicated here rather than imported for the same reason the history
// ping-pong bookkeeping above is duplicated (this package never imports from
// the app's `src/`).
//
// SHORT VERSION: under chain-prefix reuse (the correct, shipped-default
// semantics the graph preview implements — each PP graph node holds exactly
// one layer and samples its direct upstream node's OWN render target), a
// feedbackTrailsEffect layer's node accumulates ONLY its own output into
// history; anything downstream (bloom/CA/vignette/…) is a separate render
// applied exactly once to that already-accumulated result. Export instead
// flattens a whole resolved chain (every ancestor PP node's layer, root →
// target, inclusive) into ONE multi-layer `PostProcessing` pass — so without
// this split, a trails layer followed by more layers here would redirect the
// FULL composite (post-bloom, post-CA) into history, re-blooming already-
// bloomed history and compounding CA fringes frame over frame. The fix:
// split the chain at the FIRST trails layer into "stage A" (through the
// trails layer inclusive — written to history) and "stage B" (everything
// after — applied once, never fed back).
const findTrailsSplitIndex = (layers: PostProcessingLayer[]): number =>
  layers.findIndex((layer) => layer.effect === feedbackTrailsEffect)

// False (no split — existing single-pipeline path, byte-identical) when
// there's no trails layer, OR the trails layer is the LAST layer (there is
// no "stage B" there — the existing single-pipeline-into-history + one blit
// shape is already exactly correct for that configuration).
const needsTwoStagePipeline = (splitIndex: number, layerCount: number): boolean =>
  splitIndex >= 0 && splitIndex < layerCount - 1

// One of the two shapes a built chain can take. `single` covers both "no
// feedback at all" and "trails is the last layer" (both keep today's
// single-RenderPipeline render loop verbatim). `split` is the new two-
// pipeline shape: `stageA` renders L1..Lk (trails inclusive) into the
// history write RT; `stageB` renders Lk+1..Ln, reading `stageBInputTextureNode`
// (repointed every frame at the freshly-written history RT's texture, right
// before stageB renders) to the screen/capture target.
type PipelineBuild =
  | { mode: 'single'; pipeline: THREE.RenderPipeline }
  | {
      mode: 'split'
      stageA: THREE.RenderPipeline
      stageB: THREE.RenderPipeline
      stageBInputTextureNode: ReturnType<typeof texture>
      // wrap of stage B's own first layer — reapplied to
      // stageBInputTextureNode every frame (see the render loop): unlike
      // every other chain input, this node's `.value` ping-pongs between
      // two distinct Texture objects across frames, so a wrap mode baked
      // once at build time would only ever land on whichever side
      // happened to be "write" at build time.
      stageBFirstWrap: PostProcessingLayer['wrap']
    }

export const PostProcessing = ({ effect, wrap = 'none', args = {}, layers }: PostProcessingProps) => {
  const { gl: renderer, scene, camera } = useThree()
  const pipelinesRef = useRef<PipelineBuild | null>(null)
  // layerIndex:argName → uniform node, so value updates can mutate in place.
  const uniformsRef = useRef<Map<string, ReturnType<typeof uniform>>>(new Map())

  // Feedback trails (docs/plan/feedback-trails-bloom-pp.md, Brief B) — all
  // refs below are LOCAL to this component instance (one `PostProcessing`
  // mounts per PP-editor scene), never module-level, per the offscreen-rig
  // incident this same invariant is documented against elsewhere
  // (pp_chain_renderer.tsx's "per-renderer offscreen rig" comment).
  const historyPairRef = useRef<HistoryPair<THREE.RenderTarget> | null>(null)
  // The STABLE `texture()` node injected as `historyTexture` — its `.value`
  // is swapped every frame in the render loop below; the node itself is only
  // replaced on a structure rebuild (new RenderPipeline), so a
  // feedbackTrailsEffect layer's structure key never changes frame-to-frame.
  const historyTextureNodeRef = useRef<ReturnType<typeof texture> | null>(null)
  // Set whenever history must be blanked before its next sample (first
  // allocation, structure rebuild, or a resize) — stale frames must not
  // smear across an edit or a canvas resize.
  const pendingHistoryClearRef = useRef(false)
  // Cheap full-screen blit rig used to present the history "write" RT on
  // screen once per frame (RenderPipeline.render() has no render-target
  // param — see research notes — so redirecting its output away from the
  // screen for one frame requires blitting it back manually).
  const blitRigRef = useRef<{
    scene: THREE.Scene
    camera: THREE.OrthographicCamera
    material: THREE.MeshBasicNodeMaterial
    textureNode: ReturnType<typeof texture>
  } | null>(null)
  // ROOT-CAUSE FIX (split stage A scene content): `scenePass` used to be a
  // variable purely local to the build effect below — the render loop had NO
  // way to reach it. Its own scene-render (`PassNode.updateBefore()`) is
  // normally triggered IMPLICITLY, nested inside whichever RenderPipeline's
  // `.render()` call first walks a node graph that samples
  // `scenePass.getTextureNode(...)` — before the split, that was the ONE
  // pipeline covering the whole chain; after the split, it's `stageA` alone,
  // now sharing the renderer with a SECOND `RenderPipeline` (`stageB`) inside
  // the same tick. Rather than trust that nested, nodeFrame-dedup-gated
  // timing to land the scene's pixels before stage A's own composite draw
  // consumes them every frame (three r185 `PassNode.updateBefore` +
  // `NodeFrame.updateBeforeNode` — see the render loop below for the
  // citation), this ref lets the render loop call `scenePass.updateBefore()`
  // itself, EXPLICITLY, before stage A renders — deterministic regardless of
  // how many separate `RenderPipeline.render()` calls share this frame.
  // Populated in the build effect below, cleared alongside `scenePass`'s own
  // disposal in that effect's cleanup.
  const scenePassRef = useRef<ReturnType<typeof pass> | null>(null)
  // Runtime instrumentation for the feedback path (see console.debug call in
  // the render loop below) — a permanent breadcrumb, not a temporary debug
  // tool, since the whole reason this bug slipped past a prior fix attempt
  // (feedback_trails_export_warmup.ts) was that there was no runtime
  // visibility into the decay uniform's *live* value vs. what the effect
  // graph was actually built with, or whether the output-transform flag was
  // on. Counts frames while the feedback path is active; resets to 0 the
  // frame it goes inactive (structure rebuild/unmount) so a stale count
  // never survives into a new pipeline.
  const feedbackTickCountRef = useRef(0)
  const feedbackLastDebugLogMsRef = useRef(0)
  // Re-entrancy guards for the pixel-evidence probes below — same pattern as
  // compute_visualization.ts's `entry.pending` gate
  // (src/components/graph/graph_editor/compute_visualization.ts): set true
  // before the await, checked first to skip issuing a new probe while one is
  // still in flight, reset once the read resolves (success or failure). Never
  // awaited from the render loop (fire-and-forget), so a slow readback can
  // never stall a frame.
  const splitProbeAInFlightRef = useRef(false)
  const splitProbeScenePassInFlightRef = useRef(false)

  const normalizedLayers = useMemo((): PostProcessingLayer[] => {
    if (layers && layers.length > 0) {
      return layers
    }
    if (effect) {
      return [{ effect, wrap, args: args ?? {} }]
    }
    return []
  }, [layers, effect, wrap, args])

  const structureKey = useMemo(() => buildStructureKey(normalizedLayers), [normalizedLayers])
  const valueKey = useMemo(() => buildValueKey(normalizedLayers), [normalizedLayers])

  const layersRef = useRef(normalizedLayers)
  layersRef.current = normalizedLayers

  // Rebuild the pipeline only when the *structure* changes.
  useEffect(() => {
    const layers = layersRef.current
    if (!renderer || !scene || !camera || layers.length === 0) {
      // Nothing to build — release any stray history state rather than
      // leaking it (e.g. every layer removed while feedback was active).
      if (historyPairRef.current) {
        disposeHistoryPair(historyPairRef.current)
        historyPairRef.current = null
      }
      historyTextureNodeRef.current = null
      return
    }

    const uniforms = new Map<string, ReturnType<typeof uniform>>()

    // Feedback trails: (re)allocate the history pair the first time a layer
    // needs it, or tear it down when the chain no longer does. Allocating a
    // RenderTarget here is cheap JS-side bookkeeping (no GPU work); actual
    // sizing/clearing happens in the render loop once the renderer's canvas
    // size is known. `historyTextureNode` is a FRESH node every rebuild (a
    // new node graph needs its own node reference) but its `.value` is only
    // ever mutated, never replaced, across frames — see the render loop.
    const needsFeedback = layers.some((layer) => layer.effect === feedbackTrailsEffect)
    let historyTextureNode: ReturnType<typeof texture> | null = null
    if (needsFeedback) {
      if (!historyPairRef.current) {
        historyPairRef.current = createHistoryPair(() => new THREE.RenderTarget(1, 1))
      }
      historyTextureNode = texture(historyRead(historyPairRef.current).texture)
      pendingHistoryClearRef.current = true
    } else if (historyPairRef.current) {
      disposeHistoryPair(historyPairRef.current)
      historyPairRef.current = null
    }
    historyTextureNodeRef.current = historyTextureNode

    const scenePass = pass(scene, camera)
    // See scenePassRef's docblock above: expose this build's scenePass to the
    // render loop so it can be primed explicitly rather than relying on
    // implicit nested-updateBefore timing once two RenderPipelines share a
    // tick (split mode).
    scenePassRef.current = scenePass
    // r185: MRTNode.setup() resolves each declared output to a render-target
    // texture *by name* (getTextureIndex), and getOutputType() indexes
    // renderTarget.textures[index] with no bounds check. Declaring an MRT output
    // we never read back (emissive) means its texture is never realised on the
    // pass target, so the name lookup returns -1 and the scene material compile
    // throws "Cannot read properties of undefined (reading 'type')". Only declare
    // outputs we actually consume; if bloom/emissive is added later, declare it
    // here *and* read it via scenePass.getTextureNode('emissive').
    scenePass.setMRT(mrt({ output }))

    // Builds one segment of the chain (a "stage"), starting from `startNode`,
    // applying `chainLayers` in order. `baseIndex` is the GLOBAL index of
    // `chainLayers[0]` within the full `layers` array — uniform keys
    // (`uniformKey`) must stay stable regardless of where a stage split
    // lands, since the value-push effect below looks them up by the layer's
    // position in the FULL array, not its position within a stage.
    const buildChainStage = (
      startNode: ReturnType<typeof scenePass.getTextureNode>,
      chainLayers: PostProcessingLayer[],
      baseIndex: number,
      // Engine-injected history-read node for a feedbackTrailsEffect layer
      // WITHIN this stage (undefined when this stage shouldn't wire one —
      // e.g. stage B, where a trails layer would be a second/later
      // occurrence — see findTrailsSplitIndex's docblock).
      trailsHistoryTextureNode: ReturnType<typeof texture> | undefined,
      // Runtime instrumentation only (PP_SPLIT_PROBE_DEBUG build log below):
      // when passed, records the EXACT reference the first layer's effect
      // call receives as `input` — before any wrap/transform touches it — so
      // the build log can assert "the scene pass's own output node is really
      // what stage A's first layer consumed" instead of just assuming it from
      // the call site above.
      firstInputProbe?: { node: unknown },
    ): ReturnType<typeof scenePass.getTextureNode> => {
      let node = startNode
      for (let i = 0; i < chainLayers.length; i++) {
        const layer = chainLayers[i]
        const globalIndex = baseIndex + i
        if (i === 0 && firstInputProbe) {
          firstInputProbe.node = node
        }
        applyTextureWrap(node, layer.wrap)

        // Promote numeric and vec2 args to uniforms; pass everything else straight through.
        const effectArgs: Record<string, unknown> = {}
        for (const [name, value] of Object.entries(layer.args ?? {})) {
          if (typeof value === 'number') {
            const uniformNode = uniform(value)
            uniforms.set(uniformKey(globalIndex, name), uniformNode)
            effectArgs[name] = uniformNode
          } else if (isVec2Arg(value)) {
            const uniformNode = uniform(new THREE.Vector2(value.x, value.y))
            uniforms.set(uniformKey(globalIndex, name), uniformNode)
            effectArgs[name] = uniformNode
          } else {
            effectArgs[name] = value
          }
        }
        if (layer.effect === feedbackTrailsEffect && trailsHistoryTextureNode) {
          // NOT a user arg (no dial) — engine-injected, same contract as
          // `asciiTexture` on `asciiEffect`.
          effectArgs.historyTexture = trailsHistoryTextureNode
        }

        let colorNode: ReturnType<typeof layer.effect>
        if (layer.resolvedEffect) {
          try {
            // The PP node's own code: promoted args + input travel inside
            // `ppArgs`; upstream shader exports travel as sibling props the
            // code destructures alongside `ppArgs` (parity with
            // pp_chain_renderer.tsx buildOutputNode's resolved branch).
            colorNode = layer.resolvedEffect.effect({
              ...layer.resolvedEffect.props,
              ppArgs: { input: node, ...effectArgs },
            })
          } catch {
            // A bad edit must not blank the pass — fall back to the registry effect.
            colorNode = layer.effect({ input: node, ...effectArgs })
          }
        } else {
          colorNode = layer.effect({ input: node, ...effectArgs })
        }
        const isLastOfStage = i === chainLayers.length - 1
        node = isLastOfStage ? colorNode : convertToTexture(colorNode)
      }
      return node
    }

    const sceneOutputNode = scenePass.getTextureNode('output')
    const trailsSplitIndex = findTrailsSplitIndex(layers)
    const useTwoStagePipeline = needsTwoStagePipeline(trailsSplitIndex, layers.length)

    let pipelines: PipelineBuild

    if (useTwoStagePipeline) {
      // Export-parity fix (docs/plan/graph-scene-performance.md WS3 Phase B
      // parity investigation): split at the FIRST trails layer so only ITS
      // own output (stage A) is written to history — bloom/CA/vignette/…
      // after it (stage B) are applied exactly once to that accumulated
      // result, never fed back. See findTrailsSplitIndex/
      // needsTwoStagePipeline's docblocks above for the full rationale and
      // `src/components/graph/feedback_trails_chain_split.ts` for the
      // unit-tested pure decision this mirrors.
      const stageALayers = layers.slice(0, trailsSplitIndex + 1)
      const stageBLayers = layers.slice(trailsSplitIndex + 1)

      // Only populated when PP_SPLIT_PROBE_DEBUG is on — see
      // buildChainStage's `firstInputProbe` param docblock above.
      const stageAFirstInputProbe: { node: unknown } | undefined = PP_SPLIT_PROBE_DEBUG
        ? { node: undefined }
        : undefined

      const stageAOutput = buildChainStage(
        sceneOutputNode,
        stageALayers,
        0,
        historyTextureNode ?? undefined,
        stageAFirstInputProbe,
      )

      const stageA = new THREE.RenderPipeline(renderer as THREE.WebGPURenderer)
      stageA.outputNode = stageAOutput
      // Stage A ALWAYS writes into the offscreen history RT (see the render
      // loop below) — never straight to the canvas — so, exactly like the
      // single-pipeline feedback path, it must emit LINEAR values: baking
      // tone mapping/color-space here would re-encode already-transformed
      // pixels every frame it's read back as history (see
      // resolvePipelineOutputColorTransform's docblock).
      stageA.outputColorTransform = resolvePipelineOutputColorTransform(true)

      // Stage B's input is a STABLE texture() node whose `.value` the render
      // loop repoints, every frame, at whichever history RT stage A just
      // wrote into (never the "read"/last-frame side) — mirrors how
      // `historyTextureNode` itself is a stable node whose `.value` swaps
      // per frame. Seeded here from the CURRENT write side of the (already
      // allocated, possibly still 1×1 placeholder) history pair so the node
      // always has a valid initial texture.
      const stageBInputTextureNode = texture(
        historyWrite(historyPairRef.current as HistoryPair<THREE.RenderTarget>).texture,
      )
      const stageBOutput = buildChainStage(stageBInputTextureNode, stageBLayers, trailsSplitIndex + 1, undefined)

      const stageB = new THREE.RenderPipeline(renderer as THREE.WebGPURenderer)
      // Alpha flatten (export washed-out fix, 2026-07-31): stage B is the
      // CANVAS-bound stage, and the capture canvas is what still/video export
      // reads back. Additive sprite blending accumulates FRACTIONAL alpha
      // (measured: mean α=29/255 across an exported webp, corners fully
      // transparent) — on screen the canvas composites opaque so alpha is
      // invisible, but every image viewer/encoder composites the readback
      // over white → "washed out". Force α=1 at the final canvas write,
      // keeping RGB untouched (exactly what the screen shows). Stage A /
      // history RTs are deliberately NOT flattened — their alpha is part of
      // the feedback accumulation math.
      stageB.outputNode = vec4(stageBOutput.rgb, 1)
      // Stage B renders to whatever is currently bound (the render loop
      // binds the canvas/capture target, null, right before calling this) —
      // applies the output transform exactly once, same as the ordinary
      // non-feedback single-pipeline path.
      stageB.outputColorTransform = true

      pipelines = {
        mode: 'split',
        stageA,
        stageB,
        stageBInputTextureNode,
        stageBFirstWrap: stageBLayers[0]?.wrap,
      }

      // Runtime instrumentation (see the "runtime pixel-evidence
      // instrumentation" docblock above `uniformKey`) — once per pipeline
      // build (i.e. once per structure change, not per frame): which layers
      // landed in which stage, whether the scene pass's own output node is
      // actually the node stage A's chain starts from (not some stale/
      // different reference), and the history RT's current dimensions.
      if (PP_SPLIT_PROBE_DEBUG) {
        const stageADescriptions = stageALayers.map((layer, i) => describeLayerForLog(layer, i))
        const stageBDescriptions = stageBLayers.map((layer, i) => describeLayerForLog(layer, trailsSplitIndex + 1 + i))
        const sceneOutputNodeCtor =
          (sceneOutputNode as unknown as { constructor?: { name?: string } })?.constructor?.name ??
          typeof sceneOutputNode
        // True iff stage A's first layer's `input` was, by reference, the
        // scene pass's own output node — i.e. the scene texture is actually
        // wired into stage A's chain, not some stale/other reference.
        const wiredIntoStageA = stageAFirstInputProbe?.node === sceneOutputNode
        const historyDims = historyPairRef.current
          ? `${historyPairRef.current.a.width}x${historyPairRef.current.a.height}`
          : 'none'
        console.debug(
          `[artifice] split pipeline build: stageA=[${stageADescriptions.join(',')}] stageB=[${stageBDescriptions.join(',')}] sceneOutputNode=${sceneOutputNodeCtor}#${objectId(sceneOutputNode as unknown as object)} wiredIntoStageAChain=${wiredIntoStageA} historyPair=${historyDims}`,
        )
      }
    } else {
      // No trails layer, OR trails is the LAST layer — single pipeline,
      // byte-identical to the pre-split behavior.
      const outputNode = buildChainStage(sceneOutputNode, layers, 0, historyTextureNode ?? undefined)

      const pipeline = new THREE.RenderPipeline(renderer as THREE.WebGPURenderer)
      // Alpha flatten (export washed-out fix, 2026-07-31 — see stage B's
      // comment above for the full diagnosis): only when this pipeline
      // renders straight to the CANVAS (non-feedback path). When
      // `needsFeedback` is true it renders into the history RT, whose alpha
      // participates in trails accumulation — that path gets its alpha
      // flattened at the on-screen BLIT instead (see the blit rig below).
      pipeline.outputNode = needsFeedback ? outputNode : vec4(outputNode.rgb, 1)
      // Feedback trails: when `needsFeedback` is true here, trails is the
      // LAST layer — this pipeline's render() is redirected into the
      // offscreen history "write" RT every frame (see the useFrame below),
      // never straight to the canvas. `RenderPipeline.outputColorTransform`
      // defaults to `true`, which BAKES tone mapping + linear→sRGB into the
      // quad's fragment node itself (RenderPipeline.js `_update()`:
      // `renderOutput(outputNode, toneMapping, outputColorSpace)`) —
      // unconditionally, regardless of which render target is bound. That's
      // unlike a plain `renderer.render()` call, which only applies the
      // transform when `renderer.isOutputTarget` is true (i.e. the bound
      // target IS the canvas/null) — RenderPipeline has no such
      // target-awareness. So every write into the history RT re-encodes
      // already-sRGB pixels as if they were linear; iterated gamma drives
      // midtones to 1.0 within a few dozen frames (blacks stay at 0 under any
      // gamma) — the white-oval/saturated-ring/black-corners blowout.
      // Disabling it here makes the pipeline emit LINEAR values into the
      // write RT instead. The on-screen blit (below, in the render loop)
      // still gets the transform applied exactly once — for free, from the
      // renderer's own automatic canvas output pass, since that blit is a
      // plain `texture()` read rendered via `renderer.render()` straight to
      // the canvas (target `null`, so `isOutputTarget` is true there and the
      // renderer applies it itself). The non-feedback path (`pipeline.render()`
      // straight to the screen) is untouched — `outputColorTransform` stays
      // at its default `true` there, which is RenderPipeline's own single
      // application (it also temporarily forces
      // `renderer.toneMapping`/`outputColorSpace` to none/working-space
      // during its own draw specifically to suppress the renderer's
      // automatic canvas pass from double-applying — see RenderPipeline.js
      // `render()`).
      pipeline.outputColorTransform = resolvePipelineOutputColorTransform(needsFeedback)

      pipelines = { mode: 'single', pipeline }
    }

    uniformsRef.current = uniforms
    pipelinesRef.current = pipelines

    return () => {
      // Dispose the RenderPipeline(s)' GPU resources (full-res color+depth
      // pass targets). The previous cleanup only nulled the ref, so every
      // structure change (effect add/remove/reorder/wrap) and every scene
      // close orphaned a full pipeline's render targets for the renderer's
      // lifetime. scenePass owns the pass render targets, so dispose it too
      // in case RenderPipeline.dispose doesn't reach them. Cast defensively —
      // `dispose` isn't present in every three typings version. NOTE: the
      // per-non-final-layer `convertToTexture` intermediate RTs may still
      // leak; disposing those needs a handle the current node graph doesn't
      // expose (see backlog).
      if (pipelines.mode === 'split') {
        ;(pipelines.stageA as unknown as { dispose?: () => void }).dispose?.()
        ;(pipelines.stageB as unknown as { dispose?: () => void }).dispose?.()
      } else {
        ;(pipelines.pipeline as unknown as { dispose?: () => void }).dispose?.()
      }
      ;(scenePass as unknown as { dispose?: () => void }).dispose?.()
      if (scenePassRef.current === scenePass) {
        scenePassRef.current = null
      }
      pipelinesRef.current = null
      uniformsRef.current = new Map()
    }
  }, [renderer, scene, camera, structureKey])

  // Push numeric value changes into existing uniforms — no rebuild.
  useEffect(() => {
    const layers = layersRef.current
    const uniforms = uniformsRef.current
    for (let index = 0; index < layers.length; index++) {
      const args = layers[index].args ?? {}
      for (const [name, value] of Object.entries(args)) {
        const node = uniforms.get(uniformKey(index, name))
        if (!node) {
          continue
        }

        if (typeof value === 'number') {
          node.value = value
          continue
        }

        if (isVec2Arg(value) && node.value instanceof THREE.Vector2) {
          node.value.set(value.x, value.y)
        }
      }
    }
  }, [valueKey])

  // Priority 1 makes R3F hand rendering to us and stop its automatic
  // gl.render(). The pipeline is built in the effect above, which runs *after*
  // the first committed frame and is briefly null again whenever the structure
  // rebuilds (the cleanup nulls the ref). During those gaps neither the pipeline
  // nor R3F renders, leaving the canvas blank ("output not available"). Fall back
  // to a raw scene render so there is always output on screen.
  useFrame(() => {
    const pipelines = pipelinesRef.current
    const historyPair = historyPairRef.current
    const historyTextureNode = historyTextureNodeRef.current

    const fallbackRender = (error: unknown) => {
      // TSL graphs compile lazily on first render, so a bad effect graph throws
      // exactly one frame after takeover — which silently blanks the view. Log
      // the real error once, drop the broken pipeline, and fall back to the raw
      // scene so the preview stays visible instead of disappearing.
      console.error('[artifice] PostProcessing pipeline.render() threw', error)
      pipelinesRef.current = null
      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
    }

    if (pipelines && historyPair && historyTextureNode) {
      // Feedback trails path: `RenderPipeline.render()` has no render-target
      // parameter (it renders wherever is currently bound), so the trails-
      // accumulating stage is always redirected into the history "write" RT
      // instead of the screen — reading and writing the SAME texture in one
      // pass would be undefined — then the result reaches the screen (either
      // via a blit, single-pipeline mode, or stage B, split mode), then swap
      // read/write for next frame (requires `frameloop: "always"` to
      // accumulate — see feedback_trails_effect.ts's JSDoc). Resize/clear
      // bookkeeping below is shared by both pipeline shapes.
      const dpr = renderer.getPixelRatio()
      const w = Math.max(1, Math.round(renderer.domElement.clientWidth * dpr))
      const h = Math.max(1, Math.round(renderer.domElement.clientHeight * dpr))
      if (historyPair.a.width !== w || historyPair.a.height !== h) {
        historyPairRef.current = resetHistoryPair(historyPair, () => new THREE.RenderTarget(w, h))
        pendingHistoryClearRef.current = true
        historyTextureNode.value = historyRead(historyPairRef.current).texture
      }
      const activePair = historyPairRef.current as HistoryPair<THREE.RenderTarget>
      if (pendingHistoryClearRef.current) {
        renderer.setRenderTarget(activePair.a)
        renderer.clear(true, true, true)
        renderer.setRenderTarget(activePair.b)
        renderer.clear(true, true, true)
        pendingHistoryClearRef.current = false
      }

      if (pipelines.mode === 'split') {
        // Two-pipeline shape (a trails layer with more layers after it in
        // this chain): stage A renders L1..Lk (trails inclusive, LINEAR) into
        // the history write RT; stage B reads that FRESHLY-WRITTEN RT and
        // renders Lk+1..Ln to whatever's currently bound (the screen/capture
        // target) exactly once — no accumulation for stage B's layers.
        try {
          const writeRt = historyWrite(activePair)

          // ROOT-CAUSE FIX (split stage A scene content black/empty): prime
          // scenePass's OWN scene render EXPLICITLY, before stage A's
          // composite draw consumes it, instead of relying on it firing
          // implicitly — nested inside `stageA.render()`'s node-graph walk,
          // gated by three r185's per-"true frame" dedup
          // (`NodeFrame.updateBeforeNode`: `nodeUpdateBeforeMap.frameId !==
          // this.frameId`, `node_modules/three/src/nodes/core/NodeFrame.js`
          // lines 147-168). Before the split, ONE `RenderPipeline` covered the
          // whole chain, so that implicit nested trigger was the ONLY thing
          // rendering the scene each tick and had no competing pipeline in the
          // same tick to race against. After the split, `stageA` and `stageB`
          // are two SEPARATE `RenderPipeline`s sharing one renderer and one
          // tick (`RenderPipeline.render()`,
          // `node_modules/three/src/renderers/common/RenderPipeline.js`) —
          // `scenePass.updateBefore()` (`PassNode.updateBefore()`,
          // `node_modules/three/src/nodes/display/PassNode.js`) correctly
          // saves/restores `renderer.getRenderTarget()`/`setRenderTarget()`
          // around its own nested scene render, but that entire mechanism
          // still depends on being reached, at the right moment, purely via
          // node-graph traversal ordering across now-TWO pipeline builds each
          // tick.
          //
          // VERIFIED against three@0.185.1 source (native CEF export stall
          // investigation, 2026-07-31 — see PP_SPLIT_PROBE_DEBUG's docblock
          // above for the stall this investigation was chasing):
          // `PassNode.updateBefore(frame)` (`node_modules/three/src/nodes/
          // display/PassNode.js:780-876`) destructures exactly ONE property
          // off its `frame` argument — `const { renderer } = frame` at line
          // 782 — and nothing else; every other read in that method
          // (`this.scene`, `this.camera`, `this.contextNode`, `this._layers`,
          // `this.overrideMaterial`, …) comes off `this` (the PassNode
          // instance), never off `frame`. So a minimal `{ renderer }` object
          // is not an approximation of a real `NodeFrame` here — it is
          // COMPLETE; there is no `frameId` (or any other field) this method
          // itself reads that a hand-built stand-in could be missing.
          //
          // What a minimal `{ renderer }` object does NOT do, though, is
          // register with the REAL dedup bookkeeping — that lives one layer
          // up, in `NodeFrame.updateBeforeNode()`
          // (`node_modules/three/src/nodes/core/NodeFrame.js:147`), which
          // this call bypasses entirely by invoking `PassNode.updateBefore()`
          // directly. The renderer's actual per-tick `NodeFrame` (`renderer.
          // _nodes.nodeFrame` — `NodeManager` at `node_modules/three/src/
          // renderers/common/nodes/NodeManager.js:59`) has its `frameId`
          // incremented exactly ONCE per real animation-loop tick
          // (`Animation.js:77`, NOT once per `renderer.render()` call — a
          // `RenderPipeline.render()` call is one `renderer.render()` call
          // under the hood, `QuadMesh.render()` →
          // `renderer.render(quad, camera)`). Since our explicit call never
          // touches `nodeUpdateBeforeMap` for `scenePass`'s reference, the
          // LATER implicit trigger (`NodeManager.updateBefore()` →
          // `getNodeFrameForRender().updateBeforeNode(node)`,
          // `NodeManager.js:930-940`, reached when `stageA.render()`'s node
          // graph walk hits `sceneOutputNode`) still sees a frameId mismatch
          // and fires `scenePass.updateBefore()` a SECOND time this tick —
          // contrary to what an earlier version of this comment claimed
          // ("three's own frameId dedup makes the later, automatic invocation
          // a no-op"). That was wrong: it's a harmless-but-wasteful double
          // scene render every split-mode tick, not a no-op. Fixed below by
          // routing through the renderer's REAL `nodeFrame.updateBeforeNode()`
          // when it's reachable — same dedup bookkeeping the implicit path
          // uses, so the later nested call becomes an actual no-op — falling
          // back to the previous direct-call behavior (functionally correct,
          // just double-rendering) if `_nodes`/`nodeFrame` isn't there (private
          // three internals, not covered by any version guarantee).
          if (scenePassRef.current) {
            const realNodeFrame = (
              renderer as unknown as {
                _nodes?: {
                  nodeFrame?: { updateBeforeNode: (node: unknown) => void }
                }
              }
            )._nodes?.nodeFrame
            if (realNodeFrame) {
              realNodeFrame.updateBeforeNode(scenePassRef.current)
            } else {
              scenePassRef.current.updateBefore({ renderer })
            }
          }

          renderer.setRenderTarget(writeRt)
          pipelines.stageA.render()

          // Stage B samples the RT stage A just wrote, not the "read"/
          // last-frame side — repoint (and reapply wrap: unlike every other
          // chain input, this node's `.value` ping-pongs between two
          // distinct Texture objects across frames, so wrap set once at
          // build time would only ever land on whichever side happened to
          // be "write" then) before rendering stage B.
          pipelines.stageBInputTextureNode.value = writeRt.texture
          applyTextureWrap(pipelines.stageBInputTextureNode, pipelines.stageBFirstWrap)

          renderer.setRenderTarget(null)
          pipelines.stageB.render()

          // Runtime instrumentation (see feedbackTickCountRef's docblock
          // above) — once per second while this path is active. Deliberately
          // BEFORE `swapHistoryPair` below (previously after): the probes read
          // `writeRt`/`scenePass.renderTarget` — the sides stage A/scenePass
          // just wrote THIS tick — by direct object reference, so the swap
          // (which only flips `activePair.readIsA`, never reassigns what
          // `writeRt` points to) doesn't change what these reads observe
          // either way; moved regardless so the read is unambiguously
          // "current tick's freshly-written side" at the call site, not
          // "whatever the object reference happens to still point at after a
          // state flip that already happened" — see the module docblock above
          // `uniformKey` for the full probe rationale.
          feedbackTickCountRef.current += 1
          const nowMs = performance.now()
          if (nowMs - feedbackLastDebugLogMsRef.current >= 1000) {
            feedbackLastDebugLogMsRef.current = nowMs
            const feedbackLayerIndex = layersRef.current.findIndex((layer) => layer.effect === feedbackTrailsEffect)
            const decayUniform =
              feedbackLayerIndex >= 0 ? uniformsRef.current.get(uniformKey(feedbackLayerIndex, 'decay')) : undefined
            const mode =
              feedbackLayerIndex >= 0 ? (layersRef.current[feedbackLayerIndex].args?.mode ?? 'max') : 'unknown'
            console.debug(
              `[artifice] pp-pass feedback (split): ticks=${feedbackTickCountRef.current} decay=${decayUniform?.value} mode=${mode} stageAOutputTransform=${pipelines.stageA.outputColorTransform} stageBOutputTransform=${pipelines.stageB.outputColorTransform} historySize=${activePair.a.width}x${activePair.a.height}`,
            )

            // Pixel-evidence probes (see the "runtime pixel-evidence
            // instrumentation" docblock above `uniformKey`) — same
            // once-per-second cadence as the log above. Fire-and-forget:
            // never awaited here, so a slow readback can't stall this or
            // any later frame; each is individually re-entrancy-guarded so
            // a readback still in flight when the next second ticks over
            // is skipped rather than stacked.
            if (PP_SPLIT_PROBE_DEBUG) {
              if (!splitProbeAInFlightRef.current) {
                splitProbeAInFlightRef.current = true
                probeRenderTarget(renderer, writeRt, 'stage A').finally(() => {
                  splitProbeAInFlightRef.current = false
                })
              }
              // Stage B's own canvas probe (createImageBitmap on gl.domElement)
              // used to run here — removed (see PP_SPLIT_PROBE_DEBUG's docblock
              // above): it was the one probe touching the live WebGPU canvas
              // directly rather than an offscreen RenderTarget, and it shipped in
              // the exact build where native CEF exports started stalling after
              // ~1 tick. Stage A + scenePass below still cover the diagnostic
              // need this was added for.
              // Probes scenePass's own internal RT directly — the raw,
              // un-composited scene render, independent of stage A's
              // trails/history math. Diffs against the "stage A" probe above:
              // non-zero here + zero there means the scene rendered fine and
              // the bug is downstream (stage A's composite/writeRt binding);
              // zero in BOTH means the scene itself never rendered.
              if (!splitProbeScenePassInFlightRef.current && scenePassRef.current) {
                splitProbeScenePassInFlightRef.current = true
                probeRenderTarget(renderer, scenePassRef.current.renderTarget, 'scenePass').finally(() => {
                  splitProbeScenePassInFlightRef.current = false
                })
              }
            }
          }

          swapHistoryPair(activePair)
          historyTextureNode.value = historyRead(activePair).texture
        } catch (error) {
          fallbackRender(error)
        }
      } else {
        // Single-pipeline shape (no trails layer, or trails is the LAST
        // layer) — byte-identical to the pre-split behavior: the whole
        // chain is redirected into the history write RT, then blit to the
        // screen so the effect is still visible.
        const pipeline = pipelines.pipeline
        try {
          const writeRt = historyWrite(activePair)
          renderer.setRenderTarget(writeRt)
          pipeline.render()
          renderer.setRenderTarget(null)

          if (!blitRigRef.current) {
            const blitScene = new THREE.Scene()
            const blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
            const blitTextureNode = texture(writeRt.texture)
            const blitMaterial = new THREE.MeshBasicNodeMaterial()
            // Alpha flatten at the canvas write (see stage B's comment above):
            // the history RT's accumulated alpha is feedback state, not
            // display state — present RGB opaque, exactly like the screen's
            // opaque compositing.
            blitMaterial.colorNode = vec4(blitTextureNode.rgb, 1)
            const blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMaterial)
            blitScene.add(blitQuad)
            blitRigRef.current = {
              scene: blitScene,
              camera: blitCamera,
              material: blitMaterial,
              textureNode: blitTextureNode,
            }
          } else {
            blitRigRef.current.textureNode.value = writeRt.texture
          }
          renderer.render(blitRigRef.current.scene, blitRigRef.current.camera)

          swapHistoryPair(activePair)
          historyTextureNode.value = historyRead(activePair).texture

          // Runtime instrumentation (see feedbackTickCountRef's docblock above)
          // — once per second while this path is active, so arg-flow issues
          // (a stale decay uniform, outputColorTransform silently flipped back
          // on by some other code path, a mode string not making it through)
          // are visible at runtime forever after, not just during this fix.
          feedbackTickCountRef.current += 1
          const nowMs = performance.now()
          if (nowMs - feedbackLastDebugLogMsRef.current >= 1000) {
            feedbackLastDebugLogMsRef.current = nowMs
            const feedbackLayerIndex = layersRef.current.findIndex((layer) => layer.effect === feedbackTrailsEffect)
            const decayUniform =
              feedbackLayerIndex >= 0 ? uniformsRef.current.get(uniformKey(feedbackLayerIndex, 'decay')) : undefined
            const mode =
              feedbackLayerIndex >= 0 ? (layersRef.current[feedbackLayerIndex].args?.mode ?? 'max') : 'unknown'
            console.debug(
              `[artifice] pp-pass feedback: ticks=${feedbackTickCountRef.current} decay=${decayUniform?.value} mode=${mode} outputTransform=${pipeline.outputColorTransform} historySize=${activePair.a.width}x${activePair.a.height}`,
            )
          }
        } catch (error) {
          fallbackRender(error)
        }
      }
    } else if (pipelines && pipelines.mode === 'single') {
      // `pipelines.mode` is always "single" here in practice — "split" is
      // only ever built when a trails layer is present, which always
      // allocates `historyPair`/`historyTextureNode` too (see the build
      // effect), so this branch would already have been taken above. Guarded
      // explicitly anyway rather than assumed.
      feedbackTickCountRef.current = 0
      try {
        pipelines.pipeline.render()
      } catch (error) {
        fallbackRender(error)
      }
    } else if (renderer && scene && camera) {
      feedbackTickCountRef.current = 0
      renderer.render(scene, camera)
    }
  }, 1)

  // Final unmount disposal — the structure-rebuild effect's own cleanup
  // intentionally leaves history state alone (it must survive a rebuild), so
  // it needs one more disposal point for when this component unmounts
  // entirely (mirrors pp_chain_renderer.tsx's PPChainPreviewRenderer).
  useEffect(() => {
    return () => {
      if (historyPairRef.current) {
        disposeHistoryPair(historyPairRef.current)
        historyPairRef.current = null
      }
      historyTextureNodeRef.current = null
      blitRigRef.current?.material.dispose()
      blitRigRef.current = null
    }
  }, [])

  return null
}
