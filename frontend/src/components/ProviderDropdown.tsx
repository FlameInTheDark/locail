import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type Provider = { id: number; name: string; type?: string; model?: string }

type Props = {
  providers: Provider[]
  value: number | null
  onChange: (id: number) => void
  disabled?: boolean
}

export default function ProviderDropdown({ providers, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties>({})

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = useMemo(() => providers.find(p => p.id === value) || null, [providers, value])
  const label = current ? `${current.name}${current.model ? ` · ${current.model}` : ''}` : '—'

  useEffect(() => {
    if (!open) { setOverlayStyle({}); return }
    const raf = window.requestAnimationFrame(() => {
      const el = overlayRef.current
      if (!el) return
      // Reset any previous transform before measuring to avoid compounding offsets
      el.style.transform = 'none'
      const rect = el.getBoundingClientRect()
      let shiftX = 0
      const padding = 8
      if (rect.left < padding) {
        shiftX += padding - rect.left
      }
      const overflowRight = rect.right - (window.innerWidth - padding)
      if (overflowRight > 0) {
        shiftX -= overflowRight
      }
      const style: CSSProperties = {}
      if (shiftX !== 0) {
        style.transform = `translateX(${shiftX}px)`
      } else {
        style.transform = undefined
      }
      style.maxWidth = Math.max(180, window.innerWidth - padding * 2)
      setOverlayStyle(style)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className={`h-7 border rounded-md px-2 bg-white text-xs flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title={current ? `${current.name}${current.model ? ` (${current.model})` : ''}` : 'Select provider'}
      >
        <span className="truncate max-w-[160px]">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={overlayRef} style={overlayStyle} className="absolute z-50 bottom-full mb-1 w-[240px] md:w-[260px] rounded-md border bg-white shadow-lg right-0">
          <ul className="max-h-64 overflow-auto py-1" role="listbox">
            {providers.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-500">No providers</li>
            )}
            {providers.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 ${p.id === value ? 'bg-slate-50' : ''}`}
                  onClick={() => { onChange(p.id); setOpen(false) }}
                  role="option"
                  aria-selected={p.id === value}
                  title={`${p.name}${p.model ? ` (${p.model})` : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium text-[12px] truncate">{p.name}{p.type ? <span className="text-slate-400"> · {p.type}</span> : null}</div>
                      <div className="text-[11px] text-slate-500 truncate">{p.model || 'default model'}</div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
