import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { mrt, pass, emissive, output, Fn } from 'three/tsl'
import * as THREE from 'three/webgpu'

export type PostProcessingProps = {
  effect: Fn
  wrap?: 'none' | 'repeat' | 'mirror'
  args?: Record<string, any>
}

export const PostProcessing = ({ effect, wrap = 'none', args = {} }: PostProcessingProps) => {
  const { gl: renderer, scene, camera } = useThree()
  const postProcessingRef = useRef<any>(null)

  useEffect(() => {
    if (!renderer || !scene || !camera) {
      return
    }

    const scenePass = pass(scene, camera)

    scenePass.setMRT(mrt({ output, emissive }))

    // Get texture nodes
    const outputPass = scenePass.getTextureNode('output')

    // Handle texture wrapping
    switch (wrap) {
      case 'none':
        break
      case 'repeat':
        outputPass.value.wrapS = THREE.RepeatWrapping
        outputPass.value.wrapT = THREE.RepeatWrapping
        break
      case 'mirror':
        outputPass.value.wrapS = THREE.MirroredRepeatWrapping
        outputPass.value.wrapT = THREE.MirroredRepeatWrapping
        break
    }

    // Setup post-processing
    const postProcessing = new THREE.PostProcessing(renderer as any)

    const outputNode = effect({ input: outputPass, ...args })
    postProcessing.outputNode = outputNode

    postProcessingRef.current = postProcessing

    return () => {
      postProcessingRef.current = null
    }
  }, [renderer, scene, camera])

  useFrame(() => {
    if (postProcessingRef.current) {
      postProcessingRef.current.render()
    }
  }, 1)

  return null
}
