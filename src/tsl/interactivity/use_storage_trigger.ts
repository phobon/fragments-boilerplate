import { useFrame } from '@react-three/fiber'
import { useRef, useCallback } from 'react'
import { animate } from 'motion'
import type { ShaderBuffer } from './use_storage_buffers'

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring'

export type SpringConfig = {
  stiffness: number
  damping: number
}

export type TriggerOptions = {
  targetValue?: number
  duration?: number
  easing?: EasingType
  springConfig?: SpringConfig
  data?: Record<string, number>
}

type AnimationState = {
  startTime: number
  duration: number
  easing: EasingType
  targetValue: number
}

/**
 * Provides trigger functionality for shader buffers with animation support.
 * Handles finding available slots, running animations, and cleanup.
 *
 * Supports both manual easing functions (linear, easeIn, easeOut, easeInOut) and
 * spring animations via Motion. Each animation occupies a slot in the buffer until completion.
 *
 * @param buffer - The shader buffer to animate
 * @param dataBuffers - Optional additional buffers to store extra data (e.g., position, color)
 * @returns trigger function to start new animations
 *
 * @example
 * ```tsx
 * const buffers = useStorageBuffers(['pulse', 'posX', 'posY'])
 * const trigger = useStorageTrigger(buffers.pulse, {
 *   posX: buffers.posX,
 *   posY: buffers.posY
 * })
 *
 * // Trigger with position data
 * trigger({
 *   targetValue: 0.5,
 *   duration: 1.0,
 *   easing: 'easeOut',
 *   data: { posX: 0.5, posY: 0.3 }
 * })
 * ```
 */
export const useStorageTrigger = (buffer: ShaderBuffer, dataBuffers?: Record<string, ShaderBuffer>) => {
  const animationsRef = useRef<Map<number, AnimationState | ReturnType<typeof animate>>>(new Map())

  // Animation frame loop - updates manual easing animations each frame
  useFrame((state) => {
    if (!buffer) {
      return
    }

    const bufferSize = buffer.activeBuffer.array.length

    for (let i = 0; i < bufferSize; i++) {
      const isActive = buffer.activeBuffer.array[i] === 1

      if (isActive && animationsRef.current.has(i)) {
        const anim = animationsRef.current.get(i)

        // Check if it's a manual animation (has easing property, not a spring)
        if (anim && 'easing' in anim && anim.easing !== 'spring') {
          // Initialize startTime on first frame if not set
          if (anim.startTime === 0) {
            anim.startTime = state.clock.elapsedTime
          }
          const elapsed = state.clock.elapsedTime - anim.startTime
          const progress = Math.min(elapsed / anim.duration, 1)

          // Apply easing function
          let easedProgress = progress
          if (anim.easing === 'easeIn') {
            easedProgress = progress * progress
          } else if (anim.easing === 'easeOut') {
            easedProgress = progress * (2 - progress)
          } else if (anim.easing === 'easeInOut') {
            easedProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress
          }

          buffer.valuesBuffer.array[i] = easedProgress * anim.targetValue
          buffer.valuesBuffer.needsUpdate = true

          // Clean up completed animations
          if (progress >= 1) {
            buffer.activeBuffer.array[i] = 0
            buffer.valuesBuffer.array[i] = 0
            buffer.activeBuffer.needsUpdate = true
            buffer.valuesBuffer.needsUpdate = true
            animationsRef.current.delete(i)
          }
        }
      }
    }
  })

  /**
   * Trigger a new animation in the buffer.
   * Finds the first available slot and starts the animation.
   *
   * @param options - Animation configuration options
   * @param options.targetValue - Target value to animate to (default: 1)
   * @param options.duration - Duration in seconds for non-spring animations (default: 2.5)
   * @param options.easing - Easing function type (default: 'linear')
   * @param options.springConfig - Spring configuration for spring animations
   * @param options.data - Additional data to store in data buffers
   */
  const trigger = useCallback(
    (options: TriggerOptions = {}) => {
      const {
        targetValue = 1,
        duration = 2.5,
        easing = 'linear',
        springConfig = { stiffness: 100, damping: 10 },
        data = {},
      } = options

      // Find first available slot (value === 0 means slot is free)
      const firstZeroIndex = buffer.activeBuffer.array.findIndex((value) => value === 0)
      if (firstZeroIndex === -1) {
        console.warn('Buffer full, cannot trigger new animation')
        return
      }

      // Mark slot as active
      buffer.activeBuffer.array[firstZeroIndex] = 1
      buffer.activeBuffer.needsUpdate = true

      // Store additional data in data buffers
      if (dataBuffers) {
        Object.entries(data).forEach(([key, value]) => {
          if (dataBuffers[key]) {
            dataBuffers[key].valuesBuffer.array[firstZeroIndex] = value
            dataBuffers[key].valuesBuffer.needsUpdate = true
          }
        })
      }

      if (easing === 'spring') {
        // Use Motion for spring animations
        const anim = animate(0, targetValue, {
          type: 'spring',
          stiffness: springConfig.stiffness,
          damping: springConfig.damping,
          onUpdate: (v) => {
            buffer.valuesBuffer.array[firstZeroIndex] = v
            buffer.valuesBuffer.needsUpdate = true
          },
          onComplete: () => {
            buffer.activeBuffer.array[firstZeroIndex] = 0
            buffer.valuesBuffer.array[firstZeroIndex] = 0
            buffer.activeBuffer.needsUpdate = true
            buffer.valuesBuffer.needsUpdate = true
            animationsRef.current.delete(firstZeroIndex)
          },
        })
        animationsRef.current.set(firstZeroIndex, anim)
      } else {
        // Manual easing for linear/easeIn/easeOut/easeInOut
        // Start time will be set in useFrame using state.clock.elapsedTime
        animationsRef.current.set(firstZeroIndex, {
          startTime: 0, // Will be set in useFrame
          duration,
          easing,
          targetValue,
        })
      }
    },
    [buffer, dataBuffers],
  )

  return trigger
}

