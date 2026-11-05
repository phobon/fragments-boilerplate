import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  attribute,
  dot,
  Fn,
  float,
  floor,
  fract,
  hash,
  If,
  instanceIndex,
  mix,
  select,
  sin,
  storage,
  time,
  vec3,
  vec4,
} from 'three/tsl'
import * as THREE from 'three/webgpu'
import { MeshStandardNodeMaterial } from 'three/webgpu'

// Curl-noise helpers, from the snippets above
const hash33 = (p) => {
  const q = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))
  return fract(sin(q).mul(43758.5453)).mul(2).sub(1)
}

const gnoise = (p) => {
  const i = floor(p)
  const f = fract(p)
  const u = f.mul(f).mul(f.mul(-2).add(3)) // smoothstep weights
  const g = (ox, oy, oz) => {
    const o = vec3(ox, oy, oz)
    return dot(hash33(i.add(o)), f.sub(o))
  }
  const c000 = g(0, 0, 0),
    c100 = g(1, 0, 0),
    c010 = g(0, 1, 0),
    c110 = g(1, 1, 0)
  const c001 = g(0, 0, 1),
    c101 = g(1, 0, 1),
    c011 = g(0, 1, 1),
    c111 = g(1, 1, 1)
  const x00 = mix(c000, c100, u.x),
    x10 = mix(c010, c110, u.x)
  const x01 = mix(c001, c101, u.x),
    x11 = mix(c011, c111, u.x)
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z)
}

// curl of a decorrelated vector potential -> smooth, divergence-free streams
const curl = (p) => {
  const e = 0.15
  const dx = vec3(e, 0, 0),
    dy = vec3(0, e, 0),
    dz = vec3(0, 0, e)
  const Px = (q) => gnoise(q.add(vec3(31.4, 0, 0)))
  const Py = (q) => gnoise(q.add(vec3(0, 47.2, 0)))
  const Pz = (q) => gnoise(q.add(vec3(0, 0, 19.8)))
  const cx = Pz(p.add(dy))
    .sub(Pz(p.sub(dy)))
    .sub(Py(p.add(dz)).sub(Py(p.sub(dz))))
  const cy = Px(p.add(dz))
    .sub(Px(p.sub(dz)))
    .sub(Pz(p.add(dx)).sub(Pz(p.sub(dx))))
  const cz = Py(p.add(dx))
    .sub(Py(p.sub(dx)))
    .sub(Px(p.add(dy)).sub(Px(p.sub(dy))))
  return vec3(cx, cy, cz).div(2 * e)
}

const COPPER = vec3(0.878, 0.627, 0.376)
const STEEL = vec3(0.91, 0.922, 0.941)
const PEARL = vec3(0.937, 0.906, 0.855)

const orientLocalToDirection = (dir, local) => {
  const zc = dir.add(vec3(0, 0, 1e-4)).normalize()
  const up = zc.y
    .abs()
    .greaterThan(0.99)
    .select(vec3(1, 0, 0), vec3(0, 1, 0))
  const right = up.cross(zc).normalize()
  const up2 = zc.cross(right)
  return right.mul(local.x).add(up2.mul(local.y)).add(zc.mul(local.z))
}

export const MeshFlowField = ({
  count = 40000,
  size = 0.02,
  stretch = 40,
  coreRadius = 1.6,
  fieldFrequency = 0.9,
  curlStrength = 0.02,
  centerPull = 0.004,
  damping = 0.05,
  decay = 0.0007,
  simSpeed = 0.15,
}) => {
  const meshRef = useRef(null)
  const gl = useThree((state) => state.gl)
  const { scene } = useThree()

  // An environment for the metal to reflect + a light backdrop
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.background = new THREE.Color('#c9c2b5')
    return () => {
      env.dispose()
      pmrem.dispose()
    }
  }, [scene, gl])

  const [computeUpdate, mesh] = useMemo(() => {
    const positionBuffer = storage(new THREE.StorageInstancedBufferAttribute(count, 4), 'vec4', count)
    const basePositionBuffer = storage(new THREE.StorageInstancedBufferAttribute(count, 4), 'vec4', count)
    // vec4 velocity on purpose - see the "needles" note above
    const velocityBuffer = storage(new THREE.StorageInstancedBufferAttribute(count, 4), 'vec4', count)

    // Seed a dense ball of particles
    const init = Fn(() => {
      const id = instanceIndex
      const dir = vec3(hash(id).sub(0.5), hash(id.add(3)).sub(0.5), hash(id.add(4)).sub(0.5)).add(1e-4)
      const rad = hash(id.add(5)).pow(1.6).mul(coreRadius)
      const p0 = dir.normalize().mul(rad)
      positionBuffer.element(id).assign(vec4(p0, hash(id.add(6))))
      basePositionBuffer.element(id).assign(vec4(p0, 1))
      velocityBuffer.element(id).assign(vec4(0))
    })().compute(count)
    gl.compute(init)

    // Advect along the curl field each frame
    const update = Fn(() => {
      const id = instanceIndex
      const p = positionBuffer.element(id).xyz
      const life = positionBuffer.element(id).w

      If(life.greaterThan(0), () => {
        const v = velocityBuffer.element(id).xyz
        const field = curl(p.mul(fieldFrequency).add(vec3(0, 0, time.mul(0.015))))
        v.assign(
          v
            .mul(damping)
            .add(field.mul(curlStrength))
            .add(p.mul(float(-centerPull))),
        )
        p.addAssign(v.mul(simSpeed))
        life.subAssign(decay * simSpeed)
      }).Else(() => {
        const b = basePositionBuffer.element(id)
        p.assign(b.xyz)
        life.assign(b.w)
        velocityBuffer.element(id).assign(vec4(0))
      })
    })().compute(count)

    // Lit, per-instance material
    const material = new MeshStandardNodeMaterial({
      metalness: 0.95,
      roughness: 0.3,
      flatShading: true,
    })

    // positionNode: orient(localVertex * size * scale) + centre
    material.positionNode = Fn(() => {
      const centre = positionBuffer.toAttribute().xyz
      const velocity = velocityBuffer.toAttribute().xyz
      const speed = velocity.length()

      const s = hash(instanceIndex.add(20)).mul(0.4).add(1)
      const localScale = vec3(s, s, s.mul(float(1).add(speed.mul(stretch))))
      const local = attribute('position').mul(float(size).mul(localScale))
      return orientLocalToDirection(velocity, local).add(centre)
    })()

    // Per-particle material groups
    const groupId = hash(instanceIndex.add(50)).mul(3).floor()
    const pick3 = (g, a, b, c) => select(g.lessThan(0.5), a, select(g.lessThan(1.5), b, c))
    material.colorNode = pick3(groupId, COPPER, STEEL, PEARL)
    material.metalnessNode = pick3(groupId, float(1.0), float(1.0), float(0.15))
    material.roughnessNode = pick3(groupId, float(0.25), float(0.08), float(0.6))

    // A unit box per instance - size comes from positionNode, not the geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const instanced = new THREE.InstancedMesh(geometry, material, count)
    instanced.frustumCulled = false

    return [update, instanced]
  }, [])

  useFrame(async ({ gl }) => {
    await gl.computeAsync(computeUpdate)
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 2]} intensity={2.5} />
      <primitive object={mesh} ref={meshRef} />
    </>
  )
}
