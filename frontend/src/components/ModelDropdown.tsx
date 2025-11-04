import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, RefreshCw, Search } from 'lucide-react'

type Option = {
  value: string
  label?: string
  tokens?: number
}

type Props = {
  value: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  loading?: boolean
  onRefresh?: () => void
}

export default function ModelDropdown({ value, options, onChange, placeholder = 'Select a model…', loading, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const currentLabel = useMemo(() => {
    const found = options.find(o => o.value === value)
    return found?.label || found?.value || ''
  }, [value, options])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => (o.label || o.value).toLowerCase().includes(q))
  }, [options, filter])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="h-9 w-full border rounded-md px-2 flex items-center justify-between bg-white hover:bg-slate-50"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-left mr-2">{currentLabel || <span className="text-slate-400">{placeholder}</span>}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
          <div className="p-2 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                className="h-8 w-full border rounded-md pl-7 pr-2 text-sm"
                placeholder="Filter models…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
            {onRefresh && (
              <button
                type="button"
                className="h-8 w-8 rounded-md border flex items-center justify-center hover:bg-slate-50"
                onClick={() => onRefresh()}
                title="Refresh models"
                aria-label="Refresh models"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <ul className="max-h-60 overflow-auto py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">No models</li>
            )}
            {filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 ${o.value === value ? 'bg-slate-50' : ''}`}
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  role="option"
                  aria-selected={o.value === value}
                  title={o.label || o.value}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{o.label || o.value}</span>
                    {o.tokens ? <span className="ml-2 text-xs text-slate-400">{o.tokens}</span> : null}
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

