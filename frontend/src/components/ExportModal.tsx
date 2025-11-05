import React, { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import * as ExportAPI from '../../wailsjs/go/app/ExportAPI'

type Props = {
  open: boolean
  fileId: number | null
  defaultLocale: string
  originalFormat?: string
  originalPath?: string
  onClose: () => void
  onExported?: (filename: string) => void
}

const extFor: Record<string, string> = {
  paraglidejson: 'json',
  csv: 'csv',
  valvevdf: 'vdf',
}

function suggestFilename(path?: string, format?: string, locale?: string) {
  const base = (path?.split('/')?.pop() || 'translations')
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.substring(0, dot) : base
  const ext = extFor[format || ''] || 'txt'
  const loc = locale ? `.${locale}` : ''
  return `${stem}${loc}.${ext}`
}

function downloadBase64(filename: string, base64: string, mime = 'application/octet-stream') {
  if (!base64) return
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function ExportModal({ open, fileId, defaultLocale, originalFormat, originalPath, onClose, onExported }: Props) {
  const [format, setFormat] = useState<string>(originalFormat || '')
  const [languageName, setLanguageName] = useState<string>(defaultLocale)
  const [filename, setFilename] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csvSep, setCsvSep] = useState<'comma' | 'semicolon' | 'tab'>('comma')

  const effectiveFormat = useMemo(() => (format || originalFormat || ''), [format, originalFormat])

  useEffect(() => {
    if (open) {
      setFormat(originalFormat || '')
      setLanguageName(defaultLocale)
      setFilename(suggestFilename(originalPath, originalFormat, defaultLocale))
      setBusy(false)
      setError(null)
      setCsvSep('comma')
    }
  }, [open, originalFormat, originalPath, defaultLocale])

  useEffect(() => {
    setFilename(suggestFilename(originalPath, effectiveFormat, defaultLocale))
  }, [effectiveFormat])

  const disabled = useMemo(() => !fileId || !defaultLocale || busy, [fileId, defaultLocale, busy])

  const doExport = async () => {
    if (!fileId) return
    setBusy(true)
    try {
      setError(null)
      const res = await (ExportAPI as any).ExportFileBase64({
        file_id: fileId,
        locale: defaultLocale,
        override_format: format && format !== originalFormat ? format : '',
        language_name: effectiveFormat === 'valvevdf' ? (languageName || defaultLocale)
          : (effectiveFormat === 'csv' ? `sep:${csvSep}` : (languageName || defaultLocale)),
      })
      const fname = filename || (res?.filename || suggestFilename(originalPath, effectiveFormat, defaultLocale))
      downloadBase64(fname, res?.content_b64 || '', 'application/octet-stream')
      onExported?.(fname)
      onClose()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold">Export File</div>
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" onClick={onClose} aria-label="Close"><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 grid gap-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid gap-1.5">
            <label className="text-sm">Format</label>
            <select className="h-9 border rounded-md px-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" value={format || originalFormat || ''} onChange={e => setFormat(e.target.value)}>
              <option value={originalFormat || ''}>{originalFormat || 'original'}</option>
              <option value="paraglidejson">Paraglide JSON (.json)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="valvevdf">Valve/HL VDF (.vdf)</option>
            </select>
          </div>
          {effectiveFormat === 'valvevdf' && (
            <div className="grid gap-1.5">
              <label className="text-sm">Language Name (for VDF header)</label>
              <Input value={languageName} onChange={e => setLanguageName(e.target.value)} placeholder={defaultLocale} />
            </div>
          )}
          {effectiveFormat === 'csv' && (
            <div className="grid gap-1.5">
              <label className="text-sm">CSV Separator</label>
              <select className="h-9 border rounded-md px-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" value={csvSep} onChange={e => setCsvSep(e.target.value as any)}>
                <option value="comma">Comma (,)</option>
                <option value="semicolon">Semicolon (;)</option>
                <option value="tab">Tab (\\t)</option>
              </select>
            </div>
          )}
          <div className="grid gap-1.5">
            <label className="text-sm">Filename</label>
            <Input value={filename} onChange={e => setFilename(e.target.value)} placeholder={suggestFilename(originalPath, format || originalFormat, defaultLocale)} />
            <div className="text-xs text-muted-foreground">This controls the saved file name.</div>
          </div>
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={doExport} disabled={disabled}>Export</Button>
        </div>
      </div>
    </div>
  )
}
