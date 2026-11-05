import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useRef } from 'react'
import WebGPUScene from '@/components/canvas/webgpu_scene'
import { WebGPUShader } from '@/components/shader/webgpu_shader'
import { Toolbar } from '@/components/toolbar'
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
          <WebGPUShader colorNode={flare1()} />
        </WebGPUScene>
      </Suspense>

      <Toolbar />
    </section>
  )
}
