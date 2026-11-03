import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useEffect, useRef, useState } from 'react'
import WebGPUScene from '@/components/canvas/webgpu_scene'
import { WebGPUSketch } from '@/components/canvas/webgpu_sketch'
import { Toolbar } from '@/components/toolbar'

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

  const [module, setModule] = useState<any>({})

  // Updated glob pattern to include subfolders
  const sketches: Record<string, { default: () => any }> = import.meta.glob('../sketches/**/*.ts', { eager: true })

  useEffect(() => {
    // Convert URL path to file path
    const filePath = `../sketches/${sketchPath}.ts`
    const mod = sketches[filePath]

    if (mod) {
      setModule({ colorNode: mod.default })
    } else {
      console.error('Sketch not found:', sketchPath)
    }
  }, [sketchPath])

  const ref = useRef<any>(null)

  const { colorNode } = module

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
            <WebGPUSketch colorNode={colorNode()} />
          </WebGPUScene>
        ) : null}
      </Suspense>

      <Toolbar />
    </section>
  )
}
