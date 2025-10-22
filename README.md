# Fragments° Boilerplate Project

A companion boilerplate project for [Fragments](https://fragments.supply). This project can be used as a starting point for your own creative coding projects and experiments.

## Tech Stack

Built on the following technology:

- [Vite](https://nextjs.org/)
- [Tanstack Router](https://tanstack.com/router/latest)

- [ThreeJS](https://threejs.org/)
- [React 3 Fiber](https://github.com/pmndrs/react-three-fiber)

- [Drei](https://github.com/pmndrs/drei)
- [Leva](https://github.com/pmndrs/leva)
- [Maath](https://github.com/pmndrs/maath)
- [Zustand](https://github.com/pmndrs/zustand)

## How to run the project

```
pnpm i
pnpm dev
```

## Quick Start

The quickest way to get started is to add a new sketch to the `src/sketches` directory.

This will add a new route to the project that can be accessed at `[localhost]/sketches/[path_to_sketch]`. You can organize sketches in subfolders for better organization:

- `src/sketches/demo.ts` → accessible at `[localhost]/sketches/demo`
- `src/sketches/effects/bloom.ts` → accessible at `[localhost]/sketches/effects/bloom`
- `src/sketches/experiments/noise.ts` → accessible at `[localhost]/sketches/experiments/noise`

### Example sketch structure

The way that this project is set up is that each `sketch` is connected to the `colorNode` of a `MeshBasicNodeMaterial`. See [WebGPUSketch](src/components/canvas/webgpu_sketch.tsx) for more details.

When creating this sketch, make sure that you export the sketch function as the default export:

```tsx
import { Fn, oscSine, time, vec3, length, screenSize, mix } from 'three/tsl'
import { screenAspectUV } from '@/tsl/utils/function'

// Use a `Fn` here to create a node that can be connected to the `colorNode` of a `MeshBasicNodeMaterial`. This node function is invoked, creating a Node.
const sketch = Fn(() => {
  const _uv = screenAspectUV(screenSize)

  const color1 = vec3(oscSine(time.mul(0.25)), _uv.x, _uv.y)
  const color2 = vec3(_uv.x, oscSine(time.mul(0.25)), _uv.y)

  return mix(color1, color2, length(_uv))
})

// This is the important part:
export default sketch
```

## How to use the project (without using the sketches route group)

If you don't want to use the sketches route group, you can use the `index.tsx` file in the `src/routes` directory.

```tsx
import WebGPUScene from '@/components/canvas/webgpu_scene'
import { WebGPUSketch } from '@/components/canvas/webgpu_sketch'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useRef } from 'react'
import { Fn, oscSine, time, uv, vec3 } from 'three/tsl'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const ref = useRef<any>(null)

  const colorNode = Fn(() => vec3(uv(), oscSine(time.mul(0.5))))

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
          <WebGPUSketch colorNode={colorNode()} />
        </WebGPUScene>
      </Suspense>
    </section>
  )
}
```

This will create a new route at `[localhost]` that will render the `colorNode` that you pass to the `WebGPUSketch` component.

You can also pass a `onFrame` callback to the `WebGPUSketch` component to be called on each frame.

```tsx
const onFrame = (material: MeshBasicNodeMaterial, state: RootState) => {
  material.color.set(vec3(uv(), oscSine(time.mul(0.5))))
}
```

## Project Structure

```
src/
├── components/
│   ├── canvas/                          # WebGPU canvas components
│   │   ├── color_space_correction.tsx   # Color space correction utilities
│   │   ├── webgpu_scene.tsx             # Main WebGPU scene wrapper
│   │   └── webgpu_sketch.tsx            # Sketch renderer component
│   ├── debug/                           # Debug utilities
│   │   ├── debug.tsx
│   │   └── index.ts
│   ├── layout/                          # Layout components
│   │   └── main/
│   │       ├── index.ts
│   │       └── main.tsx
│   └── sketches_dropdown/               # UI for sketch selection
│       ├── index.css
│       ├── index.ts
│       ├── sketches_dropdown.tsx
│       └── sketches_list.tsx
├── routes/                              # TanStack Router routes
│   ├── __root.tsx                       # Root layout
│   ├── index.tsx                        # Home page
│   └── sketches.$.tsx                   # Dynamic sketch route
├── sketches/                            # Your creative sketches go here
│   ├── flare-1.ts                       # Example sketch
│   └── nested/                          # Organize in subdirectories
│       └── dawn-1.ts                    # Example nested sketch
├── stores/                              # Zustand state stores
├── tsl/                                 # Three.js Shading Language utilities
│   ├── effects/                         # Visual effects
│   │   ├── canvas_weave_effect.ts
│   │   ├── grain_texture_effect.ts
│   │   ├── led_effect.ts
│   │   ├── pixellation_effect.ts
│   │   ├── speckled_noise_effect.ts
│   │   └── vignette_effect.ts
│   ├── noise/                           # Noise functions
│   │   ├── common.ts
│   │   ├── curl_noise_3d.ts
│   │   ├── curl_noise_4d.ts
│   │   ├── fbm.ts
│   │   ├── perlin_noise_3d.ts
│   │   ├── simplex_noise_3d.ts
│   │   ├── simplex_noise_4d.ts
│   │   └── turbulence.ts
│   ├── post_processing/                 # Post-processing effects
│   │   ├── chromatic_aberration_effect.ts
│   │   ├── crt_scanline_effect.ts
│   │   ├── dither_effect.ts
│   │   ├── grain_texture_effect.ts
│   │   ├── halftone_effect.ts
│   │   ├── led_effect.ts
│   │   ├── pixellation_effect.ts
│   │   ├── post_processing.tsx
│   │   └── vignette_effect.ts
│   └── utils/                           # TSL utility functions
│       ├── color/                       # Color utilities
│       │   ├── cosine_palette.ts
│       │   └── tonemapping.ts
│       ├── function/                    # General TSL functions
│       │   ├── bloom.ts
│       │   ├── bloom_edge_pattern.ts
│       │   ├── domain_index.ts
│       │   ├── median3.ts
│       │   ├── repeating_pattern.ts
│       │   └── screen_aspect_uv.ts
│       ├── lighting.ts                  # Lighting utilities
│       ├── math/                        # Math utilities
│       │   ├── __tests__/
│       │   ├── complex.ts
│       │   └── coordinates.ts
│       └── sdf/                         # Signed distance functions
│           ├── operations.ts
│           └── shapes.ts
├── utils/                               # General utilities
│   ├── cn.ts                            # Class name utilities
│   ├── error_boundary.tsx               # Error boundary component
│   ├── math.ts                          # Math helpers
│   ├── use_isomorphic_layout_effect.ts  # React hook
│   └── wait.ts                          # Async utilities
├── index.css                            # Global styles
├── index.d.ts                           # Type declarations
├── main.tsx                             # App entry point
└── routeTree.gen.ts                     # Generated route tree
```

### Key Directories

- **`src/sketches/`** - Add your creative coding sketches here. Each `.ts` file becomes a route automatically.
- **`src/tsl/`** - Reusable Three.js Shading Language utilities (noise, effects, post-processing, etc.)
- **`src/components/canvas/`** - Core WebGPU rendering components
- **`src/routes/`** - TanStack Router route definitions
