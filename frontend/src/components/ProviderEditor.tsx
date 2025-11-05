import React, { useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Trash2, Save as SaveIcon, Play, RefreshCw } from 'lucide-react'
import * as ProviderAPI from '../../wailsjs/go/app/ProviderAPI'
import ModelDropdown from './ModelDropdown'
import ConfirmModal from './ConfirmModal'

export type ProviderInfo = {
  id: number
  type: string
  name: string
  base_url?: string
  model?: string
  api_key?: string
  options_json?: string
}

type Props = {
  provider: ProviderInfo | null
  onCreate: (data: Omit<ProviderInfo, 'id'>) => Promise<void>
  onUpdate: (data: ProviderInfo) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onTest?: (id: number) => Promise<void>
}

const defaultTypes = ['openrouter', 'ollama']

export default function ProviderEditor({ provider, onCreate, onUpdate, onDelete, onTest }: Props) {
  const creating = provider == null
  const [form, setForm] = useState<Omit<ProviderInfo, 'id'>>({
    name: '',
    type: defaultTypes[0],
    base_url: '',
    model: '',
    api_key: '',
    options_json: '',
  })

  useEffect(() => {
    if (!creating && provider) {
      setForm({
        name: provider.name || '',
        type: provider.type || defaultTypes[0],
        base_url: provider.base_url || '',
        model: provider.model || '',
        api_key: provider.api_key || '',
        options_json: provider.options_json || '',
      })
    } else if (creating) {
      setForm({ name: '', type: defaultTypes[0], base_url: '', model: '', api_key: '', options_json: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, provider?.id])

  const canSave = useMemo(() => form.name.trim().length > 0 && form.type.trim().length > 0, [form.name, form.type])
  const dirty = useMemo(() => {
    if (!provider) return true
    return (
      (provider.name || '') !== form.name ||
      (provider.type || '') !== form.type ||
      (provider.base_url || '') !== form.base_url ||
      (provider.model || '') !== form.model ||
      (form.api_key && !form.api_key.startsWith('****')) ||
      (provider.options_json || '') !== (form.options_json || '')
    )
  }, [provider, form])

  const [models, setModels] = useState<Array<{ Name: string; Description: string; ContextTokens: number }>>([])
  const [loadingModels, setLoadingModels] = useState(false)

  const loadModels = async () => {
    try {
      setLoadingModels(true)
      let resp: any[] = []
      if (provider && !dirty) {
        resp = await (ProviderAPI as any).ListModels(provider.id)
      } else {
        const preview = {
          id: 0,
          type: form.type,
          name: form.name || 'temp',
          base_url: form.base_url,
          model: form.model,
          api_key: form.api_key,
          options_json: form.options_json,
        }
        resp = await (ProviderAPI as any).ListModelsPreview(preview)
      }
      setModels(resp || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingModels(false)
    }
  }

  const submit = async () => {
    if (!canSave) return
    if (creating) await onCreate(form)
    else await onUpdate({ ...(provider as any), ...form })
  }

  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{creating ? 'Add Provider' : `Edit Provider: ${provider?.name}`}</CardTitle>
        <CardDescription>{creating ? 'Define a provider to enable AI translations.' : 'Update provider settings or test connection.'}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input id="pname" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="My OpenAI" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ptype">Type</Label>
            <select id="ptype" className="h-9 border rounded-md px-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}>
              {defaultTypes.map(t => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
        </div>
        <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="purl">Base URL</Label>
            <Input id="purl" value={form.base_url} onChange={e => setForm(prev => ({ ...prev, base_url: e.target.value }))} placeholder="https://api.openai.com/v1 or http://localhost:11434" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pmodel">Model</Label>
            {models.length > 0 ? (
              <ModelDropdown
                value={form.model || ''}
                options={models.map(m => ({ value: m.Name, label: m.Description || m.Name, tokens: m.ContextTokens }))}
                onChange={(val) => setForm(prev => ({ ...prev, model: val }))}
                onRefresh={loadModels}
                loading={loadingModels}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Input id="pmodel" value={form.model} onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))} placeholder="gpt-4o-mini or llama3.1" />
                <button type="button" className="p-2 rounded-md border hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800" title="Load models" onClick={loadModels} disabled={loadingModels}>
                  <RefreshCw className={`h-4 w-4 ${loadingModels ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">Use “Load models” to discover available models for this provider.</div>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pkey">API Key</Label>
          <Input id="pkey" type="password" value={form.api_key} onChange={e => setForm(prev => ({ ...prev, api_key: e.target.value }))} placeholder="sk-..." />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="popt">Options (JSON)</Label>
          <textarea id="popt" className="w-full rounded-md border px-2 py-1 min-h-[80px] font-mono text-xs dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.options_json} onChange={e => setForm(prev => ({ ...prev, options_json: e.target.value }))} placeholder="{ }" />
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Button onClick={submit} disabled={!canSave}><SaveIcon className="h-4 w-4 mr-2"/>Save</Button>
          {!creating && (
            <>
              {onTest && <Button variant="outline" onClick={() => provider && onTest(provider.id)} disabled={creating || dirty}><Play className="h-4 w-4 mr-2"/>Test</Button>}
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}><Trash2 className="h-4 w-4 mr-2"/>Delete</Button>
            </>
          )}
        </div>
        <ConfirmModal
          open={confirmOpen}
          title="Delete Provider"
          message={`Delete provider "${provider?.name}"?`}
          confirmText="Delete"
          onClose={() => setConfirmOpen(false)}
          onConfirm={async () => { if (provider) await onDelete(provider.id) }}
        />
      </CardContent>
    </Card>
  )
}
