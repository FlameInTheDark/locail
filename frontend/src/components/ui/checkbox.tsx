import * as React from 'react'
import { cn } from '../../lib/utils'

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string }

export function Checkbox({ className, label, ...props }: Props) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary focus-visible:outline-none" {...props} />
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}

