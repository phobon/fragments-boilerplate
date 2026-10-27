import { vec3 } from 'three/tsl'

/** Rec. 709 luma weights — the same constants the tonemappers use. */
export const LUMA = vec3(0.2126, 0.7152, 0.0722)
