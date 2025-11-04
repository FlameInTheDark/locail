import React from 'react'

type Props = { icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }

export default function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <div className="border rounded-lg p-8 text-center bg-muted/20">
      {icon && <div className="flex justify-center mb-2">{icon}</div>}
      <div className="text-lg font-medium">{title}</div>
      {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

