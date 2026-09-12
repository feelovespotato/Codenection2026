import PixelIcon from './PixelIcon.jsx'
import { useEffect, useId, useRef } from 'react'

export default function Modal({ title, subtitle, icon, onClose, children, maxWidth = 'max-w-4xl' }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const previousFocus = document.activeElement
    dialogRef.current?.focus()
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'Tab') {
        const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(item => item.getClientRects().length)
        const first = items[0], last = items.at(-1)
        if (!first) { e.preventDefault(); return }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); previousFocus?.focus() }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      ref={dialogRef}
      className="pixel-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/60 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`pixel-window relative flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#fdfbf7] text-[#2c3e50] shadow-2xl animate-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="pixel-window-header flex items-center justify-between gap-4 border-b border-[#e9dfd1] bg-[#faf5ee] px-6 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            {icon && (
              <span aria-hidden="true" className="pixel-window-icon hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100/80 text-3xl shadow-inner sm:flex">
                <PixelIcon symbol={icon} />
              </span>
            )}
            <div>
              <h2 id={titleId} className="text-3xl font-bold tracking-tight text-[#2d3748] sm:text-4xl">{title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal and return to room"
            className="flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[#e2d5c3] bg-white px-5 py-2 text-sm sm:text-base font-semibold text-[#5a4a42] shadow-sm transition hover:bg-[#f3ece2] hover:text-black"
          >
            <span className="hidden sm:inline">Return to Room</span>
            <span className="text-xl leading-none"><PixelIcon symbol="✕" /></span>
          </button>
        </div>

        {/* Body */}
        <div className="pixel-window-body min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  )
}
