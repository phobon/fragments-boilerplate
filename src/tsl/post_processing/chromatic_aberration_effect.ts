// @ts-nocheck — vendored TSL; its type defs do not match the app-pinned three@0.186 (many errors under its own tsconfig too). App code IS typechecked; these files are skipped. See backlog Tier 2 "tsc -b".
import { Fn, float, length, max, pow, uv, vec2, vec4 } from 'three/tsl'

/**
 * Radial (lens-style) chromatic aberration.
 *
 * RGB channels are progressively offset along the radial direction from a focal
 * `center`: the image stays sharp at `center` and the colour separation grows
 * toward the edges. Every parameter maps to an obvious on-canvas control —
 * `center` is a draggable focal point, `strength` a magnitude ring.
 *
 * @param {Object} props - Effect parameters
 * @param {vec4} props.input - The input color texture from the scene
 * @param {vec2} [props.inputUV] - Optional UV coordinates (defaults to built-in uv)
 * @param {number} [props.strength=0.5] - Overall separation amount (0 = none, 1 = strong)
 * @param {vec2} [props.center=vec2(0.5, 0.5)] - Focal point where aberration is zero
 * @param {number} [props.falloff=2.0] - Edge ramp exponent (higher = more edge-concentrated)
 * @returns {vec4} The chromatic aberration processed color
 */
export const chromaticAberrationEffect = Fn((props) => {
  const { input, inputUV = uv, strength = 0.5, center = vec2(0.5, 0.5), falloff = 2.0 } = props || {}

  const _uv = inputUV().toVar()
  const _strength = float(strength)
  const _falloff = float(falloff)

  const toCenter = _uv.sub(center).toVar()
  const dist = length(toCenter).toVar()

  // Safe radial direction — zero-length only at the focal point, where the
  // aberration magnitude (below) is also zero.
  const radialDir = toCenter.div(max(dist, float(1e-5))).toVar()

  // Separation grows from 0 at the focal point toward the edges. pow(dist,
  // falloff) lets the artist control how edge-concentrated it is; falloff=2
  // reproduces a natural quadratic ramp. The 0.15 keeps strength≈1 strong but
  // usable (a few-percent UV shift at the corners).
  const aberration = _strength.mul(float(0.15)).mul(pow(dist, _falloff)).toVar()
  const channelOffset = radialDir.mul(aberration).toVar()

  const rSample = input.sample(_uv.add(channelOffset))
  const gSample = input.sample(_uv)
  const bSample = input.sample(_uv.sub(channelOffset))

  return vec4(rSample.r, gSample.g, bSample.b, gSample.a)
})
