import { createFileRoute } from '@tanstack/react-router'
import { type ComponentType, Suspense, useEffect, useRef, useState } from 'react'
import WebGPUScene from '@/components/canvas/webgpu_scene'
import { WebGPUShader } from '@/components/shader/webgpu_shader'
import { Toolbar } from '@/components/toolbar'
import { PostProcessing, type PostProcessingProps } from '@/tsl/post_processing/post_processing'

type SketchModule = {
  default: (() => any) | ComponentType
  postProcessing?: PostProcessingProps
}

export const Route = createFileRoute('/sketches/$')({
  component: RouteComponent,
})

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload()
  })
}

function RouteComponent() {
  const { _splat: sketchPath } = Route.useParams()

  const [module, setModule] = useState<{
    colorNode?: () => any
    Component?: ComponentType
    postProcessing?: PostProcessingProps
  }>({})

  // `.ts` sketches export a TSL Fn (the colorNode). `.tsx` sketches export a React component that renders inside the
  // scene, so they can use hooks like useFrame, pointer events and the interactivity utilities.
  const sketches: Record<string, SketchModule> = import.meta.glob('../sketches/**/*.{ts,tsx}', { eager: true })

  useEffect(() => {
    // Convert URL path to file path
    const nodeModule = sketches[`../sketches/${sketchPath}.ts`]
    const componentModule = sketches[`../sketches/${sketchPath}.tsx`]

    if (componentModule) {
      setModule({ Component: componentModule.default as ComponentType, postProcessing: componentModule.postProcessing })
    } else if (nodeModule) {
      setModule({ colorNode: nodeModule.default as () => any, postProcessing: nodeModule.postProcessing })
    } else {
      console.error('Sketch not found:', sketchPath)
    }
  }, [sketchPath])

  const ref = useRef<any>(null)

  const { colorNode, Component, postProcessing } = module

  return (
    <section className='fragments-boilerplate__main__canvas' ref={ref}>
      <Suspense fallback={null}>
        {colorNode || Component ? (
          <WebGPUScene
            style={{
              position: 'fixed',
              inset: 0,
              // Component sketches can listen to pointer events on the canvas itself (eg: useGridTrailTexture)
              pointerEvents: Component ? 'auto' : 'none',
            }}
            eventSource={ref}
            eventPrefix='client'
          >
            {Component ? <Component /> : <WebGPUShader colorNode={colorNode()} />}
            {postProcessing ? <PostProcessing {...postProcessing} /> : null}
          </WebGPUScene>
        ) : null}
      </Suspense>

      <Toolbar />
    </section>
  )
}
