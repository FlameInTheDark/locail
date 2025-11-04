import * as React from 'react'
import { cn } from '../../lib/utils'

type Props = { children: React.ReactNode; variant?: 'default'|'secondary'|'destructive' }

export function Badge({ children, variant = 'default' }: Props) {
  const cls = variant === 'destructive'
    ? 'bg-destructive text-destructive-foreground'
    : variant === 'secondary'
    ? 'bg-secondary text-secondary-foreground'
    : 'bg-primary text-primary-foreground'
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs', cls)}>{children}</span>
}

