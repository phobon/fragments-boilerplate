import WebGPUScene from '@/components/canvas/webgpu_scene'
import { WebGPUSketch } from '@/components/canvas/webgpu_sketch'
import { Toolbar } from '@/components/toolbar'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useRef } from 'react'
import flare1 from '@/sketches/flare-1'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const ref = useRef<any>(null)

  return (
    <section className='fragments-boilerplate__main__canvas' ref={ref}>
      <Suspense fallback={null}>
        <WebGPUScene
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
          }}
          eventSource={ref}
          eventPrefix='client'
        >
          <WebGPUSketch colorNode={flare1()} />
        </WebGPUScene>
      </Suspense>

      <Toolbar />
    </section>
  )
}
