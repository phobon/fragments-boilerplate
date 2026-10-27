import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Fn, instanceIndex, storageTexture, textureStore, uniform, uvec2, vec2, vec3, vec4, wgslFn } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { MeshBasicMaterial, NodeAccess } from 'three/webgpu'
import { sortLuminance } from './sorting_functions'
import { allValid } from './sorting_validators'

const DEFAULT_COLORNODE = Fn(([_uv]) => {
  return vec3(_uv, 1)
})

const nextPowerOfTwo = (n: number) => 2 ** Math.ceil(Math.log2(n))

export type PixelSortProps = {
  colorNode?: any
  sortFn?: any
  validateFn?: any
  threshold?: number
  sortDirection?: 'horizontal' | 'vertical' | 'diagonal'
  // Sorting algorithm.
  //  - "odd-even": simple transposition sort, pairs with the validator gate,
  //    but needs up to `width` passes to converge.
  //  - "bitonic": a full sort in far fewer passes (m·(m+1)/2 where m = log2(width)),
  //    at the cost of ignoring the validator (a bitonic network must run every
  //    compare-exchange to be correct). Requires a power-of-two row width, so the
  //    buffer is padded up to one.
  sortAlgorithm?: 'odd-even' | 'bitonic'
  // Passes to run per frame (odd-even only). Defaults to the row/column length so
  // the sort fully converges within a single frame. Lower it for a partial,
  // streaky glitch look.
  passesPerFrame?: number
  // Re-seed from the colorNode every frame. Set true for animated inputs (video,
  // moving shaders) so each frame is independently sorted from the current source.
  reseedEveryFrame?: boolean
}

