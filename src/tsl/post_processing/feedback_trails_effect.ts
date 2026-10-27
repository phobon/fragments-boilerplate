// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { clamp, Fn, max, uv, vec4 } from 'three/tsl'

/**
 * Feedback trails: accumulates a decayed copy of last frame's composite
 * ("history") into this frame's input, fusing successive frames into a
 * persistent, fading trail (docs/plan/feedback-trails-bloom-pp.md, Brief B).
 *
 * `historyTexture` is NOT a user-facing arg (no dial) — it's the one
 * non-scalar prop the *engine* injects, exactly like `asciiTexture` on
 * `asciiEffect`. The engine also owns a ping-pong pair of render targets and
 * swaps which one backs `historyTexture` once per frame (see
 * `feedback_history_ping_pong.ts`, `pp_chain_renderer.tsx`,
 * `fragments-functions/tsl/post_processing/post_processing.tsx`) — this
 * effect itself is stateless, a pure function of whatever texture it's
 * handed.
 *
 * Degrades gracefully when `historyTexture` is absent (Phase 1 scope: export
 * capture / sandbox export do not inject it) — a chain containing this effect
 * must never break on that path, it just becomes a passthrough.
 *
 * Requires a render loop that actually runs every frame (`frameloop:
 * "always"`) to accumulate — a paused/on-demand loop never advances history.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {Texture} [props.historyTexture] - Engine-injected history buffer texture node; omitted → passthrough
 * @param {number} [props.decay=0.96] - Per-frame history decay multiplier (0 = no feedback/trail, closer to 1 = slower fade)
 * @param {string} [props.mode="max"] - How history combines with the current frame: `"max"` (bright-pixel persistence) or `"add"` (additive accumulation, clamped to avoid blowing out)
 * @returns {vec4} The current frame's color fused with its decayed history
 */
export const feedbackTrailsEffect = Fn((props) => {
  const { input, inputUV = uv, historyTexture, decay = 0.96, mode = 'max' } = props || {}

  const _uv = inputUV().toVar()
  const cur = input.sample(_uv)

  if (!historyTexture) {
    // No history injected (e.g. export/sandbox path) — pure passthrough.
    return cur
  }

  const prev = historyTexture.sample(_uv).rgb.mul(decay)
  const combined = mode === 'add' ? clamp(cur.rgb.add(prev), 0, 1) : max(prev, cur.rgb)

  return vec4(combined, cur.a)
})
