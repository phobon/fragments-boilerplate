import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  atan,
  cos,
  Fn,
  float,
  floor,
  hash,
  If,
  instanceIndex,
  int,
  Loop,
  select,
  sin,
  storage,
  uv,
  vec3,
  vec4,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

// A handful of palettes from the `nice-color-palettes` npm package - swap in your own, or install the package for hundreds more
const colorPalettes = [
  ['#69d2e7', '#a7dbd8', '#e0e4cc', '#f38630', '#fa6900'],
  ['#fe4365', '#fc9d9a', '#f9cdad', '#c8c8a9', '#83af9b'],
  ['#ecd078', '#d95b43', '#c02942', '#542437', '#53777a'],
  ['#556270', '#4ecdc4', '#c7f464', '#ff6b6b', '#c44d58'],
  ['#774f38', '#e08e79', '#f1d4af', '#ece5ce', '#c5e0dc'],
  ['#e8ddcb', '#cdb380', '#036564', '#033649', '#031634'],
  ['#490a3d', '#bd1550', '#e97f02', '#f8ca00', '#8a9b0f'],
  ['#594f4f', '#547980', '#45ada8', '#9de0ad', '#e5fcc2'],
]

export const hexToRgbArray = (hex: string): number[] => {
  const rgb = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  return rgb ? rgb.slice(1).map((n) => parseInt(n, 16) / 255) : null
}

const generateColorPalette = (particlesCount: number) => {
  const allColors = []
  const randomPalette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)]
  let paletteIndex = -1

  for (let i = 0; i < particlesCount; i += 5000) {
    paletteIndex += 1
    if (paletteIndex >= randomPalette.length) {
      paletteIndex = 0
    }

    for (let j = 0; j < 5000; j++) {
      const index = i + j
      if (index < particlesCount) {
        const c = hexToRgbArray(randomPalette[paletteIndex])
        allColors.push(c[0], c[1], c[2])
      }
    }
  }

  return new Float32Array(allColors)
}

