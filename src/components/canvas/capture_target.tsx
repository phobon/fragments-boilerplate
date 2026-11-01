import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { WebGPURenderer } from 'three/webgpu'
import { registerCaptureTarget } from '@/utils/capture_snapshot'

/**
 * Registers the current R3F renderer, scene and camera so `captureSnapshot` can render from outside the Canvas.
 */
export const CaptureTarget = () => {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    return registerCaptureTarget({ renderer: gl as unknown as WebGPURenderer, scene, camera })
  }, [gl, scene, camera])

  return null
}