export const PixelSort = ({
  colorNode = DEFAULT_COLORNODE,
  sortFn = sortLuminance,
  validateFn = allValid,
  threshold = 0.5,
  sortDirection = 'horizontal',
  sortAlgorithm = 'odd-even',
  passesPerFrame,
  reseedEveryFrame = false,
}: PixelSortProps) => {
  const { width, height } = useThree((state) => state.size)
  const _gl: any = useThree((state) => state.gl)

  const meshRef = useRef<any>(null)

  const isBitonic = sortAlgorithm === 'bitonic'

  const {
    material: m,
    computeToPong,
    computeToPing,
    pingTexture,
    pongTexture,
    computeInit,
    stages,
    kU,
    jU,
    defaultPasses,
  } = useMemo(() => {
    const _height = Math.floor(height)
    // Bitonic requires a power-of-two row width; pad the buffer up to one.
    const _width = isBitonic ? nextPowerOfTwo(Math.floor(width)) : Math.floor(width)

    const pingTexture = new THREE.StorageTexture(_width, _height)
    const pongTexture = new THREE.StorageTexture(_width, _height)
    pingTexture.type = THREE.HalfFloatType
    pongTexture.type = THREE.HalfFloatType

    const readPing = storageTexture(pingTexture).setAccess(NodeAccess.READ_ONLY)
    const writePing = storageTexture(pingTexture).setAccess(NodeAccess.WRITE_ONLY)
    const readPong = storageTexture(pongTexture).setAccess(NodeAccess.READ_ONLY)
    const writePong = storageTexture(pongTexture).setAccess(NodeAccess.WRITE_ONLY)

    // Determine the sort direction (for the odd-even kernel)
    let _sortDirection = 0
    switch (sortDirection) {
      case 'vertical':
        _sortDirection = 1
        break
      case 'diagonal':
        _sortDirection = 2
        break
      default:
        _sortDirection = 0
    }
    const resolution = _width * _height

    // Initialize the ping texture with the color node. The colorNode receives a
    // centred UV (-0.5..0.5); shift by 0.5 when sampling a texture.
    const computeInitFn = Fn(() => {
      const x = instanceIndex.mod(_width)
      const y = instanceIndex.div(_width)
      const indexUv = uvec2(x, y)

      const _uv = vec2(x, y).div(vec2(_width, _height)).sub(0.5)

      const pixel = colorNode(_uv)

      // Set up textures and buffers
      textureStore(pingTexture, indexUv, vec4(pixel, 1))
    })().compute(resolution)

    _gl.compute(computeInitFn)

    // NOTE: `textureLoad` currently throws in TSL against read/write storage
    // textures, so the sorting kernels are authored in WGSL via `wgslFn`.
    const wgslFormat = pingTexture.type === THREE.HalfFloatType ? 'rgba16float' : 'rgba8unorm'

    // Bitonic schedule + uniforms (mutated between dispatches to walk the schedule)
    const kU = uniform(0, 'uint')
    const jU = uniform(0, 'uint')
    const stages: Array<[number, number]> = []

    let computeToPong: any
    let computeToPing: any

    if (isBitonic) {
      // Precompute the (k, j) schedule for a power-of-two width.
      // stages.length === m·(m+1)/2 (36 for width = 256)
      for (let k = 2; k <= _width; k <<= 1) {
        for (let j = k >> 1; j > 0; j >>= 1) {
          stages.push([k, j])
        }
      }

      // Each thread compares its pixel against a partner elsewhere in the same
      // row and writes its own output every pass (so the write buffer is always
      // complete). Full sort only - the validator is intentionally not used.
      const computeBitonicWGSL = wgslFn(
        `
        fn computeBitonicWGSL(
          readTex: texture_storage_2d<${wgslFormat}, read>,
          writeTex: texture_storage_2d<${wgslFormat}, write>,
          index: u32,
          k: u32,
          j: u32
        ) -> void {
          let width = ${_width};
          let height = ${_height};

          let i = i32(index);
          let row = i / width;
          let col = i % width;

          // Bitonic partner in the same row. XOR by j (< width) keeps it in-row.
          let partner = col ^ i32(j);

          // NOTE: 'self' is a reserved keyword in WGSL - use 'own'
          let own = textureLoad(readTex, vec2i(col, row)).rgb;
          let other = textureLoad(readTex, vec2i(partner, row)).rgb;

          // Ascending sub-sequence when (col & k) == 0, descending otherwise.
          let ascending = (col & i32(k)) == 0;

          // Comparator returns true when 'own' should sort AFTER 'other' (is "greater").
          let selfGreater = sort(own, other, vec2i(col, row), vec2i(partner, row), vec2i(width, height));

          // Each thread outputs either its own pixel or its partner's.
          var outColor = own;
          let isLower = partner > col;

          if (ascending) {
            // lower index keeps the smaller value, upper index keeps the larger
            if (isLower) {
              if (selfGreater) { outColor = other; }
            } else {
              if (!selfGreater) { outColor = other; }
            }
          } else {
            // descending: the reverse
            if (isLower) {
              if (!selfGreater) { outColor = other; }
            } else {
              if (selfGreater) { outColor = other; }
            }
          }

          textureStore(writeTex, vec2i(col, row), vec4f(outColor, 1));
        }
      `,
        // Only the comparator is injected - no validator (bitonic is a full sort)
        [sortFn],
      )

      computeToPong = computeBitonicWGSL({
        readTex: readPing,
        writeTex: writePong,
        index: instanceIndex,
        k: kU,
        j: jU,
      }).compute(resolution)

      computeToPing = computeBitonicWGSL({
        readTex: readPong,
        writeTex: writePing,
        index: instanceIndex,
        k: kU,
        j: jU,
      }).compute(resolution)
    } else {
      const computePingPongWGSL = wgslFn(
        `
        fn computePingPongWGSL(
          readTex: texture_storage_2d<${wgslFormat}, read>,
          writeTex: texture_storage_2d<${wgslFormat}, write>,
          index: u32,
          offset: u32
        ) -> void {
          let width = ${_width};
          let height = ${_height};

          var indexUV: vec2i;
          var neighborUV: vec2i;

          // Perform a horizontal sort - we need to make sure we handle the edge cases where the neighbor is out of bounds properly
          if (${_sortDirection} == 0) {
            let row = i32(index) / width;
            let col = i32(index) % width;

            // Neighbor is out of bounds, so we need to write the pixel back to the output texture
            if (col + 1 >= width) {
              let pixel = textureLoad(readTex, vec2i(col, row)).rgb;
              textureStore(writeTex, vec2i(col, row), vec4f(pixel, 1));
              return;
            }

            // Only process even columns on even passes, odd columns on odd passes. This is essential for proper odd-even transposition convergence
            if ((col + i32(offset)) % 2 != 0) {
              let pixel = textureLoad(readTex, vec2i(col, row)).rgb;
              let neighbor = textureLoad(readTex, vec2i(col + 1, row)).rgb;

              textureStore(writeTex, vec2i(col, row), vec4f(pixel, 1));
              textureStore(writeTex, vec2i(col + 1, row), vec4f(neighbor, 1));
              return;
            }

            // Set the index UVs for the pixel and neighbor
            indexUV = vec2i(col, row);
            neighborUV = vec2i(col + 1, row);

            // Perform a vertical sort - we need to make sure we handle the edge cases where the neighbor is out of bounds properly
          } else if (${_sortDirection} == 1) {
            let col = i32(index) % width;
            let pair = i32(index) / width;
            let baseRow = pair * 2 + i32(offset);

            // Neighbor is out of bounds, so we need to write the pixel back to the output texture
            if (baseRow + 1 >= height || baseRow - 1 < 0) {
              // This is the last row, which has no neighbor, so we need to store the pixel on every frame
              let indexUV = vec2i(col, baseRow);
              let pixel = textureLoad(readTex, indexUV).rgb;
              textureStore(writeTex, indexUV, vec4f(pixel, 1));
              return;
            }

            // Set the index UVs for the pixel and neighbor
            indexUV = vec2i(col, baseRow);
            neighborUV = vec2i(col, baseRow + 1);
          }

          // Load the pixel and neighbor
          let pixel = textureLoad(readTex, indexUV).rgb;
          let neighbor = textureLoad(readTex, neighborUV).rgb;

          // Validate whether the pixel is valid to sort, if not return early
          let valid = validate(pixel, neighbor, indexUV, neighborUV, vec2i(width, height), ${threshold});
          if (!valid) {
            textureStore(writeTex, indexUV, vec4f(pixel, 1));
            textureStore(writeTex, neighborUV, vec4f(neighbor, 1));
            return;
          }

          // Sort the pixel!
          let swap = sort(pixel, neighbor, indexUV, neighborUV, vec2i(width, height));
          if (swap) {
            textureStore(writeTex, indexUV, vec4f(neighbor, 1));
            textureStore(writeTex, neighborUV, vec4f(pixel, 1));
          } else {
            textureStore(writeTex, indexUV, vec4f(pixel, 1));
            textureStore(writeTex, neighborUV, vec4f(neighbor, 1));
          }
        }
      `,

        [sortFn, validateFn],
      )

      // Functions that handle the ping-pong swap. computeToPong reads ping/writes
      // pong (offset 0 -> even parity); computeToPing reads pong/writes ping
      // (offset 1 -> odd parity). Alternating them gives the alternating parity
      // an odd-even transposition sort needs.
      computeToPong = computePingPongWGSL({
        readTex: readPing,
        writeTex: writePong,
        index: instanceIndex,
        offset: 0,
      }).compute(resolution)

      computeToPing = computePingPongWGSL({
        readTex: readPong,
        writeTex: writePing,
        index: instanceIndex,
        offset: 1,
      }).compute(resolution)
    }

    const material = new MeshBasicMaterial({
      transparent: true,
      map: pongTexture,
    })

    // Full convergence needs up to `width` (horizontal) / `height` (vertical) passes.
    const defaultPasses = _sortDirection === 1 ? _height : _width

    return {
      material,
      computeToPong,
      computeToPing,
      pingTexture,
      pongTexture,
      computeInit: computeInitFn,
      stages,
      kU,
      jU,
      defaultPasses,
    }
  }, [])

  // Cross-frame state. `readIsPing` tracks which buffer to read next (init wrote
  // ping, so we start there). `passesDone` counts odd-even passes accumulated so
  // far, so a low `passesPerFrame` can animate the sort over many frames instead
  // of finishing it in one. `bitonicDone` gates the (always single-frame) bitonic
  // path.
  const readIsPing = useRef(true)
  const passesDone = useRef(0)
  const bitonicDone = useRef(false)

  useFrame(async ({ gl }) => {
    // For animated inputs, re-seed the ping buffer from the colorNode so this
    // frame sorts the CURRENT source frame, and restart the sort from scratch
    if (reseedEveryFrame) {
      await (gl as any).computeAsync(computeInit)
      readIsPing.current = true
      passesDone.current = 0
      bitonicDone.current = false
    }

    if (isBitonic) {
      // A bitonic network must run its whole schedule to be correct, so it
      // always fully sorts in a single frame (no partial-crawl mode).
      if (bitonicDone.current && !reseedEveryFrame) {
        return
      }
      let rp = true
      for (const [k, j] of stages) {
        kU.value = k
        jU.value = j
        await (gl as any).computeAsync(rp ? computeToPong : computeToPing)
        rp = !rp
      }
      m.map = rp ? pingTexture : pongTexture
      bitonicDone.current = true
      return
    }

    // Odd-even. Once fully converged there's nothing left to do (a static input
    // stops; a re-seeded one reset passesDone above and keeps going).
    if (!reseedEveryFrame && passesDone.current >= defaultPasses) {
      return
    }

    // Passes to run THIS frame. Defaults to a full converge-in-one-frame sort;
    // set a small value (e.g. 1-4) to watch the sort crawl in over many frames.
    const perFrame = passesPerFrame ?? defaultPasses
    for (let pass = 0; pass < perFrame; pass++) {
      await (gl as any).computeAsync(readIsPing.current ? computeToPong : computeToPing)
      readIsPing.current = !readIsPing.current
    }
    passesDone.current += perFrame

    // Whichever texture we last wrote to holds the current (partial) result
    m.map = readIsPing.current ? pingTexture : pongTexture
  })

  return (
    <mesh material={m} scale={[width, height, 1]} ref={meshRef}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
