import React, { useEffect, useMemo, useState } from 'react'
import { X, UploadCloud } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import * as ImportAPI from '../../wailsjs/go/app/ImportAPI'
import * as UnitAPI from '../../wailsjs/go/app/UnitAPI'

type Props = {
  open: boolean
  fileId: number | null
  filePath?: string
  originalFormat?: string
  onClose: () => void
  onUpdated?: () => void
}

type ImportedItem = { key: string; source: string; context?: string }
type Conflict = { key: string; dbSource: string; newSource: string; choice: 'db' | 'new' }

function guessFormat(filename?: string): string {
  const f = (filename || '').toLowerCase()
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

export default function UpdateFileModal({ open, fileId, filePath, originalFormat, onClose, onUpdated }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<string>(originalFormat || '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const [existing, setExisting] = useState<Record<string, string>>({})
  const [imported, setImported] = useState<ImportedItem[]>([])
  const [newKeys, setNewKeys] = useState<ImportedItem[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  useEffect(() => {
    if (open) {
      setFile(null)
      setFormat(originalFormat || '')
      setError(null)
      setBusy(false)
      setExisting({})
      setImported([])
      setNewKeys([])
      setConflicts([])
      if (fileId) loadExisting(fileId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileId])

  const loadExisting = async (fid: number) => {
    try {
      const res = await (UnitAPI as any).ListByFile(fid)
      const map: Record<string, string> = {}
      for (const u of res || []) {
        const k = u?.key ?? u?.Key
        const s = u?.source_text ?? u?.SourceText ?? ''
        if (k) map[String(k)] = String(s)
      }
      setExisting(map)
    } catch (e) {
      console.error(e)
    }
  }

  const onSelectFile = async (f: File | null) => {
    setFile(f)
    if (f && !format) setFormat(guessFormat(f.name))
    if (!f) return
    try {
      setError(null)
      const b64 = await fileToBase64(f)
      const api: any = (ImportAPI as any)
      if (typeof api.ParseBase64 !== 'function') {
        setError('Update preview requires rebuild (ParseBase64 missing).')
        return
      }
      const res = await api.ParseBase64({ project_id: 0, filename: f.name, format: format || guessFormat(f.name), locale: '', content_b64: b64 })
      const items: ImportedItem[] = (res?.items ?? res?.Items ?? []).map((it: any) => ({ key: it?.key ?? it?.Key, source: it?.source ?? it?.Source, context: it?.context ?? it?.Context }))
      setImported(items)
      // diff
      const newItems: ImportedItem[] = []
      const conf: Conflict[] = []
      for (const it of items) {
        const db = existing[it.key]
        if (db == null) newItems.push(it)
        else if (String(db) !== String(it.source)) conf.push({ key: it.key, dbSource: db, newSource: it.source, choice: 'new' })
      }
      setNewKeys(newItems)
      setConflicts(conf)
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  const onDropAreaDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragActive) setDragActive(true)
  }

  const onDropAreaDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragActive) setDragActive(false)
  }

  const onDropAreaDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer?.files?.[0] || null
    if (f) onSelectFile(f)
  }

  const totalImported = imported.length
  const totalNew = newKeys.length
  const totalConf = conflicts.length

  const applyChanges = async () => {
    if (!fileId) return
    setBusy(true)
    try {
      const items = [
        ...newKeys.map(k => ({ key: k.key, source: k.source, context: k.context || '' })),
        ...conflicts.filter(c => c.choice === 'new').map(c => ({ key: c.key, source: c.newSource, context: '' })),
      ]
      if (items.length === 0) { onClose(); return }
      const api: any = (UnitAPI as any)
      if (typeof api.UpsertBatch !== 'function') { setError('Update requires rebuild (UpsertBatch missing).'); setBusy(false); return }
      await api.UpsertBatch(fileId, items)
      onUpdated?.()
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
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="relative z-10 w-[92vw] max-w-3xl rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold">Update File</div>
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => !busy && onClose()} aria-label="Close"><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 grid gap-3 overflow-y-auto min-h-0">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Format</label>
              <select className="h-9 w-full border rounded-md px-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" value={format || originalFormat || ''} onChange={e => setFormat(e.target.value)}>
                <option value={originalFormat || ''}>{originalFormat || 'original'}</option>
                <option value="paraglidejson">Paraglide JSON (.json)</option>
                <option value="csv">CSV (.csv)</option>
                <option value="valvevdf">Valve/HL VDF (.vdf)</option>
              </select>
            </div>
            <div>
              <label className="text-sm">Select updated file</label>
              <div
                className={`border rounded-md p-3 text-center bg-muted/20 dark:bg-slate-700/40 dark:border-slate-600 ${dragActive ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}
                onDragOver={onDropAreaDragOver}
                onDragLeave={onDropAreaDragLeave}
                onDrop={onDropAreaDrop}
                aria-label="Drop file here"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <UploadCloud className="h-6 w-6 text-muted-foreground"/>
                  <div className="text-sm text-muted-foreground">Drag & drop or choose a file</div>
                  <input type="file" onChange={e => onSelectFile(e.target.files?.[0] || null)} className="hidden" id="u-fileinput" accept=".json,.csv,.vdf,.txt" />
                  <Button variant="outline" onClick={() => (document.getElementById('u-fileinput') as HTMLInputElement)?.click()}>Browse…</Button>
                  {file && <div className="text-xs text-muted-foreground">Selected: {file.name}</div>}
                </div>
              </div>
            </div>
          </div>

          {totalImported > 0 && (
            <div className="grid gap-3">
              <div className="text-sm">Imported {totalImported} keys · New: {totalNew} · Conflicts: {totalConf}</div>
              {totalNew > 0 && (
                <div className="border rounded-md dark:border-slate-600">
                  <div className="px-3 py-2 text-sm font-medium bg-slate-50 dark:bg-slate-700 dark:text-slate-200 border-b dark:border-slate-600">New Keys</div>
                  <ul className="max-h-48 overflow-auto text-sm">
                    {newKeys.map(n => (
                      <li key={n.key} className="px-3 py-1 flex items-center justify-between">
                        <span className="font-mono text-xs">{n.key}</span>
                        <span className="text-slate-500 truncate ml-2">{n.source}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {totalConf > 0 && (
                <div className="border rounded-md max-h-[50vh] overflow-auto dark:border-slate-600">
                  <div className="px-3 py-2 text-sm font-medium bg-slate-50 dark:bg-slate-700 dark:text-slate-200 border-b dark:border-slate-600">Conflicts</div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">
                      <tr className="text-left text-slate-700 dark:text-slate-200">
                        <th className="px-3 py-1 w-[24ch]">Key</th>
                        <th className="px-3 py-1">Existing</th>
                        <th className="px-3 py-1">Imported</th>
                        <th className="px-3 py-1 w-[16ch]">Keep</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.map((c, idx) => (
                        <tr key={c.key} className="border-b dark:border-slate-700 last:border-0">
                          <td className="px-3 py-1 font-mono text-xs align-top">{c.key}</td>
                          <td className="px-3 py-1 align-top text-slate-600 dark:text-slate-300">{c.dbSource}</td>
                          <td className="px-3 py-1 align-top text-slate-800 dark:text-slate-100">{c.newSource}</td>
                          <td className="px-3 py-1 align-top">
                            <div className="inline-flex items-center rounded-md border overflow-hidden" role="group" aria-label={`Choose version for ${c.key}`}>
                              <button
                                type="button"
                                className={`px-2 py-1 text-xs ${c.choice === 'db' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 dark:text-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                onClick={() => setConflicts(prev => prev.map((x,i) => i===idx? { ...x, choice: 'db' }: x))}
                              >
                                Old
                              </button>
                              <button
                                type="button"
                                className={`px-2 py-1 text-xs border-l ${c.choice === 'new' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 dark:text-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                onClick={() => setConflicts(prev => prev.map((x,i) => i===idx? { ...x, choice: 'new' }: x))}
                              >
                                New
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={applyChanges} disabled={busy || (newKeys.length === 0 && conflicts.filter(c => c.choice === 'new').length === 0)}>Apply</Button>
        </div>
      </div>
    </div>
  )
}
