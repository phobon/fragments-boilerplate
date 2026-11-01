import type { Camera, Scene } from 'three'
import { Vector2, type WebGPURenderer } from 'three/webgpu'

export const SNAPSHOT_WIDTH = 1200
export const SNAPSHOT_HEIGHT = 900 // 4:3
export const VIDEO_WIDTH = 960
export const VIDEO_HEIGHT = 720 // 4:3
export const VIDEO_DURATION_MS = 5000
export const VIDEO_FPS = 60
export const VIDEO_BITRATE = 6_000_000

type CaptureTarget = {
  renderer: WebGPURenderer
  scene: Scene
  camera: Camera
}

let target: CaptureTarget | null = null
let isRecording = false

/**
 * Registers the renderer/scene/camera that `captureSnapshot` / `recordVideo` should use.
 * Returns an unregister function.
 */
export function registerCaptureTarget(next: CaptureTarget) {
  target = next
  return () => {
    if (target === next) target = null
  }
}

function downloadBlob(blob: Blob, name: string, extension: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${timestamp}.${extension}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Renders a single frame at a fixed resolution (default 1200x900, 4:3), copies it into a 2D canvas,
 * restores the renderer to its previous size and downloads the result as a PNG.
 */
export async function captureSnapshot(name = 'snapshot', width = SNAPSHOT_WIDTH, height = SNAPSHOT_HEIGHT) {
  if (!target || isRecording) {
    if (!target) console.warn('captureSnapshot: no renderer registered')
    return
  }

  const { renderer, scene, camera } = target
  const canvas = renderer.domElement as HTMLCanvasElement

  const prevSize = renderer.getSize(new Vector2())
  const prevPixelRatio = renderer.getPixelRatio()

  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const ctx = output.getContext('2d')!

  try {
    // Resize the drawing buffer only (updateStyle = false) so the on-screen layout doesn't jump
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.render(scene, camera)

    // Copy synchronously, before the WebGPU canvas texture is presented and discarded
    ctx.drawImage(canvas, 0, 0, width, height)
  } finally {
    renderer.setPixelRatio(prevPixelRatio)
    renderer.setSize(prevSize.x, prevSize.y, false)
    renderer.render(scene, camera)
  }

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'))
  if (blob) downloadBlob(blob, name, 'png')
}

const VIDEO_MIME_TYPES = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

function pickVideoMimeType() {
  return VIDEO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

/**
 * Records the live canvas at a fixed resolution (default 960x720, 4:3) for a fixed duration (default 5s) and downloads it.
 * All options can be overridden, e.g. `recordVideo(name, { durationMs: 10000, width: 1200, height: 900 })`.
 * Prefers MP4 (H.264) where supported, falling back to WebM.
 *
 * While recording, the drawing buffer is held at the target size (resize/DPR changes are ignored) and the
 * canvas is letterboxed on screen with `object-fit: contain` so the preview matches the output framing.
 */
export async function recordVideo(
  name = 'recording',
  {
    durationMs = VIDEO_DURATION_MS,
    width = VIDEO_WIDTH,
    height = VIDEO_HEIGHT,
    fps = VIDEO_FPS,
    bitrate = VIDEO_BITRATE,
    onProgress,
  }: {
    durationMs?: number
    width?: number
    height?: number
    fps?: number
    bitrate?: number
    onProgress?: (remainingMs: number) => void
  } = {},
) {
  if (!target || isRecording) {
    if (!target) console.warn('recordVideo: no renderer registered')
    return
  }

  const { renderer, scene, camera } = target
  const canvas = renderer.domElement as HTMLCanvasElement

  const prevSize = renderer.getSize(new Vector2())
  const prevPixelRatio = renderer.getPixelRatio()
  const prevObjectFit = canvas.style.objectFit
  const setSize = renderer.setSize
  const setPixelRatio = renderer.setPixelRatio

  isRecording = true

  try {
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.render(scene, camera)
    canvas.style.objectFit = 'contain'

    // Hold the buffer size while recording (R3F resize / AdaptiveDpr would otherwise reset it)
    renderer.setSize = () => renderer
    renderer.setPixelRatio = () => {}

    const mimeType = pickVideoMimeType()
    const stream = canvas.captureStream(fps)
    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: bitrate,
    })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()))

    recorder.start()
    const start = performance.now()
    onProgress?.(durationMs)
    const interval = setInterval(() => {
      onProgress?.(Math.max(0, durationMs - (performance.now() - start)))
    }, 250)

    await new Promise((resolve) => setTimeout(resolve, durationMs))
    clearInterval(interval)
    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())

    const type = recorder.mimeType || mimeType || 'video/webm'
    const blob = new Blob(chunks, { type })
    downloadBlob(blob, name, type.includes('mp4') ? 'mp4' : 'webm')
  } finally {
    renderer.setSize = setSize
    renderer.setPixelRatio = setPixelRatio
    renderer.setPixelRatio(prevPixelRatio)
    renderer.setSize(prevSize.x, prevSize.y, false)
    canvas.style.objectFit = prevObjectFit
    isRecording = false
  }
}
