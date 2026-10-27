// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { uniform, vec2 } from 'three/tsl'

/**
 * Shared, app-wide pointer uniform in UV space (0..1) — the pointer analogue of
 * three/tsl's `time`, but living here so the import source is honest
 * (`three/tsl` genuinely has no `pointer`).
 *
 * WHY the globalThis bridge: the shader compiler INLINES each `@/fragments`
 * module SEPARATELY into every node, so a plain module-level `uniform(...)`
 * would mint a fresh instance per node — and the pointer feed could only ever
 * move one of them (this is the bug where a PP node's own preview stayed static
 * while the final output moved). Stashing the instance on `globalThis` bridges
 * every inlined copy AND the host app's own import to ONE shared uniform, so
 * `pointer` is the SAME node wherever it's used — in a shader or a PP effect,
 * up or down the chain — and the app's pointer feed writes the single value
 * that every preview reads.
 *
 * Usage (in any shader / PP node, or app code):
 *   import { pointer } from "@/fragments/tsl/interactivity/scene_pointer"
 *   // `pointer` is a vec2 uniform in UV space; use it anywhere a position is wanted,
 *   // e.g. `lensDistortionEffect({ ...ppArgs, center: pointer })`
 */
const POINTER_KEY = '__artificeScenePointer__'

export const pointer = globalThis[POINTER_KEY] ?? (globalThis[POINTER_KEY] = uniform(vec2(0.5, 0.5)))
