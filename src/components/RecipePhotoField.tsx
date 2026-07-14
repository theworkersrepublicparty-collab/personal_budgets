import { useEffect, useRef, useState } from 'react'

// A photo is normalized to a consistent 3:2 landscape on save, so every recipe
// card and detail banner shows the whole picture the same way. The adjuster lets
// you drag to reposition and zoom before it's baked to this size.
const OUT_W = 1200
const OUT_H = 800
const FRAME_W = 360
const FRAME_H = 240

export interface PhotoChoice {
  file: File | null // a newly cropped photo to upload, or null
  remove: boolean // true = clear the existing photo (revert to default icon)
}

export default function RecipePhotoField({
  currentUrl,
  onChange,
}: {
  currentUrl: string | null // existing photo (edit mode); null when none/adding
  onChange: (choice: PhotoChoice) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [remove, setRemove] = useState(false)
  const [adjusting, setAdjusting] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const u = URL.createObjectURL(file)
    setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  function onAdjusted(cropped: File) {
    setFile(cropped)
    setRemove(false)
    setAdjusting(null)
    onChange({ file: cropped, remove: false })
  }

  function removePhoto() {
    setFile(null)
    setRemove(true)
    onChange({ file: null, remove: true })
  }

  function undoRemove() {
    setRemove(false)
    onChange({ file: null, remove: false })
  }

  const showingNew = !!file
  const showingCurrent = !file && !remove && !!currentUrl
  const showingNone = !file && (remove || !currentUrl)

  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium text-slate-500">Photo</span>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {showingNew && <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />}
          {showingCurrent && (
            <img src={currentUrl!} alt="current" className="h-full w-full object-cover" />
          )}
          {showingNone && <span className="text-3xl">🍽️</span>}
        </div>

        <div className="text-xs">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setAdjusting(f)
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100"
            >
              {showingNone ? '＋ Add photo' : '↻ Replace photo'}
            </button>
            {(showingNew || showingCurrent) && (
              <button
                type="button"
                onClick={removePhoto}
                className="rounded-lg border border-red-200 px-3 py-1.5 font-medium text-money-out hover:bg-red-50"
              >
                Remove
              </button>
            )}
            {remove && currentUrl && (
              <button
                type="button"
                onClick={undoRemove}
                className="rounded-lg px-2 py-1.5 font-medium text-slate-500 underline hover:text-ink"
              >
                Undo
              </button>
            )}
          </div>
          <p className="mt-2 max-w-xs leading-relaxed text-slate-400">
            After choosing a photo you can drag to reposition and zoom to frame it. Best results: a
            landscape photo around <b>1200 × 800 px</b> (3:2). No photo shows the default icon.
          </p>
          {remove && currentUrl && (
            <p className="mt-1 text-money-out">Photo will be removed — the recipe shows the default icon.</p>
          )}
        </div>
      </div>

      {adjusting && (
        <PhotoAdjuster file={adjusting} onCancel={() => setAdjusting(null)} onDone={onAdjusted} />
      )}
    </div>
  )
}

// --- The drag-to-reposition + zoom cropper --------------------------------
function PhotoAdjuster({
  file,
  onCancel,
  onDone,
}: {
  file: File
  onCancel: () => void
  onDone: (cropped: File) => void
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1) // user zoom multiplier (>= 1)
  const [offset, setOffset] = useState({ x: 0, y: 0 }) // image top-left in frame coords
  const base = useRef(1) // "cover" scale so the image always fills the frame
  const url = useRef('')
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    url.current = u
    const image = new Image()
    image.onload = () => {
      const b = Math.max(FRAME_W / image.width, FRAME_H / image.height)
      base.current = b
      setScale(1)
      setOffset({ x: (FRAME_W - image.width * b) / 2, y: (FRAME_H - image.height * b) / 2 })
      setImg(image)
    }
    image.src = u
    return () => URL.revokeObjectURL(u)
  }, [file])

  // Keep the image covering the frame — never let a gap show at any edge.
  function clamp(o: { x: number; y: number }, disp: number, image: HTMLImageElement) {
    const iw = image.width * disp
    const ih = image.height * disp
    return {
      x: Math.min(0, Math.max(FRAME_W - iw, o.x)),
      y: Math.min(0, Math.max(FRAME_H - ih, o.y)),
    }
  }

  function zoom(next: number) {
    if (!img) return
    const disp0 = base.current * scale
    const disp1 = base.current * next
    // Zoom around the frame's center so it feels natural.
    const cx = FRAME_W / 2
    const cy = FRAME_H / 2
    const nx = cx - (cx - offset.x) * (disp1 / disp0)
    const ny = cy - (cy - offset.y) * (disp1 / disp0)
    setScale(next)
    setOffset(clamp({ x: nx, y: ny }, disp1, img))
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !img) return
    const disp = base.current * scale
    setOffset(
      clamp(
        { x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) },
        disp,
        img,
      ),
    )
  }
  function onPointerUp() {
    drag.current = null
  }

  function confirm() {
    if (!img) return
    const disp = base.current * scale
    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    // Source rectangle of the original image currently visible in the frame.
    const sx = -offset.x / disp
    const sy = -offset.y / disp
    const sW = FRAME_W / disp
    const sH = FRAME_H / disp
    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, OUT_W, OUT_H)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onDone(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  }

  const dispW = img ? img.width * base.current * scale : 0
  const dispH = img ? img.height * base.current * scale : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Adjust photo</h3>

        <div
          className="relative mx-auto overflow-hidden rounded-lg border border-slate-300 bg-slate-100"
          style={{ width: FRAME_W, height: FRAME_H, touchAction: 'none', cursor: 'move' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {img ? (
            <img
              src={url.current}
              alt="adjust"
              draggable={false}
              style={{ position: 'absolute', left: offset.x, top: offset.y, width: dispW, height: dispH, maxWidth: 'none' }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading…</div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-400">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={scale}
            onChange={(e) => zoom(Number(e.target.value))}
            className="flex-1"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Drag the photo to reposition. Everything inside the box is kept.</p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!img}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Use this photo
          </button>
        </div>
      </div>
    </div>
  )
}
