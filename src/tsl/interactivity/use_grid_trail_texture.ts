'use client'

import { clamp } from '@/utils/math'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'

/**
 * Options controlling the procedural trail texture.
 *
 * - `grid`: Square resolution (N => N² texels). Higher = sharper, slower.
 * - `radius`: Brush size as a fraction of the grid.
 * - `strength`: Base contribution per frame.
 * - `decay`: Per-frame fade multiplier in [0, 1].
 * - `influenceGain`: Extra scalar applied after the force curve.
 * - `influenceGamma`: Non-linear response applied to velocity magnitude.
 */
export type UseGridTrailTextureProps = {
  grid?: number
  radius?: number
  strength?: number
  decay?: number
  influenceGain?: number
  influenceGamma?: number
}

/**
 * Produces a float RGBA `DataTexture` that accumulates pointer velocity over time.
 *
 * - `.r`: horizontal influence (inverted)
 * - `.g`: vertical influence
 * - `.b`: velocity magnitude
 * - `.a`: unused
 *
 * Returns a `THREE.DataTexture | null`; sample with `texture(uniform(dataTexture), uv)`.
 */
export const useGridTrailTexture = (options?: UseGridTrailTextureProps): THREE.DataTexture | null => {
  const {
    grid = 50,
    radius = 0.05,
    strength = 0.06,
    decay = 0.75,
    influenceGain = 1.0,
    influenceGamma = 1.0,
  } = options || {}
  const dataTextureRef = useRef<THREE.DataTexture | undefined>(undefined)
  const [dataTexture, setDataTexture] = useState<THREE.DataTexture | null>(null)

  const pointerVelocityRef = useRef({ x: 0, y: 0 })
  const pointerRef = useRef({ x: 0, y: 0 })
  const rawPointerRef = useRef<{ x: number; y: number } | null>(null)
  const canvasBoundsRef = useRef<DOMRect | null>(null)

  // Effective grid resolution (N x N)
  const size = grid
  const width = size
  const height = size
  const dimensions = width * height

  const { gl } = useThree()

  useEffect(() => {
    // Regenerate the texture when dimensions change; keep resolution fixed.
    const regenerateGrid = () => {
      // Allocate a zeroed RGBA float texture. R/G accumulate direction; B stores speed.
      const data = new Float32Array(4 * dimensions)
      for (let stride = 0; stride < dimensions; stride++) {
        const index = stride * 4
        data[index] = 0
        data[index + 1] = 0
        data[index + 2] = 0
        data[index + 3] = 0
      }
      const dataTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
      dataTexture.minFilter = dataTexture.magFilter = THREE.NearestFilter
      // Default unpack alignment (4) works for RGBA floats.
      dataTexture.needsUpdate = true
      dataTextureRef.current = dataTexture
      setDataTexture(dataTexture)
    }

    const updateCanvasBounds = () => {
      const canvas = gl.domElement
      if (canvas) {
        canvasBoundsRef.current = canvas.getBoundingClientRect()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      let bounds = canvasBoundsRef.current
      if (!bounds) {
        updateCanvasBounds()
        bounds = canvasBoundsRef.current
        if (!bounds) {
          throw new Error('Canvas bounds not found')
        }
      }

      const x = (event.clientX - bounds.left) / bounds.width
      const y = (event.clientY - bounds.top) / bounds.height

      // Normalize to [0, 2] range for easier grid translation
      const ndcX = clamp(x * 2, 0, 2)
      const ndcY = clamp(y * 2, 0, 2)

      rawPointerRef.current = { x: ndcX, y: ndcY }
    }

    const handlePointerLeave = () => {
      rawPointerRef.current = null
      pointerVelocityRef.current.x = 0
      pointerVelocityRef.current.y = 0
    }

    const resetVelocity = () => {
      pointerVelocityRef.current.x = 0
      pointerVelocityRef.current.y = 0
    }

    updateCanvasBounds()
    regenerateGrid()

    const canvas = gl.domElement
    if (canvas) {
      canvas.addEventListener('pointermove', handlePointerMove)
      canvas.addEventListener('pointerleave', handlePointerLeave)
      canvas.addEventListener('pointerup', resetVelocity)
    }

    window.addEventListener('resize', updateCanvasBounds)
    window.addEventListener('scroll', updateCanvasBounds, { passive: true })
    window.addEventListener('blur', resetVelocity)

    return () => {
      if (canvas) {
        canvas.removeEventListener('pointermove', handlePointerMove)
        canvas.removeEventListener('pointerleave', handlePointerLeave)
        canvas.removeEventListener('pointerup', resetVelocity)
      }
      window.removeEventListener('resize', updateCanvasBounds)
      window.removeEventListener('scroll', updateCanvasBounds)
      window.removeEventListener('blur', resetVelocity)
    }
  }, [dimensions, height, width, gl])

  // Per-frame CPU update that decays existing values and deposits new energy.
  useFrame(() => {
    const dt = dataTextureRef.current
    if (!dt) {
      return
    }

    // Use accurate pointer position from DOM events, or fallback to center if not available
    const rawPointer = rawPointerRef.current
    if (!rawPointer) {
      // No pointer data available, decay existing values only
      const data = dt.image.data as Float32Array
      for (let i = 0; i < data.length; i += 4) {
        data[i] *= decay
        data[i + 1] *= decay
        data[i + 2] *= decay
      }
      dt.needsUpdate = true
      return
    }

    const pointerNormX = rawPointer.x
    const pointerNormY = rawPointer.y

    const prevPointerX = pointerRef.current.x
    const prevPointerY = pointerRef.current.y

    pointerVelocityRef.current.x = pointerNormX - prevPointerX
    pointerVelocityRef.current.y = pointerNormY - prevPointerY

    pointerRef.current.x = pointerNormX
    pointerRef.current.y = pointerNormY
    const data = dt.image.data as Float32Array

    // Map pointer into grid coordinates.
    const mouseRadius = size * radius
    const cellX = pointerRef.current.x * 0.5 * size - mouseRadius * 0.5
    const cellY = (2 - pointerRef.current.y) * 0.5 * size + mouseRadius * 0.5

    // Decay existing values (RGB channels only).
    for (let i = 0; i < data.length; i += 4) {
      data[i] *= decay
      data[i + 1] *= decay
      data[i + 2] *= decay
    }

    // Apply influence using a 1 / dist falloff, clamped near the center.
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) {
        const cellCenterX = x + 0.5
        const cellCenterY = y + 0.5
        const dist = (cellX - cellCenterX) ** 2 + (cellY - cellCenterY) ** 2
        const distMax = mouseRadius ** 2
        if (dist < distMax && dist > 0) {
          const dataIndex = 4 * (x + size * y)
          let force = mouseRadius / Math.sqrt(dist)
          force = clamp(force, 0, 10)

          // Convert pointer velocity (pixels) into grid-space velocity with per-axis scale
          const vxGrid = pointerVelocityRef.current.x * (size / 2)
          const vyGrid = -pointerVelocityRef.current.y * (size / 2)
          const speedGrid = Math.hypot(vxGrid, vyGrid)

          // Shape the response with gamma, then scale with gain*strength
          const vxCurved = Math.sign(vxGrid) * Math.pow(Math.abs(vxGrid), influenceGamma)
          const vyCurved = Math.sign(vyGrid) * Math.pow(Math.abs(vyGrid), influenceGamma)
          const speedCurved = Math.pow(speedGrid, influenceGamma)

          // Encode displacement direction scaled by magnitude (shader applies its own gain)
          const scale = influenceGain * strength * force
          const dispBase = scale * speedCurved
          const len = Math.hypot(vxCurved, vyCurved) || 1
          const ndx = vxCurved / len
          const ndy = vyCurved / len

          // Invert horizontal displacement so consumer shaders don't need to
          data[dataIndex] += dispBase * -ndx // R: direction X (scaled, inverted)
          data[dataIndex + 1] += dispBase * ndy // G: direction Y (scaled)
          data[dataIndex + 2] += scale * speedCurved // B channel = speed magnitude
        }
      }

    dt.needsUpdate = true

    // Decay pointer velocity symmetrically and zero-out near 0 to stop tail injection
    pointerVelocityRef.current.x *= decay
    pointerVelocityRef.current.y *= decay
    const EPS = 1e-3
    if (Math.abs(pointerVelocityRef.current.x) < EPS) {
      pointerVelocityRef.current.x = 0
    }
    if (Math.abs(pointerVelocityRef.current.y) < EPS) {
      pointerVelocityRef.current.y = 0
    }
  })

  return dataTexture
}
