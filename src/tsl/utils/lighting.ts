import { float, max, Fn, dot, vec3, normalize, reflect, mix } from 'three/tsl'

/**
 * Returns a fresnel effect based on a given view direction and normal.
 * @param {vec3} viewDir - The view direction vector.
 * @param {vec3} normal - The surface normal vector.
 * @param {number} [p=2] - The fresnel exponent.
 * @returns {float} The fresnel effect value.
 */
export const fresnel = Fn(([viewDir, normal, p = 2]) => {
  const fresnel = float(1)
    .sub(max(0, dot(viewDir, normal)))
    .pow(p)

  return fresnel
})

/**
 * Returns a hemi light based on a given normal and ground and sky colors.
 * @param {vec3} normal - The surface normal vector.
 * @param {vec3} groundColor - The ground color.
 * @param {vec3} skyColor - The sky color.
 * @returns {vec3} The mixed hemi light color.
 */
export const hemi = Fn(([normal, groundColor, skyColor]) => {
  const hemiMix = normal.y.mul(0.5).add(0.5)
  const hemi = mix(groundColor, skyColor, hemiMix)

  return hemi
})

/**
 * Returns a diffuse light based on a given light direction, normal, and color.
 * @param {vec3} lightDir - The light direction vector.
 * @param {vec3} normal - The surface normal vector.
 * @param {vec3} lightColor - The light color.
 * @returns {vec3} The diffuse light color.
 */
export const diffuse = Fn(([lightDir, normal, lightColor]) => {
  const dp = max(0, dot(lightDir, normal))
  const diffuse = dp.mul(lightColor)

  return diffuse
})

/**
 * Returns a phong specular light based on a given view direction, normal, light direction, and light color.
 * @param {vec3} viewDir - The view direction vector.
 * @param {vec3} normal - The surface normal vector.
 * @param {vec3} lightDir - The light direction vector.
 * @param {number} [p=32] - The phong exponent.
 * @returns {vec3} The specular light color.
 */
export const phongSpecular = Fn(([viewDir, normal, lightDir, p = 32]) => {
  const ph = normalize(reflect(lightDir.negate(), normal))
  const phongValue = max(0, dot(viewDir, ph)).pow(p)
  const specular = vec3(phongValue).toVar()

  return specular
})
