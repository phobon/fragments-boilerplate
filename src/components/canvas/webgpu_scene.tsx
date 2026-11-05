import { AdaptiveDpr, OrthographicCamera, Preload, StatsGl } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useInView } from 'motion/react'
import { useRef } from 'react'
import { WebGPURenderer } from 'three/webgpu'
import { CaptureTarget } from './capture_target'
import { ColorSpaceCorrection } from './color_space_correction'

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
 * @param {string} [props.id='__webgpucanvas'] - Canvas element id
 * @param {boolean} [props.debug=false] - Show the three.js Inspector and stats overlay
 * @param {'always'|'demand'|'never'} [props.frameloop='always'] - Canvas render loop mode
 * @param {React.ReactNode} props.children - Scene children
 * @returns {JSX.Element}
 *
 * Notes:
 * - Uses WebGPURenderer (three.js) for next-gen rendering
 * - Handles color space and tone mapping for WebGPU
 * - Pauses the render loop when the canvas is out of view
 * - Preloads assets and adapts DPR
 */
const WebGPUScene = ({
  id = '__webgpucanvas',
  debug = false,
  frameloop = 'always',
  children,
  ...props
}: SceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isInView = useInView(canvasRef, { margin: '50px' })
  const canvasFrameloop = isInView ? frameloop : 'never'

  return (
    <Canvas
      id={id}
      {...props}
      frameloop={canvasFrameloop}
      dpr={isInView ? undefined : 1}
      gl={async (props) => {
        const renderer = new WebGPURenderer(props as any)
        if (debug) {
          const { Inspector } = await import('three/examples/jsm/inspector/Inspector.js')
          renderer.inspector = new Inspector()
        }
        await renderer.init()
        return renderer
      }}
      ref={canvasRef}
    >
      <Preload all />

      <AdaptiveDpr pixelated />

      {/* Default camera - rendered before the sketch so a sketch can provide its own `makeDefault` camera (eg: a PerspectiveCamera) */}
      <OrthographicCamera makeDefault position={[0, 0, 10]} />

      {children}

      <ColorSpaceCorrection />

      <CaptureTarget />
    </Canvas>
  )
}

export default WebGPUScene
