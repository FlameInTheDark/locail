import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import EmptyState from '../components/EmptyState'
import { FolderKanban, Plus, RefreshCw } from 'lucide-react'
import * as ProjectAPI from '../../wailsjs/go/app/ProjectAPI'

type Project = { id: number; name: string; source_lang?: string }
type Locale = { id: number; project_id: number; locale: string }

export default function ProjectsPage() {
  const [list, setList] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [newLocale, setNewLocale] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const [locales, setLocales] = useState<Locale[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await (ProjectAPI as any).List()
      setList(res || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    await (ProjectAPI as any).Create(name, source)
    setName(''); setSource('')
    await load()
  }

  const open = async (p: Project) => {
    setSelected(p)
    const ls = await (ProjectAPI as any).ListLocales(p.id)
    setLocales(ls || [])
  }

  const addLocale = async () => {
    if (!selected || !newLocale) return
    await (ProjectAPI as any).AddLocale(selected.id, newLocale)
    setNewLocale('')
    await open(selected)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Create Project</CardTitle>
          <CardDescription>Define a project and its source language.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <label className="text-sm">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="My App" />
          <label className="text-sm">Source Language (e.g., en, ru)</label>
          <Input value={source} onChange={e => setSource(e.target.value)} placeholder="en" />
          <Button onClick={create} className="w-fit"><Plus className="h-4 w-4 mr-2"/>Create</Button>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <EmptyState icon={<FolderKanban className="h-8 w-8 text-muted-foreground"/>} title="No projects yet" subtitle="Create your first project to begin." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map(p => (
            <Card key={p.id}>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>Source: {p.source_lang || 'n/a'}</CardDescription>
                </div>
                <Link to={`/projects/${p.id}/files`} className="text-sm underline">Open</Link>
              </CardHeader>
              <CardContent className="grid gap-2">
                {selected?.id === p.id ? (
                  <>
                    <div className="text-sm font-medium">Locales</div>
                    <div className="flex flex-wrap gap-2">
                      {locales.map(l => (<span key={l.id} className="px-2 py-1 text-xs rounded-md border bg-muted">{l.locale}</span>))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value={newLocale} onChange={e => setNewLocale(e.target.value)} placeholder="Add locale (e.g., de)" className="max-w-40" />
                      <Button variant="outline" size="sm" onClick={addLocale}>Add</Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => open(p)}>View locales</Button>
                    <Button variant="destructive" size="sm" onClick={async () => { if (confirm('Delete project and related data?')) { await (ProjectAPI as any).Delete(p.id); await load() } }}>Delete</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
