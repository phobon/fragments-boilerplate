import { Fn, mix, vec4 } from 'three/tsl'

/**
 * Composite a straight-alpha colour over an opaque flat background.
 *
 * The engine treats a shader node's output as the final pixel and doesn't expose a
 * per-material clear colour or scene background, so a "background colour" has to be
 * baked into the output. Feed your material's colour (rgb + coverage in alpha) and a
 * flat background colour; get back an opaque colour with the background showing
 * through wherever the material is transparent.
 *
 * NOTE: author `background` in LINEAR space. Shader output is treated as linear and
 * the engine applies the sRGB view transform, so an sRGB value looks ~3× too bright
 * (e.g. sRGB 0.086 = #16181A → linear ~0.008). Convert before passing it in.
 *
 * @param {vec4} color      Straight-alpha colour (rgb, a); a is coverage 0..1
 * @param {vec3} background Flat background colour, in LINEAR space
 * @returns {vec4} Opaque colour: `background` where a=0, `color.rgb` where a=1
 */
export const overBackground = Fn(([color, background]) => {
  return vec4(mix(background, color.rgb, color.a), 1.0)
})
