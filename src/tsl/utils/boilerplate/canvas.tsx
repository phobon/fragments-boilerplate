import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { LinearSRGBColorSpace, NoToneMapping, WebGPURenderer } from 'three/webgpu'
import { AdaptiveDpr, Preload, StatsGl } from '@react-three/drei'

import { PerspectiveCamera } from '@/utils/perspective_camera'

type SceneProps = {
  debug?: boolean
  frameloop?: 'always' | 'demand' | 'never'
} & any

/**
 * WebGPUScene
 *
 * Renders a three.js scene using the WebGPURenderer inside a @react-three/fiber Canvas.
 *
 * @param {SceneProps} props - Scene configuration props
 * @param {boolean} [props.debug=false] - Show WebGL stats overlay
 * @param {'always'|'demand'|'never'} [props.frameloop='always'] - Canvas render loop mode
 * @param {boolean} [props.orthographic=false] - Use orthographic camera (not currently used)
 * @param {React.ReactNode} props.children - Scene children
 * @returns {JSX.Element}
 *
 * Notes:
 * - Uses WebGPURenderer (three.js) for next-gen rendering
 * - Handles color space and tone mapping for WebGPU
 * - Preloads assets and adapts DPR
 */
export const WebGPUScene = ({
  debug = false,
  frameloop = 'always',
  orthographic = false,
  children,
  ...props
}: SceneProps) => {
  const [canvasFrameloop, setCanvasFrameloop] = useState<'always' | 'demand' | 'never'>('never')

  return (
    <Canvas
      id='__webgpucanvas'
      // TODO: flat and linear together breaks webgpu renderer
      // flat // Uses NoToneMapping as opposed to ACESFilmicToneMapping
      // linear // Disables automatic sRGB color space and gamma correction
      {...props}
      frameloop={canvasFrameloop}
      gl={async (props) => {
        const renderer = new WebGPURenderer(props as any)

        await renderer.init()
        setCanvasFrameloop(frameloop)

        return renderer
      }}
    >
      <Preload all />

      <AdaptiveDpr />

      {children}

      <ColorSpaceCorrection />

      {debug ? <StatsGl className='fragments-supply__statsgl' /> : null}

      <PerspectiveCamera makeDefault />
    </Canvas>
  )
}

/**
 * ColorSpaceCorrection
 *
 * Sets the renderer's outputColorSpace to LinearSRGBColorSpace and disables tone mapping.
 * Ensures correct color output for WebGPU rendering.
 *
 * @returns {null}
 */
export const ColorSpaceCorrection = () => {
  const { set } = useThree((state) => state)

  useEffect(() => {
    set((state) => {
      const _state = { ...state }
      _state.gl.outputColorSpace = LinearSRGBColorSpace
      _state.gl.toneMapping = NoToneMapping
      return _state
    })
  }, [])

  return null
}
