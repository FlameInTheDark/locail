import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Layers, FolderGit2, SquareAsterisk, PlayCircle, Settings } from 'lucide-react'

type LayoutProps = { children: React.ReactNode }

const nav = [
  { to: '/projects', label: 'Projects', icon: FolderGit2 },
  { to: '/providers', label: 'Providers', icon: Settings },
  { to: '/jobs', label: 'Jobs', icon: PlayCircle },
]

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-slate-50 text-slate-900">
      <aside className="border-r border-slate-200 bg-white">
        <div className="h-12 flex items-center gap-2 px-3 font-semibold">
          <Layers className="h-4 w-4"/> locail
        </div>
        <nav className="px-2 py-2 grid gap-1">
          {nav.map(item => {
            const active = pathname === item.to
            const Icon = item.icon
            return (
              <Link key={item.to} to={item.to} className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 ${active ? 'bg-slate-100' : 'hover:bg-slate-100'}`}>
                <Icon className="h-4 w-4"/> {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 h-12 px-4 flex items-center justify-between bg-white/90 backdrop-blur">
          <div className="text-sm text-slate-500">LLM Translation Toolkit</div>
          <div className="text-xs text-slate-400">Shadcn + Wails</div>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </div>
  )
}
