'use client'

import { clamp } from '@/utils/math'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { uniform } from 'three/tsl'
import type { UniformNode } from 'three/webgpu'
import * as THREE from 'three/webgpu'

/**
 * Mirrors the current pointer position into a TSL uniform, expressed in [-1, 1] NDC space.
 *
 * @example
 * ```tsx
 * const pointerUniform = usePointerUniform()
 *
 * const node = Fn(() => {
 *   const uv = screenAspectUV(screenSize)
 *   const dist = length(uv.sub(pointerUniform))
 *   return vec3(dist)
 * })
 * ```
 */
export const usePointerUniform = (initial?: { x: number; y: number }) => {
  const init = initial ?? { x: 0, y: 0 }
  const pointerUniform = useMemo(() => {
    return uniform(new THREE.Vector2(init.x, init.y)) as UniformNode<THREE.Vector2>
  }, [init.x, init.y])

  useFrame(({ pointer }) => {
    pointerUniform.value.set(pointer.x, pointer.y)
  })

  return pointerUniform
}

/**
 * Vanilla helper that keeps a pointer uniform in NDC sync using DOM events.
 */
export const createPointerUniform = (options?: { initial?: { x: number; y: number }; element?: Element | null }) => {
  const init = options?.initial ?? { x: 0, y: 0 }
  const element = options?.element ?? null
  const pointer = new THREE.Vector2(init.x, init.y)
  const pointerUniform = uniform(pointer.clone()) as UniformNode<THREE.Vector2>

  const updateFromZeroOne = (x: number, y: number) => {
    const ndcX = clamp(-1, x * 2 - 1, 1)
    const ndcY = clamp(-1, y * 2 - 1, 1)
    pointer.set(ndcX, ndcY)
    pointerUniform.value.copy(pointer)
  }

  const handlePointerMove = (event: PointerEvent | MouseEvent) => {
    const target = (event.currentTarget as Element | null) ?? element
    const bounds = target?.getBoundingClientRect()
    const width = bounds?.width ?? window.innerWidth
    const height = bounds?.height ?? window.innerHeight
    const left = bounds?.left ?? 0
    const top = bounds?.top ?? 0

    const x = (event.clientX - left) / width
    const y = 1 - (event.clientY - top) / height

    updateFromZeroOne(x, y)
  }

  return {
    pointerUniform,
    pointer,
    handlePointerMove,
    updateFromZeroOne,
  }
}