export const FlowField = ({
  flowFieldFn,
  colorNodeFn,
  opacityNodeFn,
  rows = 1024,
  columns = 1024,
  depth = 1,
  particlesCount = Math.pow(2, 18),
  particleScale = 0.002,
  particleOpacity = 0.15,
  particleSpeed = 0.01,
  particleLifespan = 1,
  particleDecay = 0.001,
  flowFieldAngles = [1, 1, 0],
  updateFlowField = false,
  params = {},
}: any) => {
  const meshRef = useRef<any>(null)
  const gl = useThree((state) => state.gl) as any
  const { width, height } = useThree((state) => state.size)

  const FLOW_FIELD_SIZE = columns * rows * depth

  const flowFieldBuffer = useMemo(
    () => storage(new THREE.StorageInstancedBufferAttribute(FLOW_FIELD_SIZE, 1), 'float', FLOW_FIELD_SIZE),
    [FLOW_FIELD_SIZE],
  )

  const [computeUpdate, flowFieldUpdate, mesh] = useMemo(() => {
    const flowFieldInitFn = flowFieldFn({
      rows,
      columns,
      depth,
      flowFieldBuffer,
      params,
    }).compute(FLOW_FIELD_SIZE)
    gl.compute(flowFieldInitFn)

    // An `update` instance of the flow field function, run every frame when `updateFlowField` is set
    const flowFieldUpdate = flowFieldFn({
      rows,
      columns,
      depth,
      flowFieldBuffer,
      params,
    }).compute(FLOW_FIELD_SIZE)

    // Particles compute
    const basePositionBuffer = storage(
      new THREE.StorageInstancedBufferAttribute(particlesCount, 4),
      'vec4',
      particlesCount,
    )
    const positionBuffer = storage(new THREE.StorageInstancedBufferAttribute(particlesCount, 4), 'vec4', particlesCount)

    // Assign a color buffer for each of the particles - if we have a colorNodeFn passed in, use that, otherwise use our generateColorPalette function
    const colorArray = colorNodeFn ? new Float32Array(particlesCount * 3) : generateColorPalette(particlesCount)
    const colorBuffer = storage(new THREE.StorageInstancedBufferAttribute(colorArray, 3), 'vec3', particlesCount)

    const scaleBuffer = storage(new THREE.StorageInstancedBufferAttribute(particlesCount, 1), 'float', particlesCount)
    const opacityBuffer = storage(new THREE.StorageInstancedBufferAttribute(particlesCount, 1), 'float', particlesCount)
    const speedBuffer = storage(new THREE.StorageInstancedBufferAttribute(particlesCount, 1), 'float', particlesCount)

    // Halton sequence for better particle distribution
    const halton = Fn(([index, base]) => {
      const result = float(0.0).toVar()
      const f = float(1.0).toVar()
      const i = float(index).toVar()

      Loop({ start: int(0), end: int(10), type: 'int', condition: '<' }, () => {
        const remainder = i.mod(base)
        f.assign(f.div(base))
        result.addAssign(f.mul(remainder))
        i.assign(floor(i.div(base)))
      })

      return result
    })

    // Compute init
    const particlesInitFn = Fn(() => {
      const basePosition = basePositionBuffer.element(instanceIndex)
      const position = positionBuffer.element(instanceIndex)

      // Use Halton sequence for better distribution (0 to 1 range)
      const haltonX = halton(instanceIndex, float(2)).mul(2).sub(1) // Base 2
      const haltonY = halton(instanceIndex, float(3)).mul(2).sub(1) // Base 3
      const haltonZ = halton(instanceIndex, float(5)).mul(2).sub(1) // Base 5

      const p = vec4(
        haltonX,
        haltonY,
        haltonZ,
        hash(instanceIndex.mul(3)).mul(particleLifespan), // Keep hash for lifespan variation
      )
      position.assign(p)
      basePosition.assign(p)

      const scale = scaleBuffer.element(instanceIndex)
      scale.assign(particleScale)

      const opacity = opacityBuffer.element(instanceIndex)
      opacity.assign(particleOpacity)

      const speed = speedBuffer.element(instanceIndex)
      speed.assign(particleSpeed)
    })().compute(particlesCount)
    gl.compute(particlesInitFn)

    const xCellSize = 1 / columns
    const yCellSize = 1 / rows
    const zCellSize = 1 / depth

    // Compute update
    const particlesUpdate = Fn(() => {
      const updatePos = positionBuffer.element(instanceIndex).xyz
      const updateLifespan = positionBuffer.element(instanceIndex).w

      const particleAlive = updateLifespan.greaterThan(0)

      If(particleAlive, () => {
        // Get the normalised position of the particle (between 0 and 1)
        const normalisedParticlePosition = updatePos.add(1).div(2)
        const indexX = floor(normalisedParticlePosition.x.div(xCellSize))
        const indexY = floor(normalisedParticlePosition.y.div(yCellSize))
        const indexZ = floor(normalisedParticlePosition.z.div(zCellSize))

        const flowFieldIndex = indexZ
          .mul(columns * rows)
          .add(indexY.mul(columns))
          .add(indexX)
        const angle = flowFieldBuffer.element(flowFieldIndex)

        // Get the particles new position based on the angle provided
        const speed = speedBuffer.element(instanceIndex).mul(updateLifespan)
        const x = select(flowFieldAngles[0] > 0, cos(angle).mul(speed), 0)
        const y = select(flowFieldAngles[1] > 0, sin(angle).mul(speed), 0)
        const z = select(flowFieldAngles[2] > 0, atan(angle).mul(speed), 0)

        updatePos.addAssign(vec3(x, y, z))
        updateLifespan.subAssign(particleDecay)

        // If a color node is provided, use that - it receives the angle, speed and normalised (0 to 1) position
        if (colorNodeFn) {
          const updateColor = colorBuffer.element(instanceIndex)
          updateColor.assign(colorNodeFn(angle, speed, normalisedParticlePosition))
        }
      }).Else(() => {
        const basePosition = basePositionBuffer.element(instanceIndex)
        updatePos.assign(basePosition.xyz)
        updateLifespan.assign(basePosition.w)
      })
    })().compute(particlesCount)

    // As particles are only 1x1 pixels, we need a SpriteNodeMaterial to render larger particles
    const material = new THREE.SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })

    // Make the positionBuffer available to the shader as the positionNode
    material.positionNode = positionBuffer.toAttribute()
    material.scaleNode = scaleBuffer.toAttribute()
    material.colorNode = colorBuffer.toAttribute()

    // If we have a passed in opacityNode prop, use that, otherwise create a default circle shape
    material.opacityNode = opacityNodeFn
      ? opacityNodeFn(opacityBuffer)
      : Fn(() => {
          const circle = uv().xy.sub(0.7).length().step(0.3)
          return circle.mul(opacityBuffer.toAttribute())
        })()

    // Create an instanced mesh to display the particles, this is required as part of THREE for fallback
    const particlesMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, particlesCount)
    particlesMesh.frustumCulled = false

    return [particlesUpdate, flowFieldUpdate, particlesMesh]
  }, [])

  useFrame(async ({ gl }) => {
    await gl.computeAsync(computeUpdate)

    // Update the flow field alongside our particle update
    if (updateFlowField) {
      await gl.computeAsync(flowFieldUpdate)
    }
  })

  return <primitive object={mesh} scale={[width * 0.5, height * 0.5, 1]} ref={meshRef} />
}
