import * as React from 'react'

type Props = { value: number; max?: number }

export function Progress({ value, max = 100 }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="w-full h-2 bg-muted rounded-md overflow-hidden">
      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  )
}

