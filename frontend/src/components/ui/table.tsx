import * as React from 'react'
import { cn } from '../../lib/utils'

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-sm', className)} {...props} />
}
export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-muted/60 sticky top-0 z-10', className)} {...props} />
}
export function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) { return <tbody className={cn('', className)} {...props} /> }
export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) { return <tr className={cn('border-t hover:bg-muted/20', className)} {...props} /> }
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('text-left px-3 py-2 font-medium', className)} {...props} />
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) { return <td className={cn('px-3 py-2 align-top', className)} {...props} /> }

