export const SketchesIcon = () => (
  <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.4' aria-hidden='true'>
    <rect x='2.5' y='2.5' width='4.5' height='4.5' rx='1' />
    <rect x='9' y='2.5' width='4.5' height='4.5' rx='1' />
    <rect x='2.5' y='9' width='4.5' height='4.5' rx='1' />
    <rect x='9' y='9' width='4.5' height='4.5' rx='1' />
  </svg>
)

export const CameraIcon = () => (
  <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.4' aria-hidden='true'>
    <path d='M2 5.5A1.5 1.5 0 0 1 3.5 4h1.3l1-1.5h4.4l1 1.5h1.3A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z' />
    <circle cx='8' cy='8.5' r='2.4' />
  </svg>
)

export const CheckIcon = () => (
  <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden='true'>
    <path d='M3.5 8.5 6.5 11.5 12.5 4.5' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
)

const RING_RADIUS = 6.5
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** Record glyph. While recording, a ring fills clockwise to show progress (0–1). */
export const RecordIcon = ({ progress }: { progress?: number }) => (
  <svg viewBox='0 0 16 16' aria-hidden='true'>
    <circle className='toolbar__record-track' cx='8' cy='8' r={RING_RADIUS} />
    {progress !== undefined ? (
      <circle
        className='toolbar__record-ring'
        cx='8'
        cy='8'
        r={RING_RADIUS}
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
      />
    ) : null}
    <circle className='toolbar__record-dot' cx='8' cy='8' r='3.5' />
  </svg>
)
