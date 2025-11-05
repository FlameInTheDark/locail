import React, { useMemo, useState } from 'react'
import { X, UploadCloud } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import * as ImportAPI from '../../wailsjs/go/app/ImportAPI'

type Props = {
  open: boolean
  projectId: number | null
  onClose: () => void
  onImported: (fileId: number) => void
}

function guessFormat(filename: string): string {
  const f = filename.toLowerCase()
  if (f.endsWith('.json')) return 'paraglidejson'
  if (f.endsWith('.csv')) return 'csv'
  if (f.endsWith('.vdf') || f.endsWith('.txt') || f.includes('valve') || f.includes('half-life')) return 'valvevdf'
  return 'paraglidejson'
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const idx = result.indexOf('base64,')
      if (idx >= 0) return resolve(result.substring(idx + 7))
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ImportFileModal({ open, projectId, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [locale, setLocale] = useState('')
  const [format, setFormat] = useState('paraglidejson')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = useMemo(() => !file || !locale.trim() || !projectId || busy, [file, locale, projectId, busy])

  if (!open) return null

  const onSelect = (f: File | null) => {
    setFile(f)
    if (f) setFormat(guessFormat(f.name))
  }

  const doImport = async () => {
    if (!file || !projectId) return
    setBusy(true)
    try {
      setError(null)
      const content_b64 = await fileToBase64(file)
      const res = await (ImportAPI as any).ImportBase64({
        project_id: projectId,
        filename: file.name,
        format,
        locale,
        content_b64,
      })
      const id = res?.file_id ?? res?.FileID
      if (id) onImported(Number(id))
      onClose()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-2xl rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold">Import File</div>
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" onClick={onClose} aria-label="Close"><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 grid gap-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Locale (file language)</label>
              <Input value={locale} onChange={e => setLocale(e.target.value)} placeholder="e.g., en or ru" />
            </div>
            <div>
              <label className="text-sm">Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)} className="h-9 border rounded-md px-2 w-full dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                <option value="paraglidejson">Paraglide JSON</option>
                <option value="csv">CSV</option>
                <option value="valvevdf">Valve/HL VDF</option>
              </select>
            </div>
          </div>
          <label className="text-sm">File</label>
          <div
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onSelect(f) }}
            className="border rounded-md p-6 text-center bg-muted/20 dark:bg-slate-700/40 dark:border-slate-600"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <UploadCloud className="h-6 w-6 text-muted-foreground"/>
              <div className="text-sm text-muted-foreground">Drag & drop or choose a file</div>
              <div className="text-xs text-muted-foreground">Supported: .json (Paraglide), .csv (CSV), .vdf/.txt (Valve VDF)</div>
              <input type="file" onChange={e => onSelect(e.target.files?.[0] || null)} className="hidden" id="ifileinput" accept=".json,.csv,.vdf,.txt" />
              <Button variant="outline" onClick={() => (document.getElementById('ifileinput') as HTMLInputElement)?.click()}>Browse…</Button>
              {file && <div className="text-xs text-muted-foreground">Selected: {file.name}</div>}
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={doImport} disabled={disabled}>Import</Button>
        </div>
      </div>
    </div>
  )
}
