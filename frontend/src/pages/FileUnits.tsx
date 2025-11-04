import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Progress } from '../components/ui/progress'
import { Checkbox } from '../components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/table'
import * as TranslationsAPI from '../../wailsjs/go/app/TranslationsAPI'
import * as JobsAPI from '../../wailsjs/go/app/JobsAPI'
import * as ProviderAPI from '../../wailsjs/go/app/ProviderAPI'

type UnitText = { unit_id: number; key: string; source: string; translation: string; status: string }
type Provider = { id: number; type: string; name: string; base_url?: string; model?: string }
type JobDTO = { id: number; type: string; status: string; progress: number; total: number }

export default function FileUnitsPage() {
  const { fileId } = useParams()
  const fID = useMemo(() => Number(fileId), [fileId])
  const [locale, setLocale] = useState('en')
  const [rows, setRows] = useState<UnitText[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [providerID, setProviderID] = useState<number | undefined>(undefined)
  const [model, setModel] = useState('')
  const [targetLocales, setTargetLocales] = useState('')
  const [jobs, setJobs] = useState<JobDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<number | null>(null)
  const [jobProgress, setJobProgress] = useState<{done:number,total:number,status:string,model?:string}>({done:0,total:0,status:'idle'})
  const [currentItem, setCurrentItem] = useState<{key?:string,locale?:string,model?:string}>({})
  const [lastResult, setLastResult] = useState<{key?:string,locale?:string,text?:string,error?:string,model?:string}>({})
  const [logLines, setLogLines] = useState<{ts:string,level:string,message:string}[]>([])
  const [missingOnly, setMissingOnly] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const loadRows = async () => {
    if (!fID) return
    setLoading(true)
    try {
      const list = await (TranslationsAPI as any).ListUnitTexts(fID, locale)
      setRows(list || [])
    } finally { setLoading(false) }
  }

  const loadProviders = async () => {
    const res = await (ProviderAPI as any).List()
    setProviders(res || [])
    if (!providerID && res && res.length) setProviderID(res[0].id)
  }

  const loadJobs = async () => {
    const res = await (JobsAPI as any).List(10)
    setJobs(res || [])
  }

  useEffect(() => { loadProviders() }, [])
  useEffect(() => { loadRows() }, [fID, locale])
  useEffect(() => { loadJobs() }, [])

  useEffect(() => {
    const rt = (window as any).runtime
    if (!rt?.EventsOn) return
    const off1 = rt.EventsOn('job.started', (p: any) => {
      setCurrentJobId(p?.job_id ?? null)
      setJobProgress({done:0,total:p?.total||0,status:'running', model: p?.model})
    })
    const off2 = rt.EventsOn('job.progress', (p: any) => {
      if (currentJobId && p?.job_id !== currentJobId) return
      setJobProgress({done: p?.done||0, total: p?.total||0, status: p?.status||'running', model: p?.model})
    })
    const off3 = rt.EventsOn('job.item.start', (p: any) => {
      if (currentJobId && p?.job_id !== currentJobId) return
      setCurrentItem({ key: p?.key, locale: p?.locale, model: p?.model })
    })
    const off4 = rt.EventsOn('job.item.done', (p: any) => {
      if (currentJobId && p?.job_id !== currentJobId) return
      setLastResult({ key: p?.key, locale: p?.locale, text: p?.text, error: p?.error, model: p?.model })
      if (p?.unit_id && p?.text) {
        setRows(prev => prev.map(x => x.unit_id === p.unit_id ? { ...x, translation: p.text } : x))
      }
    })
    const off5 = rt.EventsOn('job.log', (p: any) => {
      if (currentJobId && p?.job_id !== currentJobId) return
      setLogLines(prev => [...prev.slice(-200), { ts: p?.ts || '', level: p?.level || 'info', message: p?.message || '' }])
    })
    return () => {
      try { rt.EventsOff('job.started','job.progress','job.item.start','job.item.done') } catch {}
      if (typeof off1 === 'function') off1()
      if (typeof off2 === 'function') off2()
      if (typeof off3 === 'function') off3()
      if (typeof off4 === 'function') off4()
      if (typeof off5 === 'function') off5()
    }
  }, [currentJobId])

  const saveRow = async (u: UnitText) => {
    await (TranslationsAPI as any).Upsert({ unit_id: u.unit_id, locale, text: u.translation, status: 'edited' })
    await loadRows()
  }

  const startTranslate = async () => {
    if (!providerID || !fID) return
    const locales = targetLocales.split(',').map(s => s.trim()).filter(Boolean)
    if (locales.length === 0 && locale) locales.push(locale)
    await (JobsAPI as any).StartTranslateFile({ project_id: 0, provider_id: providerID, file_id: fID, locales, model })
    await loadJobs()
    setCurrentJobId(null)
    setJobProgress({done:0,total:0,status:'running', model})
  }

  const filteredRows = (rows || [])
    .filter(r => !missingOnly || !r.translation)
    .filter(r => !query || r.key.toLowerCase().includes(query.toLowerCase()) || r.source.toLowerCase().includes(query.toLowerCase()))
  const allSelected = filteredRows.length>0 && filteredRows.every(r => selected.has(r.unit_id))
  const toggleRow = (id: number, v: boolean) => setSelected(prev => { const s = new Set(prev); if (v) s.add(id); else s.delete(id); return s })
  const toggleAll = (v: boolean) => setSelected(prev => { const s = new Set(prev); if (v) filteredRows.forEach(r=>s.add(r.unit_id)); else filteredRows.forEach(r=>s.delete(r.unit_id)); return s })

  const translateSelected = async () => {
    if (!providerID) return
    const ids = Array.from(selected)
    const locales = (targetLocales || '').split(',').map(s => s.trim()).filter(Boolean)
    if (locales.length === 0 && locale) locales.push(locale)
    if (locales.length === 0) return
    for (const uid of ids) {
      try {
        await (JobsAPI as any).StartTranslateUnit({ project_id: 0, provider_id: providerID, unit_id: uid, locales, model })
      } catch (e) { console.error(e) }
    }
    await loadJobs()
    setCurrentJobId(null)
    setLogLines([])
  }

  return (
    <div className="space-y-6">
      {(jobProgress.total>0 || currentItem.key || lastResult.key) && (
        <div className="border rounded-xl p-3 bg-white">
          <div className="flex items-center justify-between text-sm">
            <div>Progress: {jobProgress.done}/{jobProgress.total} · {jobProgress.status} {jobProgress.model ? `· model: ${jobProgress.model}` : ''}</div>
            <div className="w-48"><Progress value={jobProgress.done} max={jobProgress.total || 100} /></div>
          </div>
          {currentItem.key && (
            <div className="text-sm mt-1">Translating: <span className="font-mono">{currentItem.key}</span> [{currentItem.locale}] {currentItem.model ? `· model: ${currentItem.model}` : ''}</div>
          )}
          {lastResult.key && (
            <div className="text-sm mt-2">
              <div>Last result: <span className="font-mono">{lastResult.key}</span> [{lastResult.locale}]</div>
              {lastResult.error ? (
                <div className="text-red-600 whitespace-pre-wrap text-xs mt-1">{lastResult.error}</div>
              ) : (
                <div className="whitespace-pre-wrap text-xs mt-1">{lastResult.text}</div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm">Locale</label>
          <Input value={locale} onChange={e => setLocale(e.target.value)} className="w-32" />
        </div>
        <div>
          <label className="text-sm">Filter</label>
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search key or source" className="w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={missingOnly} onCheckedChange={setMissingOnly} label="Missing only" />
        </div>
        <Button variant="outline" onClick={loadRows} disabled={loading}>Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
          <CardDescription>Search, select, edit. Translate selected or missing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-muted-foreground">Filtered {filteredRows.length} of {rows.length} · Selected {selected.size}</div>
            <div className="flex items-center gap-3">
              <Checkbox checked={allSelected} onChange={e => toggleAll((e.target as HTMLInputElement).checked)} label={allSelected? 'Unselect all' : 'Select all'} />
              <Button size="sm" variant="secondary" onClick={translateSelected} disabled={selected.size===0 || !providerID}>Translate Selected</Button>
            </div>
          </div>
          <div className="overflow-auto max-h-[60vh] border rounded-xl">
            <Table>
              <Thead>
                <Tr>
                  <Th className="w-[48px]"><Checkbox checked={allSelected} onChange={e => toggleAll((e.target as HTMLInputElement).checked)} /></Th>
                  <Th className="w-1/5">Key</Th>
                  <Th className="w-2/5">Source</Th>
                  <Th className="w-2/5">Translation</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredRows.map(u => (
                  <Tr key={u.unit_id}>
                    <Td><Checkbox checked={selected.has(u.unit_id)} onChange={e => toggleRow(u.unit_id, (e.target as HTMLInputElement).checked)} /></Td>
                    <Td className="font-mono text-xs">{u.key}</Td>
                    <Td className="whitespace-pre-wrap">{u.source}</Td>
                    <Td>
                      <Textarea
                        className="w-full h-24"
                        value={u.translation || ''}
                        onChange={(e) => setRows(prev => prev.map(x => x.unit_id === u.unit_id ? { ...x, translation: e.target.value } : x))}
                      />
                    </Td>
                    <Td>
                      <Button size="sm" onClick={() => saveRow(u)}>Save</Button>
                      <Button variant="outline" size="sm" className="ml-2" onClick={async () => {
                        if (!providerID) return
                        const locales = (targetLocales || '').split(',').map(s => s.trim()).filter(Boolean)
                        if (locales.length === 0 && locale) locales.push(locale)
                        if (locales.length === 0) return
                        try {
                          const res = await (JobsAPI as any).StartTranslateUnit({ project_id: 0, provider_id: providerID, unit_id: u.unit_id, locales, model })
                          setCurrentJobId(res?.job_id || res?.JobID || null)
                          setLogLines([])
                          await loadJobs()
                        } catch (e) { console.error(e) }
                      }}>Translate</Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Translate Missing</CardTitle>
          <CardDescription>Run a job to translate all missing entries.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Provider</label>
            <select value={providerID} onChange={e => setProviderID(Number(e.target.value))} className="h-9 border rounded-md px-2 w-full">
              {(providers || []).map(p => (<option key={p.id} value={p.id}>{p.name} ({p.type})</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm">Model</label>
            <Input value={model} onChange={e => setModel(e.target.value)} placeholder="leave blank to use provider's default" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Target Locales (comma separated)</label>
            <Input value={targetLocales} onChange={e => setTargetLocales(e.target.value)} placeholder="e.g., en,de,es" />
          </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={startTranslate}>Start Translate Job</Button>
            <Button variant="outline" onClick={loadJobs}>Refresh Jobs</Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-medium mb-2">Recent Jobs</h2>
        <div className="grid gap-2">
          {(jobs || []).map(j => (
            <div key={j.id} className="border rounded-md p-2 text-sm flex items-center justify-between">
              <div>#{j.id} · {j.type} · {j.status} · {j.progress}/{j.total}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={async ()=>{ setCurrentJobId(j.id); setLogLines([]); }}>Logs</Button>
                <Button variant="outline" size="sm" onClick={async ()=>{ await (JobsAPI as any).Cancel(j.id); }}>Stop</Button>
                <Button variant="destructive" size="sm" onClick={async ()=>{ await (JobsAPI as any).Delete(j.id); await loadJobs()}}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
        {currentJobId && (
          <div className="mt-2 border rounded-md p-2 max-h-48 overflow-auto bg-muted/10">
            {logLines.length === 0 ? (
              <div className="text-xs text-muted-foreground">No logs yet</div>
            ) : (
              logLines.map((l, i) => (
                <div key={i} className="text-xs">
                  <span className="text-muted-foreground">[{l.ts}]</span> <span className="uppercase">{l.level}</span>: {l.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white border-t py-2 px-3 text-xs text-muted-foreground rounded-t-xl">
        <div className="flex items-center justify-between">
          <div>Locale: {locale} · Filtered: {filteredRows.length}/{rows.length} · Selected: {selected.size}</div>
          <div>{jobProgress.total>0 ? `Job: ${jobProgress.done}/${jobProgress.total} ${jobProgress.status}` : 'Idle'}</div>
        </div>
      </div>
    </div>
  )
}
