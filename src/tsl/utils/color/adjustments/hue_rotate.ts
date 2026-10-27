import { cos, Fn, mat3, sin, vec3 } from 'three/tsl'

/**
 * Rotates hue by an angle (radians) using the standard luma-preserving
 * hue-rotation matrix (the CSS/SVG `hue-rotate` construction).
 * @param {vec3} _color Input color vector
 * @param {float} _angle Rotation in radians; 0 = unchanged
 * @returns {vec3} Adjusted color
 */
export const hueRotate = Fn(([_color, _angle]) => {
  const c = cos(_angle)
  const s = sin(_angle)
  // prettier-ignore
  const m = mat3(
		vec3(0.213, 0.213, 0.213)
			.add(vec3(0.787, -0.213, -0.213).mul(c))
			.add(vec3(-0.213, 0.143, -0.787).mul(s)),
		vec3(0.715, 0.715, 0.715)
			.add(vec3(-0.715, 0.285, -0.715).mul(c))
			.add(vec3(-0.715, 0.14, 0.715).mul(s)),
		vec3(0.072, 0.072, 0.072)
			.add(vec3(-0.072, -0.072, 0.928).mul(c))
			.add(vec3(0.928, -0.283, 0.072).mul(s)),
	)
  return m.mul(_color)
})
