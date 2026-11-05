import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  captureSnapshot,
  recordVideo,
  SNAPSHOT_HEIGHT,
  SNAPSHOT_WIDTH,
  VIDEO_DURATION_MS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from '@/utils/capture_snapshot'
import { CameraIcon, CheckIcon, RecordIcon, SketchesIcon } from './icons'
import './index.css'

type SketchInfo = {
  name: string
  path: string
  url: string
}

// Same glob as the sketches route
const sketchesGlob = import.meta.glob('../../sketches/**/*.{ts,tsx}', { eager: true })

const SKETCHES: SketchInfo[] = Object.keys(sketchesGlob)
  .sort()
  .map((filePath) => {
    // ../../sketches/nested/dawn-1.ts (or .tsx) -> nested/dawn-1
    const relativePath = filePath.replace('../../sketches/', '').replace(/\.tsx?$/, '')
    return {
      name: relativePath.split('/').pop() || relativePath,
      path: `/${relativePath}`,
      url: `/sketches/${relativePath}`,
    }
  })

/**
 * Floating bottom toolbar: sketches menu, 4:3 PNG snapshot and fixed-length 4:3 video recording.
 */
export function Toolbar() {
  const rootRef = useRef<HTMLDivElement>(null)
  const pathname = useLocation({ select: (location) => location.pathname })
  const captureName =
    pathname
      .replace(/^\/sketches\//, '')
      .replace(/^\/$/, '')
      .replace(/\//g, '-') || 'snapshot'

  const [menuOpen, setMenuOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const savedTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(savedTimeout.current), [])

  // Close the menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const isRecording = remaining !== null
  const durationSeconds = Math.round(VIDEO_DURATION_MS / 1000)
  const progress = useMemo(
    () => (isRecording ? 1 - remaining / VIDEO_DURATION_MS : undefined),
    [isRecording, remaining],
  )

  const onSnapshot = async () => {
    setFlashKey((k) => k + 1)
    const ok = await captureSnapshot(captureName)
    if (!ok) return
    setSaved(true)
    clearTimeout(savedTimeout.current)
    savedTimeout.current = setTimeout(() => setSaved(false), 1200)
  }

  const onRecord = async () => {
    setMenuOpen(false)
    try {
      await recordVideo(captureName, { onProgress: setRemaining })
    } finally {
      setRemaining(null)
    }
  }

  return (
    <>
      {flashKey > 0 ? <div key={flashKey} className='capture-flash' onAnimationEnd={() => setFlashKey(0)} /> : null}

      <div className='toolbar' role='toolbar' aria-label='Sketch controls' ref={rootRef}>
        <button
          type='button'
          className='toolbar__button'
          aria-label='Sketches'
          aria-haspopup='menu'
          aria-expanded={menuOpen}
          data-tooltip='Sketches'
          onClick={() => setMenuOpen((open) => !open)}
        >
          <SketchesIcon />
        </button>

        {menuOpen ? (
          <nav className='toolbar__popover' aria-label='Sketches'>
            <div className='toolbar__popover-title'>Sketches</div>
            {SKETCHES.map((sketch) => (
              <Link
                key={sketch.url}
                to={sketch.url}
                className='toolbar__item'
                aria-current={pathname === sketch.url ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span>{sketch.name}</span>
                <span className='toolbar__item-path'>{sketch.path}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        <span className='toolbar__divider' aria-hidden='true' />

        <button
          type='button'
          className='toolbar__button'
          aria-label={saved ? 'Snapshot saved' : 'Capture snapshot'}
          data-tooltip={saved ? 'Saved' : `Snapshot · ${SNAPSHOT_WIDTH}×${SNAPSHOT_HEIGHT}`}
          data-state={saved ? 'saved' : undefined}
          onClick={onSnapshot}
          disabled={isRecording}
        >
          {saved ? <CheckIcon /> : <CameraIcon />}
        </button>

        <button
          type='button'
          className='toolbar__button'
          aria-label={isRecording ? `Recording, ${Math.ceil(remaining / 1000)} seconds left` : 'Record video'}
          data-tooltip={
            isRecording
              ? `Recording · ${Math.ceil(remaining / 1000)}s`
              : `Record ${durationSeconds}s · ${VIDEO_WIDTH}×${VIDEO_HEIGHT}`
          }
          data-state={isRecording ? 'recording' : undefined}
          onClick={onRecord}
          disabled={isRecording}
        >
          <RecordIcon progress={progress} />
        </button>
      </div>
    </>
  )
}
