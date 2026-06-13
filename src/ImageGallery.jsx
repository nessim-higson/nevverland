import { useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// The image gallery — pure gesture, no chrome.
//
//   tap the image  → step in (gallery → fullscreen) / out (full → gallery)
//   swipe          → image to image
//   tap the canvas → back to the hero (handled by the parent)
//
// One horizontal track of slides. In GALLERY the image floats inset with
// dark canvas around it (so a canvas-tap is possible); in FULL it covers
// the screen edge to edge.
// ─────────────────────────────────────────────────────────────
export default function ImageGallery({ media, idx, setIdx, full, onImageTap, onCanvasTap }) {
  const drag = useRef(null)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onDown = (e) => {
    drag.current = { x: e.clientX, d: 0, moved: 0, onImg: !!e.target.closest('.galImg') }
    setDragging(true)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* no active pointer (synthetic event) — capture is a nicety, not required */
    }
  }
  const onMove = (e) => {
    if (!drag.current) return
    const d = e.clientX - drag.current.x
    drag.current.d = d // source of truth — state is async / can be stale
    drag.current.moved = Math.max(drag.current.moved, Math.abs(d))
    setDx(d)
  }
  const onUp = () => {
    const dr = drag.current
    drag.current = null
    setDragging(false)
    setDx(0)
    if (!dr) return
    if (dr.moved < 10) {
      // a tap, not a swipe — the image steps the view, the canvas exits
      dr.onImg ? onImageTap() : onCanvasTap()
      return
    }
    if (dr.d < -55 && idx < media.length - 1) setIdx(idx + 1)
    else if (dr.d > 55 && idx > 0) setIdx(idx - 1)
  }

  return (
    <div
      className={`imgStage ${full ? 'full' : 'gallery'}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
        setDx(0)
      }}
    >
      <div
        className="imgTrack"
        style={{
          transform: `translateX(calc(${-idx * 100}vw + ${dx}px))`,
          transition: dragging ? 'none' : 'transform 0.6s cubic-bezier(0.22, 1, 0.3, 1)',
        }}
      >
        {media.map((m, i) => (
          <div className="imgSlide" key={i}>
            {m.type === 'video' ? (
              <video className="galImg" src={m.src} autoPlay muted loop playsInline />
            ) : (
              <img className="galImg" src={m.src} alt="" draggable={false} />
            )}
          </div>
        ))}
      </div>

      <div className="imgDots">
        {media.map((_, i) => (
          <span key={i} className={i === idx ? 'on' : ''} />
        ))}
      </div>
    </div>
  )
}
