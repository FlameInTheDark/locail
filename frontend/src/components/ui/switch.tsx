import * as React from 'react'

type Props = { checked: boolean; onCheckedChange: (v: boolean) => void; label?: string }

export function Switch({ checked, onCheckedChange, label }: Props) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'} relative`} onClick={() => onCheckedChange(!checked)}>
        <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-background transition-transform ${checked ? 'translate-x-4' : ''}`}></span>
      </span>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </label>
  )
}

