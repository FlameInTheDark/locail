import React, { useEffect, useState } from 'react'
import { X, Plus, Save as SaveIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import * as ProjectAPI from '../../wailsjs/go/app/ProjectAPI'

type Props = {
  open: boolean
  project: { id: number; name: string; sourceLang: string } | null
  onClose: () => void
  onSaved: () => void
}

type Locale = { id: number; project_id: number; locale: string }

export default function EditProjectModal({ open, project, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [locales, setLocales] = useState<Locale[]>([])
  const [newLocale, setNewLocale] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && project) {
      setName(project.name)
      setSource(project.sourceLang || '')
      loadLocales(project.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id])

  const loadLocales = async (id: number) => {
    try {
      const res = await (ProjectAPI as any).ListLocales(id)
      setLocales(res || [])
    } catch (e) { console.error(e) }
  }

  const addLocale = async () => {
    if (!project || !newLocale.trim()) return
    setBusy(true)
    try {
      await (ProjectAPI as any).AddLocale(project.id, newLocale.trim())
      setNewLocale('')
      await loadLocales(project.id)
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  const save = async () => {
    if (!project) return
    setBusy(true)
    try {
      await (ProjectAPI as any).Update(project.id, name.trim() || project.name, source.trim())
      onSaved()
      onClose()
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  if (!open || !project) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold">Edit Project</div>
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" onClick={onClose} aria-label="Close"><X className="h-4 w-4"/></button>
        </div>
        <div className="p-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input id="pname" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="psrc">Source Language</Label>
            <Input id="psrc" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g., en" />
          </div>
          <div className="grid gap-1.5">
            <Label>Target Locales</Label>
            <div className="flex flex-wrap gap-2">
              {locales.map(l => (<span key={l.id} className="px-2 py-1 text-xs rounded-md border bg-muted">{l.locale}</span>))}
            </div>
            <div className="flex items-center gap-2">
              <Input value={newLocale} onChange={e => setNewLocale(e.target.value)} placeholder="Add (e.g., de)" className="max-w-40" />
              <Button variant="outline" size="sm" onClick={addLocale} disabled={busy || !newLocale.trim()}><Plus className="h-4 w-4 mr-1"/>Add</Button>
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}><SaveIcon className="h-4 w-4 mr-2"/>Save</Button>
        </div>
      </div>
    </div>
  )
}
