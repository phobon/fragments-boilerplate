import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useEffect, useRef, useState } from 'react'
import WebGPUScene from '@/components/canvas/webgpu_scene'
import { WebGPUShader } from '@/components/shader/webgpu_shader'
import { Toolbar } from '@/components/toolbar'
import { PostProcessing, type PostProcessingProps } from '@/tsl/post_processing/post_processing'

type SketchModule = {
  default: () => any
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

  const [module, setModule] = useState<{ colorNode?: () => any; postProcessing?: PostProcessingProps }>({})

  // Updated glob pattern to include subfolders
  const sketches: Record<string, SketchModule> = import.meta.glob('../sketches/**/*.ts', { eager: true })

  useEffect(() => {
    // Convert URL path to file path
    const filePath = `../sketches/${sketchPath}.ts`
    const mod = sketches[filePath]

    if (mod) {
      setModule({ colorNode: mod.default, postProcessing: mod.postProcessing })
    } else {
      console.error('Sketch not found:', sketchPath)
    }
  }, [sketchPath])

  const ref = useRef<any>(null)

  const { colorNode, postProcessing } = module

  return (
    <section className='fragments-boilerplate__main__canvas' ref={ref}>
      <Suspense fallback={null}>
        {colorNode ? (
          <WebGPUScene
            style={{
              position: 'fixed',
              inset: 0,
              pointerEvents: 'none',
            }}
            eventSource={ref}
            eventPrefix='client'
          >
            <WebGPUShader colorNode={colorNode()} />
            {postProcessing ? <PostProcessing {...postProcessing} /> : null}
          </WebGPUScene>
        ) : null}
      </Suspense>

      <Toolbar />
    </section>
  )
}
