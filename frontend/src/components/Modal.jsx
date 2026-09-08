import { useEffect } from 'react'

export default function Modal({ title, subtitle, icon, onClose, children, maxWidth = 'max-w-4xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/60 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`relative flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#fdfbf7] text-[#2c3e50] shadow-2xl animate-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e9dfd1] bg-[#faf5ee] px-6 py-4">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100/80 text-xl shadow-inner">
                {icon}
              </span>
            )}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#2d3748]">{title}</h2>
              {subtitle && <p className="text-xs text-[#718096]">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal and return to room"
            className="flex items-center gap-1.5 rounded-xl border border-[#e2d5c3] bg-white px-3 py-1.5 text-xs font-semibold text-[#5a4a42] shadow-sm transition hover:bg-[#f3ece2] hover:text-black active:scale-95"
          >
            <span>Return to Room</span>
            <span className="text-base leading-none">✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
