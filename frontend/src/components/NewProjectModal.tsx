import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; source: string }) => Promise<void> | void
}

export default function NewProjectModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [source, setSource] = useState('en')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setSource('en')
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const create = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    try { await onSubmit({ name: name.trim(), source: source.trim() || 'en' }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="text-sm font-semibold">Create Project</div>
          <button className="p-2 rounded-lg hover:bg-slate-100" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="projName" className="text-sm">Name</Label>
            <Input id="projName" value={name} onChange={e => setName(e.target.value)} placeholder="My App" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="srcLang" className="text-sm">Source Language</Label>
            <Input id="srcLang" value={source} onChange={e => setSource(e.target.value)} placeholder="en" />
            <div className="text-xs text-slate-500">Example: en, de, fr. Defaults to "en".</div>
          </div>
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={create} disabled={!name.trim() || submitting}>Create</Button>
        </div>
      </div>
    </div>
  )
}

