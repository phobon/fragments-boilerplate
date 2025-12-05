import { storage } from 'three/tsl'
import { useMemo } from 'react'
import * as THREE from 'three/webgpu'
import type { StorageBufferNode } from 'three/webgpu'

export type ShaderBuffer = {
  active: StorageBufferNode
  values: StorageBufferNode
  activeBuffer: THREE.StorageInstancedBufferAttribute
  valuesBuffer: THREE.StorageInstancedBufferAttribute
}

export type ShaderBuffers<T extends string> = Record<T, ShaderBuffer>

/**
 * Creates storage buffers for use in shaders.
 * Each buffer has an 'active' array (tracks which slots are in use) and a 'values' array (stores animation values).
 *
 * @param keys - Array of buffer names to create
 * @param size - Size of each buffer (default: 100)
 * @returns Object mapping buffer names to their storage buffers
 *
 * @example
 * ```tsx
 * const buffers = useStorageBuffers(['pulse', 'fade'], 50)
 * // Use in shader: buffers.pulse.values.element(idx)
 * ```
 */
export const useStorageBuffers = <T extends string>(keys: T[], size: number = 100): ShaderBuffers<T> => {
  return useMemo(() => {
    const buffers = {} as ShaderBuffers<T>

    for (const key of keys) {
      const activeBuffer = new THREE.StorageInstancedBufferAttribute(size, 1)
      const valuesBuffer = new THREE.StorageInstancedBufferAttribute(size, 1)

      buffers[key] = {
        active: storage(activeBuffer, 'float', size),
        values: storage(valuesBuffer, 'float', size),
        activeBuffer,
        valuesBuffer,
      }
    }

    return buffers
  }, [keys, size])
}

