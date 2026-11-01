import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { captureSnapshot, recordVideo } from '@/utils/capture_snapshot'
import './index.css'

type SketchInfo = {
  name: string
  path: string
  url: string
}
export function SketchesDropdown() {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [showSketches, setShowSketches] = useState(false)
  const [sketches, setSketches] = useState<SketchInfo[]>([])
  const [recordingRemaining, setRecordingRemaining] = useState<number | null>(null)
  const pathname = useLocation({ select: (location) => location.pathname })
  const snapshotName = pathname.replace(/^\/sketches\//, '').replace(/\//g, '-') || 'snapshot'

  useEffect(() => {
    // Use the same glob pattern as the sketches route
    const sketchesGlob: Record<string, { default: () => any }> = import.meta.glob('../../sketches/**/*.ts', {
      eager: true,
    })

    const sketchesList: SketchInfo[] = Object.keys(sketchesGlob).map((filePath) => {
      // Convert file path to URL path
      // ../../sketches/flare-1.ts -> flare-1
      // ../../sketches/nested/dawn-1.ts -> nested/dawn-1
      const relativePath = filePath.replace('../../sketches/', '').replace('.ts', '')
      const url = `/sketches/${relativePath}`

      // Extract name from path (last part before extension)
      const name = relativePath.split('/').pop() || relativePath

      return {
        name,
        path: `/${relativePath}`,
        url,
      }
    })

    setSketches(sketchesList)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSketches(false)
      }
    }

    if (showSketches) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSketches])

  return (
    <div className='sketches-overlay'>
      <div className='sketches-toggle' ref={dropdownRef}>
        <button onClick={() => setShowSketches(!showSketches)} className='sketches-toggle__button'>
          Sketches
        </button>
        <button onClick={() => captureSnapshot(snapshotName)} className='sketches-toggle__button'>
          Capture snapshot
        </button>
        <button
          onClick={async () => {
            try {
              await recordVideo(snapshotName, { onProgress: setRecordingRemaining })
            } finally {
              setRecordingRemaining(null)
            }
          }}
          disabled={recordingRemaining !== null}
          className='sketches-toggle__button'
        >
          {recordingRemaining !== null ? `Recording… ${Math.ceil(recordingRemaining / 1000)}s` : 'Record video'}
        </button>

        {showSketches && (
          <div className='sketches-dropdown'>
            <div className='sketches-dropdown__content'>
              <div className='sketches-list'>
                <div className='sketches-list__grid'>
                  {sketches.map((sketch) => (
                    <Link key={sketch.path} to={sketch.url} className='sketch-card'>
                      <h3 className='sketch-card__title'>{sketch.name}</h3>
                      <div className='sketch-card__path'>{sketch.path}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
