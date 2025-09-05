import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useEffect, useRef, useState } from 'react'
import WebGPUScene from '@/components/canvas/webgpu_scene'
import { WebGPUSketch } from '@/components/canvas/webgpu_sketch'

export const Route = createFileRoute('/sketches/$sketchId')({
  component: RouteComponent,
})

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload()
  })
}

function RouteComponent() {
  const { sketchId } = Route.useParams()

  const [module, setModule] = useState<any>({})

  const sketches: Record<string, { default: () => any }> = import.meta.glob('../sketches/*.ts', { eager: true })

  useEffect(() => {
    const mod = sketches[`../sketches/${sketchId}.ts`]
    if (mod) {
      setModule({ colorNode: mod.default })
    } else {
      console.error('Sketch not found:', sketchId)
    }
  }, [sketchId])

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
    </section>
  )
}
