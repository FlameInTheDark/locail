import React, { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { Plus, RefreshCw, TestTube2, Bot, Link2, KeyRound } from 'lucide-react'
import * as ProviderAPI from '../../wailsjs/go/app/ProviderAPI'

type Provider = {
  id: number
  type: 'ollama' | 'openrouter' | string
  name: string
  base_url?: string
  model?: string
  api_key?: string
}

export default function ProvidersPage() {
  const [list, setList] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Provider>({ id: 0, type: 'ollama', name: '', base_url: '', model: '', api_key: '' } as any)
  const [models, setModels] = useState<ModelOpt[]>([])
  const [modelsFor, setModelsFor] = useState<number | null>(null)
  type ModelOpt = { name: string, label: string }
  const [previewModels, setPreviewModels] = useState<ModelOpt[]>([])
  const [modelFilter, setModelFilter] = useState('')
  const [modelsLoading, setModelsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Provider | null>(null)
  type TestResult = { ok?: boolean; translation?: string; raw?: string; error?: string; loading?: boolean }
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({})

  const load = async () => {
    setLoading(true)
    try {
      const items = await (ProviderAPI as any).List()
      setList(items || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const create = async () => {
    await (ProviderAPI as any).Create({ ...form })
    setForm({ id: 0, type: 'ollama', name: '', base_url: '', model: '' } as any)
    await load()
  }

  const test = async (id: number) => {
    setTestResults(prev => ({ ...prev, [id]: { loading: true } }))
    try {
      const res = await (ProviderAPI as any).Test(id)
      // Wails may return PascalCase keys from Go; normalize to camelCase for UI
      const result: TestResult = {
        ok: res?.ok ?? res?.Ok ?? false,
        translation: res?.translation ?? res?.Translation ?? '',
        raw: res?.raw ?? res?.Raw ?? '',
        error: res?.error ?? res?.Error ?? undefined,
        loading: false,
      }
      setTestResults(prev => ({ ...prev, [id]: result }))
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, error: String(e?.message || e), loading: false } }))
    }
  }

  const fetchModels = async (id: number) => {
    const res = await (ProviderAPI as any).ListModels(id)
    const list = (res || []).map((m: any) => ({ name: (m?.Name ?? m?.name), label: (m?.Description ?? m?.description ?? (m?.Name ?? m?.name)) }))
    setModelsFor(id)
    setModels(list)
  }

  const startEdit = (p: Provider) => {
    setEditing({ ...p })
  }

  const saveEdit = async () => {
    if (!editing) return
    await (ProviderAPI as any).Update({ ...editing })
    setEditing(null)
    await load()
  }

  const remove = async (id: number) => {
    if (!confirm('Delete provider?')) return
    await (ProviderAPI as any).Delete(id)
    await load()
  }

  const fetchPreviewModels = async () => {
    // Require minimal fields for preview
    try {
      setFormError(null)
      if (!form.base_url) {
        setFormError('Base URL is required')
        return
      }
      if (form.type === 'openrouter' && !(form as any).api_key) {
        setFormError('API Key is required for OpenRouter')
        return
      }
      setModelsLoading(true)
      const fn = (ProviderAPI as any).ListModelsPreview
      if (typeof fn !== 'function') {
        setFormError('Model preview not available. Save the provider first, then click Models.')
        return
      }
      const res = await fn({ ...form })
      const list = (res || []).map((m: any) => ({ name: (m?.Name ?? m?.name), label: (m?.Description ?? m?.description ?? (m?.Name ?? m?.name)) })).filter((x:any)=>x.name)
      setPreviewModels(list)
    } catch (e: any) {
      setFormError(String(e?.message || e))
    } finally { setModelsLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Providers</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New Provider</CardTitle>
          <CardDescription>Configure an LLM provider and default model.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <label className="text-sm">Type</label>
          <Select name="type" value={form.type} onChange={onChange}>
            <option value="ollama">Ollama</option>
            <option value="openrouter">OpenRouter</option>
          </Select>
          <label className="text-sm">Name</label>
          <Input name="name" value={form.name} onChange={onChange} placeholder="My Provider" />
          <label className="text-sm">Base URL</label>
          <Input name="base_url" value={(form as any).base_url || ''} onChange={onChange} placeholder="http://localhost:11434 or https://openrouter.ai" />
          <label className="text-sm">Model</label>
          {previewModels.length > 0 ? (
            <Select name="model" value={(form as any).model || ''} onChange={onChange}>
              <option value="">Select a model</option>
              {(previewModels.filter(m => (m.label || '').toLowerCase().includes(modelFilter.toLowerCase()))).map(m => (
                <option key={m.name} value={m.name}>{m.label}</option>
              ))}
            </Select>
          ) : (
            <Input name="model" value={(form as any).model || ''} onChange={onChange} placeholder="e.g., llama3.1 or openrouter model" />
          )}
          {form.type === 'openrouter' && (
            <>
              <label className="text-sm">API Key</label>
              <Input name="api_key" value={(form as any).api_key || ''} onChange={onChange} placeholder="sk-..." />
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={fetchPreviewModels} disabled={modelsLoading}>{modelsLoading ? 'Loading…' : 'Fetch Models'}</Button>
                <Input value={modelFilter} onChange={e => setModelFilter(e.target.value)} placeholder="Filter by name" className="h-9 max-w-60" />
              </div>
              {previewModels.length === 0 && !modelsLoading && formError === null && (
                <div className="text-xs text-muted-foreground">No models loaded yet</div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={create}><Plus className="h-4 w-4 mr-2"/>Create</Button>
        </CardFooter>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map(p => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4"/>{p.name} <span className="text-xs text-muted-foreground">({p.type})</span></CardTitle>
              <CardDescription className="flex items-center gap-2"><Link2 className="h-3 w-3"/>{p.base_url} · {p.model}</CardDescription>
            </CardHeader>
            <CardContent>
              {editing?.id === p.id ? (
                <div className="grid gap-2">
                  <Input value={editing.name || ''} onChange={e => setEditing(prev => ({ ...(prev as any), name: e.target.value }) as any)} placeholder="Name" />
                  <Input value={(editing as any).base_url || ''} onChange={e => setEditing(prev => ({ ...(prev as any), base_url: e.target.value }) as any)} placeholder="Base URL" />
                  {modelsFor === p.id && models.length > 0 ? (
                    <Select value={(editing as any).model || ''} onChange={e => setEditing(prev => ({ ...(prev as any), model: e.target.value }) as any)}>
                      <option value="">Select a model</option>
                      {models.map(m => (<option key={m.name} value={m.name}>{m.label}</option>))}
                    </Select>
                  ) : (
                    <Input value={(editing as any).model || ''} onChange={e => setEditing(prev => ({ ...(prev as any), model: e.target.value }) as any)} placeholder="Model (ID)" />
                  )}
                  {editing.type === 'openrouter' && (
                    <Input value={(editing as any).api_key || ''} onChange={e => setEditing(prev => ({ ...(prev as any), api_key: e.target.value }) as any)} placeholder="API Key" />
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <KeyRound className="h-3 w-3"/> API key hidden
                </div>
              )}
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              {editing?.id === p.id ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveEdit}>Save</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchModels(p.id)}>Models</Button>
                  <Button variant="secondary" size="sm" onClick={() => test(p.id)}><TestTube2 className="h-4 w-4 mr-2"/>Test</Button>
                  <Button variant="outline" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                </div>
              )}
              <Button variant="destructive" size="sm" onClick={() => remove(p.id)}>Delete</Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {list.map(p => (
        testResults[p.id] ? (
          <Card key={p.id+':test'} className="bg-muted/20">
            <CardHeader>
              <CardTitle>Test: {p.name} ({p.type})</CardTitle>
              <CardDescription>Translates "hello" to Russian and shows raw output or error.</CardDescription>
            </CardHeader>
            <CardContent>
              {testResults[p.id].loading ? (
                <div className="text-sm text-muted-foreground">Testing…</div>
              ) : testResults[p.id].ok ? (
                <div className="grid gap-1 text-sm">
                  <div><span className="text-muted-foreground">Translation:</span> {testResults[p.id].translation || '—'}</div>
                  {testResults[p.id].raw && (
                    <pre className="mt-1 whitespace-pre-wrap text-xs p-2 rounded-md bg-background border overflow-auto max-h-48">{testResults[p.id].raw}</pre>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-sm text-red-600">Test failed</div>
                  {testResults[p.id].error && (
                    <pre className="mt-1 whitespace-pre-wrap text-xs p-2 rounded-md bg-background border overflow-auto max-h-60">{testResults[p.id].error}</pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null
      ))}
    </div>
  )
}
