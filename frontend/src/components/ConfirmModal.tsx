import React, { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

type Props = {
  open: boolean
  title?: string
  message?: string
  confirmText?: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export default function ConfirmModal({ open, title = 'Confirm', message = 'Are you sure?', confirmText = 'Delete', onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  if (!open) return null
  const handle = async () => {
    try {
      setBusy(true)
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="relative z-10 w-[92vw] max-w-sm rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="text-sm font-semibold">{title}</div>
          <button className="p-2 rounded-lg hover:bg-slate-100" onClick={() => !busy && onClose()} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 text-sm text-slate-700">
          {message}
        </div>
        <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onClose()} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={handle} disabled={busy}>{confirmText}</Button>
        </div>
      </div>
    </div>
  )
}

