import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

import * as ProjectAPI from '../wailsjs/go/app/ProjectAPI'
import * as FileAPI from '../wailsjs/go/app/FileAPI'
import * as TranslationsAPI from '../wailsjs/go/app/TranslationsAPI'
import * as JobsAPI from '../wailsjs/go/app/JobsAPI'
import * as ProviderAPI from '../wailsjs/go/app/ProviderAPI'
import * as ExportAPI from '../wailsjs/go/app/ExportAPI'

const placeholderRegex = /\{[^\}]+\}|%[sdif]|:\w+/g

type ProjectRecord = {
  id: number
  name: string
  sourceLang: string
  locales: string[]
}

type FileRecord = {
  id: number
  path: string
  format?: string
  locale?: string
}

type Entry = {
  unitId: number
  key: string
  source: string
  translation: string
  draft: string
  status: string
}

type Suggestion = { label: string; value: string }

type ProviderInfo = {
  id: number
  type: string
  name: string
  base_url?: string
  model?: string
  api_key?: string
}

type ProviderSettings = {
  providerId: number | null
  providerType: string
  baseUrl: string
  model: string
  apiKeyMasked?: string
}

type TranslationOptions = {
  formality: string
  tone: string
  glossary: string
  preservePlaceholders: boolean
}

type JobProgress = {
  jobId: number | null
  done: number
  total: number
  status: string
  model?: string
}

type JobItemState = {
  key?: string
  locale?: string
  model?: string
}

type JobLastResult = {
  key?: string
  locale?: string
  text?: string
  error?: string
  model?: string
}

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n)
}

function collectPlaceholders(text?: string | null) {
  if (!text) return [] as string[]
  const matches = text.match(placeholderRegex) || []
  return Array.from(new Set(matches))
}

function placeholdersOk(src?: string, tgt?: string) {
  const srcTokens = collectPlaceholders(src)
  const tgtTokens = collectPlaceholders(tgt)
  return srcTokens.every(token => tgtTokens.includes(token))
}

function download(filename: string, data: string, mime = 'application/json;charset=utf-8') {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function downloadBase64(filename: string, base64: string, mime = 'application/octet-stream') {
  if (!base64) return
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

type TranslationRowProps = {
  entry: Entry
  targetLang: string
  value: string
  suggestions: Suggestion[]
  checked: boolean
  onToggle: (checked: boolean) => void
  onChange: (value: string) => void
  onSuggestion: (value: string) => void
}

function TranslationRow({ entry, targetLang, value, suggestions, checked, onToggle, onChange, onSuggestion }: TranslationRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  return (
    <tr data-key={entry.key} data-source={entry.source}>
      <td className="px-3 py-2 align-top">
        <input type="checkbox" className="row-check rounded" checked={checked} onChange={event => onToggle(event.target.checked)} />
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs text-slate-700 truncate key">{entry.key}</td>
      <td className="px-3 py-2 align-top text-slate-800 source">{entry.source}</td>
      <td className="px-3 py-2 align-top text-slate-500 old">{entry.translation || '—'}</td>
      <td className="px-3 py-2 align-top">
        <textarea
          ref={textareaRef}
          className="tgt w-full rounded-xl border-slate-300 px-2 py-1 leading-6"
          rows={1}
          placeholder="Type translation…"
          value={value}
          onChange={event => onChange(event.target.value)}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <select
          className="suggest w-full rounded-xl border-slate-300"
          value=""
          onChange={event => {
            const val = event.target.value
            if (!val) return
            onSuggestion(val)
          }}
        >
          <option value="" disabled>
            Suggestions…
          </option>
          {suggestions.map(option => (
            <option key={`${entry.unitId}-${option.label}`} value={option.value}>
              {option.label}: {option.value.length > 40 ? `${option.value.slice(0, 40)}…` : option.value}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top text-xs checks">
        {placeholdersOk(entry.source, value) ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Placeholders ✓
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Check placeholders
          </span>
        )}
      </td>
    </tr>
  )
}

function useTranslationMemory() {
  const memoryRef = useRef<Map<string, string>>(new Map())
  const set = useCallback((key: string, value: string) => {
    memoryRef.current.set(key, value)
  }, [])
  const get = useCallback((key: string) => memoryRef.current.get(key), [])
  const toJSON = useCallback(() => {
    const obj: Record<string, string> = {}
    memoryRef.current.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  }, [])
  return { set, get, toJSON }
}

function useKeyboardShortcuts(onFocusSearch: () => void, onSave: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const active = document.activeElement
      const tag = active?.tagName
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        event.preventDefault()
        onFocusSearch()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        onSave()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onFocusSearch, onSave])
}

type FileStats = Record<number, { total: number; translated: number }>

function App() {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [fileStats, setFileStats] = useState<FileStats>({})
  const [entries, setEntries] = useState<Entry[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [targetLang, setTargetLang] = useState('')
  const [search, setSearch] = useState('')
  const [onlyUntranslated, setOnlyUntranslated] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('Ready.')
  const [activeTab, setActiveTab] = useState<'projects' | 'files' | 'settings'>('projects')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({
    providerId: null,
    providerType: '',
    baseUrl: '',
    model: '',
    apiKeyMasked: '',
  })
  const [translationOptions, setTranslationOptions] = useState<TranslationOptions>({
    formality: 'auto',
    tone: 'neutral',
    glossary: '',
    preservePlaceholders: true,
  })
  const [jobProgress, setJobProgress] = useState<JobProgress>({ jobId: null, done: 0, total: 0, status: 'idle' })
  const [currentItem, setCurrentItem] = useState<JobItemState>({})
  const [lastResult, setLastResult] = useState<JobLastResult>({})

  const importInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const memory = useTranslationMemory()

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )
  const srcLang = selectedProject?.sourceLang || 'en'
  const availableLanguages = useMemo(() => {
    if (!selectedProject) return []
    const set = new Set<string>()
    if (selectedProject.sourceLang) set.add(selectedProject.sourceLang)
    selectedProject.locales.forEach(loc => {
      if (loc) set.add(loc)
    })
    return Array.from(set)
  }, [selectedProject])
  const selectedFile = useMemo(
    () => files.find(f => f.id === selectedFileId) ?? null,
    [files, selectedFileId],
  )

  const loadProjects = useCallback(async () => {
    setStatus('Loading projects…')
    try {
      const res = await (ProjectAPI as any).List()
      const list: ProjectRecord[] = []
      for (const p of res || []) {
        let locales: string[] = []
        try {
          const locs = await (ProjectAPI as any).ListLocales(p.id)
          locales = (locs || []).map((l: any) => l.locale).filter(Boolean)
        } catch (err) {
          console.error(err)
        }
        list.push({ id: p.id, name: p.name, sourceLang: p.source_lang || '', locales })
      }
      setProjects(list)
      if (list.length === 0) {
        setSelectedProjectId(null)
      } else {
        setSelectedProjectId(prev => (prev && list.some(p => p.id === prev) ? prev : list[0].id))
      }
      setStatus(`Loaded ${list.length} project${list.length === 1 ? '' : 's'}.`)
    } catch (error: any) {
      console.error(error)
      setStatus(`Failed to load projects: ${String(error?.message || error)}`)
    }
  }, [])

  const loadFiles = useCallback(async (projectId: number) => {
    setStatus('Loading files…')
    try {
      const res = await (FileAPI as any).ListByProject(projectId)
      const list: FileRecord[] = (res || []).map((f: any) => ({ id: f.id, path: f.path, format: f.format, locale: f.locale }))
      setFiles(list)
      setSelectedFileId(prev => (prev && list.some(f => f.id === prev) ? prev : list[0]?.id ?? null))
      setStatus(`Loaded ${list.length} file${list.length === 1 ? '' : 's'}.`)
    } catch (error: any) {
      console.error(error)
      setFiles([])
      setSelectedFileId(null)
      setStatus(`Failed to load files: ${String(error?.message || error)}`)
    }
  }, [])

  const loadEntries = useCallback(async (fileId: number | null, locale: string) => {
    if (!fileId || !locale) {
      setEntries([])
      setSelection(new Set())
      setDirty(false)
      return
    }
    setStatus('Loading units…')
    try {
      const res = await (TranslationsAPI as any).ListUnitTexts(fileId, locale)
      const list: Entry[] = (res || []).map((u: any) => ({
        unitId: u.unit_id,
        key: u.key,
        source: u.source,
        translation: u.translation || '',
        draft: u.translation || '',
        status: u.status || '',
      }))
      setEntries(list)
      setSelection(new Set())
      list.forEach(entry => {
        if (entry.translation.trim()) {
          memory.set(`${entry.source}|${locale}`, entry.translation)
        }
      })
      setFileStats(prev => ({
        ...prev,
        [fileId]: { total: list.length, translated: list.filter(entry => entry.translation.trim() !== '').length },
      }))
      setDirty(false)
      setStatus(`Loaded ${list.length} unit${list.length === 1 ? '' : 's'}.`)
    } catch (error: any) {
      console.error(error)
      setEntries([])
      setSelection(new Set())
      setStatus(`Failed to load units: ${String(error?.message || error)}`)
    }
  }, [memory])

  const loadProviders = useCallback(async () => {
    try {
      const res = await (ProviderAPI as any).List()
      const list: ProviderInfo[] = res || []
      setProviders(list)
      if (list.length === 0) {
        setProviderSettings({ providerId: null, providerType: '', baseUrl: '', model: '', apiKeyMasked: '' })
      } else {
        setProviderSettings(prev => {
          const existing = prev.providerId ? list.find(p => p.id === prev.providerId) : undefined
          const provider = existing ?? list[0]
          return {
            providerId: provider.id,
            providerType: provider.type || '',
            baseUrl: provider.base_url || '',
            model: provider.model || '',
            apiKeyMasked: provider.api_key || '',
          }
        })
      }
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    loadProjects()
    loadProviders()
  }, [loadProjects, loadProviders])

  useEffect(() => {
    if (selectedProjectId != null) {
      loadFiles(selectedProjectId)
    } else {
      setFiles([])
      setSelectedFileId(null)
      setEntries([])
    }
  }, [selectedProjectId, loadFiles])

  useEffect(() => {
    if (!selectedProject) {
      setTargetLang('')
      return
    }
    const targets = availableLanguages.filter(lang => lang !== srcLang)
    if (targets.length === 0) {
      setTargetLang(srcLang)
      return
    }
    if (!targetLang || (targetLang === srcLang && targets.length > 0) || !targets.includes(targetLang)) {
      setTargetLang(targets[0])
    }
  }, [selectedProject, availableLanguages, srcLang, targetLang])

  useEffect(() => {
    if (selectedFileId && targetLang) {
      loadEntries(selectedFileId, targetLang)
    } else {
      setEntries([])
      setSelection(new Set())
      setDirty(false)
    }
  }, [selectedFileId, targetLang, loadEntries])

  useEffect(() => {
    const rt = (window as any).runtime
    if (!rt?.EventsOn) return
    const offStarted = rt.EventsOn('job.started', (payload: any) => {
      const jobId = payload?.job_id
      if (!jobId) return
      setJobProgress({ jobId, done: 0, total: payload?.total || 0, status: 'running', model: payload?.model })
      setStatus(`Job #${jobId} started (${payload?.total || 0} items).`)
    })
    const offProgress = rt.EventsOn('job.progress', (payload: any) => {
      const jobId = payload?.job_id
      if (!jobId) return
      setJobProgress(prev => ({
        jobId,
        done: payload?.done ?? prev.done,
        total: payload?.total ?? prev.total,
        status: payload?.status || prev.status,
        model: payload?.model || prev.model,
      }))
    })
    const offItemStart = rt.EventsOn('job.item.start', (payload: any) => {
      setCurrentItem({ key: payload?.key, locale: payload?.locale, model: payload?.model })
      if (payload?.key && payload?.locale === targetLang) {
        setStatus(`Translating ${payload.key} (${payload.locale})…`)
      }
    })
    const offItemDone = rt.EventsOn('job.item.done', (payload: any) => {
      setLastResult({ key: payload?.key, locale: payload?.locale, text: payload?.text, error: payload?.error, model: payload?.model })
      if (!payload?.unit_id || payload?.locale !== targetLang) return
      setEntries(prev => {
        const next = prev.map(entry => {
          if (entry.unitId === payload.unit_id) {
            const text = payload?.text ?? entry.translation
            const updated: Entry = {
              ...entry,
              translation: text,
              draft: text,
              status: payload?.error ? entry.status : 'machine',
            }
            if (text?.trim()) {
              memory.set(`${updated.source}|${targetLang}`, text)
            }
            return updated
          }
          return entry
        })
        const translatedCount = next.filter(entry => entry.translation.trim() !== '').length
        if (selectedFileId) {
          setFileStats(fs => ({ ...fs, [selectedFileId]: { total: next.length, translated: translatedCount } }))
        }
        setDirty(next.some(entry => entry.draft !== entry.translation))
        if (payload?.error) {
          setStatus(`Translation failed for ${payload.key || payload.unit_id}: ${payload.error}`)
        } else if (payload?.text) {
          setStatus(`Translated ${payload.key || payload.unit_id}.`)
        }
        return next
      })
    })
    const offLog = rt.EventsOn('job.log', (payload: any) => {
      if (!payload?.message) return
      setStatus(`Job log: ${payload.message}`)
    })
    return () => {
      try { rt.EventsOff('job.started', 'job.progress', 'job.item.start', 'job.item.done', 'job.log') } catch (err) { console.error(err) }
      if (typeof offStarted === 'function') offStarted()
      if (typeof offProgress === 'function') offProgress()
      if (typeof offItemStart === 'function') offItemStart()
      if (typeof offItemDone === 'function') offItemDone()
      if (typeof offLog === 'function') offLog()
    }
  }, [targetLang, selectedFileId, memory])

  const entriesList = entries
  const filteredEntries = useMemo(() => {
    let list = entriesList
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(entry => {
        return (
          entry.key.toLowerCase().includes(q) ||
          entry.source.toLowerCase().includes(q) ||
          entry.draft.toLowerCase().includes(q) ||
          entry.translation.toLowerCase().includes(q)
        )
      })
    }
    if (onlyUntranslated) {
      list = list.filter(entry => {
        const current = (entry.draft || entry.translation || '').trim()
        return current === ''
      })
    }
    return list
  }, [entriesList, search, onlyUntranslated])

  const suggestionsFor = useCallback(
    (entry: Entry): Suggestion[] => {
      const list: Suggestion[] = []
      if (entry.translation && entry.translation !== entry.draft) {
        list.push({ label: 'Saved', value: entry.translation })
      }
      const mem = memory.get(`${entry.source}|${targetLang}`)
      if (mem && mem !== entry.draft && mem !== entry.translation) {
        list.push({ label: 'Memory', value: mem })
      }
      if (entry.source && entry.source !== entry.draft) {
        list.push({ label: 'Copy source', value: entry.source })
      }
      if (!list.length && entry.translation) {
        list.push({ label: 'Saved', value: entry.translation })
      }
      return list
    },
    [memory, targetLang],
  )

  const handleEntryChange = useCallback((entry: Entry, value: string) => {
    setEntries(prev => {
      const next = prev.map(item => (item.unitId === entry.unitId ? { ...item, draft: value } : item))
      setDirty(true)
      return next
    })
  }, [])

  const handleSuggestion = useCallback((entry: Entry, value: string) => {
    setEntries(prev => {
      const next = prev.map(item => (item.unitId === entry.unitId ? { ...item, draft: value } : item))
      setDirty(true)
      return next
    })
  }, [])

  const handleToggle = useCallback((entry: Entry, checked: boolean) => {
    setSelection(prev => {
      const next = new Set(prev)
      if (checked) next.add(entry.unitId)
      else next.delete(entry.unitId)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelection(new Set())
  }, [])

  const allFilteredSelected = useMemo(
    () => filteredEntries.length > 0 && filteredEntries.every(entry => selection.has(entry.unitId)),
    [filteredEntries, selection],
  )

  const handleToggleAll = useCallback(() => {
    setSelection(prev => {
      const next = new Set(prev)
      if (filteredEntries.length === 0) return next
      if (filteredEntries.every(entry => next.has(entry.unitId))) {
        filteredEntries.forEach(entry => next.delete(entry.unitId))
      } else {
        filteredEntries.forEach(entry => next.add(entry.unitId))
      }
      return next
    })
  }, [filteredEntries])

  const handleAiTranslate = useCallback(async () => {
    if (!selectedProjectId || !selectedFileId) {
      setStatus('Select a project and file before translating.')
      return
    }
    if (!providerSettings.providerId) {
      setStatus('Configure a provider in Settings first.')
      return
    }
    const locales = [targetLang].filter(Boolean)
    if (locales.length === 0) {
      setStatus('Select a target language first.')
      return
    }
    const unitIds = entries.filter(entry => selection.has(entry.unitId)).map(entry => entry.unitId)
    if (unitIds.length === 0) {
      setStatus('Select at least one row to translate.')
      return
    }
    let started = 0
    for (const unitId of unitIds) {
      try {
        const res = await (JobsAPI as any).StartTranslateUnit({
          project_id: selectedProjectId,
          provider_id: providerSettings.providerId,
          unit_id: unitId,
          locales,
          model: providerSettings.model,
        })
        const jobId = res?.job_id ?? res?.JobID
        if (jobId) {
          setJobProgress({ jobId, done: 0, total: locales.length, status: 'running', model: providerSettings.model })
        }
        started += 1
      } catch (error) {
        console.error(error)
      }
    }
    if (started > 0) {
      setStatus(`Queued ${started} translation job${started === 1 ? '' : 's'}.`)
    } else {
      setStatus('No jobs started.')
    }
  }, [entries, selection, selectedProjectId, selectedFileId, providerSettings, targetLang])

  const handleSave = useCallback(async () => {
    if (!targetLang) {
      setStatus('Select a target language before saving.')
      return
    }
    const toSave = entries.filter(entry => entry.draft !== entry.translation)
    if (toSave.length === 0) {
      setStatus('Nothing to save.')
      return
    }
    try {
      for (const entry of toSave) {
        await (TranslationsAPI as any).Upsert({ unit_id: entry.unitId, locale: targetLang, text: entry.draft, status: 'edited' })
      }
      const nextEntries = entries.map(entry => (entry.draft !== entry.translation ? { ...entry, translation: entry.draft, status: 'edited' } : entry))
      nextEntries.forEach(entry => {
        if (entry.translation.trim()) {
          memory.set(`${entry.source}|${targetLang}`, entry.translation)
        }
      })
      setEntries(nextEntries)
      const translatedCount = nextEntries.filter(entry => entry.translation.trim() !== '').length
      if (selectedFileId) {
        setFileStats(prev => ({ ...prev, [selectedFileId]: { total: nextEntries.length, translated: translatedCount } }))
      }
      setDirty(nextEntries.some(entry => entry.draft !== entry.translation))
      setStatus(`Saved ${toSave.length} entr${toSave.length === 1 ? 'y' : 'ies'}.`)
    } catch (error: any) {
      console.error(error)
      setStatus(`Failed to save: ${String(error?.message || error)}`)
    }
  }, [entries, memory, selectedFileId, targetLang])

  const handleExportMemory = useCallback(() => {
    const json = JSON.stringify(memory.toJSON(), null, 2)
    download('translation-memory.json', json)
    setStatus('Exported translation memory JSON.')
  }, [memory])

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text) as Record<string, string>
        setEntries(prev => {
          const next = prev.map(entry => (Object.prototype.hasOwnProperty.call(data, entry.key)
            ? { ...entry, draft: String(data[entry.key] ?? '') }
            : entry))
          setDirty(true)
          return next
        })
        setStatus('Imported translations. Review and save to persist.')
      } catch (error) {
        console.error(error)
        setStatus('Invalid JSON file.')
      } finally {
        event.target.value = ''
      }
    },
    [],
  )

  const totalEntries = entries.length
  const doneEntries = useMemo(
    () => entries.filter(entry => entry.translation.trim() !== '').length,
    [entries],
  )
  const shownEntries = filteredEntries.length

  useKeyboardShortcuts(
    () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    },
    handleSave,
  )

  const handleSelectProject = useCallback((projectIdValue: string) => {
    const id = Number(projectIdValue)
    if (Number.isNaN(id)) return
    setSelectedProjectId(id)
    setSelection(new Set())
  }, [])

  const handleSelectFile = useCallback((fileIdValue: string) => {
    const id = Number(fileIdValue)
    if (Number.isNaN(id)) return
    setSelectedFileId(id)
    setSelection(new Set())
  }, [])

  const handleNewProject = useCallback(async () => {
    const name = window.prompt('Project name?')?.trim()
    if (!name) return
    const source = window.prompt('Source language (e.g., en)?')?.trim() || 'en'
    try {
      await (ProjectAPI as any).Create(name, source)
      setStatus('Project created.')
      await loadProjects()
    } catch (error: any) {
      console.error(error)
      setStatus(`Failed to create project: ${String(error?.message || error)}`)
    }
  }, [loadProjects])

  const selectProvider = useCallback((value: string) => {
    const id = Number(value)
    if (Number.isNaN(id)) {
      setProviderSettings({ providerId: null, providerType: '', baseUrl: '', model: '', apiKeyMasked: '' })
      return
    }
    const provider = providers.find(p => p.id === id)
    if (!provider) {
      setProviderSettings({ providerId: null, providerType: '', baseUrl: '', model: '', apiKeyMasked: '' })
      return
    }
    setProviderSettings({
      providerId: provider.id,
      providerType: provider.type || '',
      baseUrl: provider.base_url || '',
      model: provider.model || '',
      apiKeyMasked: provider.api_key || '',
    })
  }, [providers])

  const handleProviderModelChange = useCallback((value: string) => {
    setProviderSettings(prev => ({ ...prev, model: value }))
  }, [])

  const handleOptionsChange = useCallback(
    (field: keyof TranslationOptions, value: string | boolean) => {
      setTranslationOptions(prev => ({ ...prev, [field]: value }))
    },
    [],
  )

  const handleDownload = useCallback(async () => {
    if (!selectedFileId || !targetLang) {
      setStatus('Select a file and target language to export.')
      return
    }
    try {
      const res = await (ExportAPI as any).ExportFileBase64({
        file_id: selectedFileId,
        locale: targetLang,
        override_format: '',
        language_name: targetLang,
      })
      const filename = res?.filename || `${(selectedFile?.path?.split('/').pop() || 'translations')}.${targetLang}.json`
      downloadBase64(filename, res?.content_b64 || '', 'application/octet-stream')
      setStatus(`Downloaded ${filename}.`)
    } catch (error: any) {
      console.error(error)
      setStatus(`Export failed: ${String(error?.message || error)}`)
    }
  }, [selectedFileId, targetLang, selectedFile])

  const statusSection = (
    <div className="border-t border-slate-200 p-3 text-xs text-slate-600 flex items-center justify-between gap-3 flex-wrap">
      <div>
        Status: <span id="status">{status}</span>
        {jobProgress.jobId && (
          <span className="ml-2 text-muted-foreground">
            Job #{jobProgress.jobId}: {jobProgress.done}/{jobProgress.total} {jobProgress.status}
            {jobProgress.model ? ` · model ${jobProgress.model}` : ''}
          </span>
        )}
        {currentItem.key && (
          <span className="ml-2 text-muted-foreground">Current: {currentItem.key} [{currentItem.locale}]</span>
        )}
        {lastResult.key && (
          <span className="ml-2 text-muted-foreground">
            Last: {lastResult.key} [{lastResult.locale}] {lastResult.error ? '✖' : '✓'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          id="importBtn"
          className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
          onClick={() => importInputRef.current?.click()}
          disabled={!selectedFileId}
        >
          Import JSON
        </button>
        <input
          id="importInput"
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImport}
        />
      </div>
    </div>
  )

  return (
    <div className="h-screen w-screen antialiased text-slate-900 bg-slate-50">
      <div id="app" className="h-full w-full flex">
        <aside
          className={`w-80 max-w-xs bg-white border-r border-slate-200 flex flex-col ${sidebarCollapsed ? 'hidden' : ''}`}
        >
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">LT</div>
              <h1 className="text-sm font-semibold">LLM Translator</h1>
            </div>
            <button
              id="collapseSidebar"
              className="p-2 rounded-xl hover:bg-slate-100"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              onClick={() => setSidebarCollapsed(prev => !prev)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H8m0 0 4 4m-4-4 4-4" />
              </svg>
            </button>
          </div>

          <div className="px-3 pt-3">
            <div role="tablist" aria-label="Sidebar tabs" className="grid grid-cols-3 gap-2">
              <button
                data-tab="projects"
                className={`tab-btn ${activeTab === 'projects' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('projects')}
              >
                Projects
              </button>
              <button
                data-tab="files"
                className={`tab-btn ${activeTab === 'files' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('files')}
              >
                Files
              </button>
              <button
                data-tab="settings"
                className={`tab-btn ${activeTab === 'settings' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>
          </div>

          <div className="p-3 grow overflow-auto">
            <section id="tab-projects" className={`tab-pane ${activeTab === 'projects' ? '' : 'hidden'}`}>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Project</label>
              <div className="flex gap-2">
                <select
                  id="projectSelect"
                  className="w-full rounded-xl border-slate-300 focus:ring-0"
                  value={selectedProjectId ?? ''}
                  onChange={event => handleSelectProject(event.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  id="newProjectBtn"
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                  title="Create project"
                  onClick={handleNewProject}
                >
                  +
                </button>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Recent Projects</label>
                <ul id="recentProjects" className="space-y-1 text-sm">
                  {projects.map(p => (
                    <li key={p.id}>
                      <button
                        className={`w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100 ${selectedProjectId === p.id ? 'bg-slate-100' : ''}`}
                        data-proj={p.id}
                        onClick={() => handleSelectProject(String(p.id))}
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section id="tab-files" className={`tab-pane ${activeTab === 'files' ? '' : 'hidden'}`}>
              <div className="flex items-center gap-2">
                <div className="grow">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Current File</label>
                  <select
                    id="fileSelect"
                    className="w-full rounded-xl border-slate-300 focus:ring-0"
                    value={selectedFileId ?? ''}
                    onChange={event => handleSelectFile(event.target.value)}
                  >
                    {files.map(file => (
                      <option key={file.id} value={file.id}>
                        {file.path}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  id="refreshFiles"
                  className="mt-6 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                  title="Refresh files"
                  onClick={() => {
                    if (selectedProjectId != null) loadFiles(selectedProjectId)
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    <path d="M21 3v6h-6" />
                  </svg>
                </button>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">All Files</label>
                <ul id="fileTree" className="text-sm space-y-1">
                  {files.map(file => {
                    const stats = fileStats[file.id]
                    const count = stats?.total ?? 0
                    const untranslated = stats ? stats.total - stats.translated : 0
                    const current = file.id === selectedFileId
                    return (
                      <li key={file.id}>
                        <button
                          className={`w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100 ${current ? 'bg-slate-100' : ''}`}
                          data-file={file.path}
                          onClick={() => handleSelectFile(String(file.id))}
                        >
                          <span className="font-mono text-xs">{file.path}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            {formatNumber(untranslated)}/{formatNumber(count)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>

            <section id="tab-settings" className={`tab-pane ${activeTab === 'settings' ? '' : 'hidden'}`}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Provider</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="col-span-2 text-sm">
                      Provider
                      <select
                        id="provider"
                        className="mt-1 w-full rounded-xl border-slate-300 focus:ring-0"
                        value={providerSettings.providerId ?? ''}
                        onChange={event => selectProvider(event.target.value)}
                      >
                        {providers.length === 0 && <option value="">No providers configured</option>}
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.type})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      Base URL
                      <input
                        id="baseUrl"
                        className="mt-1 w-full rounded-xl border-slate-300 focus:ring-0"
                        value={providerSettings.baseUrl}
                        readOnly
                      />
                    </label>
                    <label className="text-sm">
                      Model
                      <input
                        id="model"
                        className="mt-1 w-full rounded-xl border-slate-300 focus:ring-0"
                        value={providerSettings.model}
                        onChange={event => handleProviderModelChange(event.target.value)}
                        placeholder="Override model"
                      />
                    </label>
                    <label className="col-span-2 text-sm">
                      API Key
                      <input
                        id="apiKey"
                        className="mt-1 w-full rounded-xl border-slate-300 focus:ring-0"
                        value={providerSettings.apiKeyMasked || ''}
                        readOnly
                        placeholder="Configured via Providers"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Translation Options</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">
                      Formality
                      <select
                        id="formality"
                        className="mt-1 w-full rounded-xl border-slate-300 focus:ring-0"
                        value={translationOptions.formality}
                        onChange={event => handleOptionsChange('formality', event.target.value)}
                      >
                        <option value="auto">Auto</option>
                        <option value="formal">Formal</option>
                        <option value="informal">Informal</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      Tone
                      <select
                        id="tone"
                        className="mt-1 w-full rounded-xl border-slate-300 focus:ring-0"
                        value={translationOptions.tone}
                        onChange={event => handleOptionsChange('tone', event.target.value)}
                      >
                        <option value="neutral">Neutral</option>
                        <option value="friendly">Friendly</option>
                        <option value="playful">Playful</option>
                        <option value="technical">Technical</option>
                      </select>
                    </label>
                    <label className="col-span-2 text-sm">
                      Glossary
                      <textarea
                        id="glossary"
                        className="mt-1 w-full rounded-xl border-slate-300 px-2 py-1"
                        rows={3}
                        value={translationOptions.glossary}
                        onChange={event => handleOptionsChange('glossary', event.target.value)}
                        placeholder="Term=Translation per line"
                      />
                    </label>
                    <label className="col-span-2 flex items-center gap-2 text-sm">
                      <input
                        id="preservePlaceholders"
                        type="checkbox"
                        className="rounded"
                        checked={translationOptions.preservePlaceholders}
                        onChange={event => handleOptionsChange('preservePlaceholders', event.target.checked)}
                      />
                      Preserve placeholders (e.g., {`{count}`}, %s)
                    </label>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {statusSection}
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Source</label>
                <select id="srcLang" className="rounded-xl border-slate-300 text-sm" value={srcLang} onChange={() => {}}>
                  <option value={srcLang}>{srcLang}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Target</label>
                <select
                  id="tgtLang"
                  className="rounded-xl border-slate-300 text-sm"
                  value={targetLang}
                  onChange={event => {
                    setTargetLang(event.target.value)
                    clearSelection()
                  }}
                >
                  {availableLanguages
                    .filter(lang => lang !== srcLang)
                    .map(lang => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grow min-w-[200px] flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="search"
                    ref={searchInputRef}
                    placeholder="Search keys or text  ( / )"
                    className="w-full rounded-xl border-slate-300 pl-9"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    id="onlyUntranslated"
                    type="checkbox"
                    className="rounded"
                    checked={onlyUntranslated}
                    onChange={event => setOnlyUntranslated(event.target.checked)}
                  />
                  Untranslated only
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="selectAll"
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm"
                  title="Select all rows"
                  onClick={handleToggleAll}
                >
                  {allFilteredSelected ? 'Unselect all' : 'Select all'}
                </button>
                <button
                  id="aiTranslateSelected"
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-sm"
                  title="AI translate selected"
                  onClick={handleAiTranslate}
                  disabled={selection.size === 0 || !providerSettings.providerId}
                >
                  AI Translate
                </button>
                <button
                  id="saveBtn"
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-sm"
                  title="Save (Ctrl/Cmd+S)"
                  onClick={handleSave}
                  disabled={entries.length === 0}
                >
                  Save
                </button>
                <button
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  onClick={handleDownload}
                  disabled={!selectedFileId}
                >
                  Download
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
              <div>
                File: <span id="currentFileLabel" className="font-medium">{selectedFile?.path || '—'}</span>
                <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle ${dirty ? '' : 'hidden'}`} id="dirtyDot"></span>
              </div>
              <div id="counters">
                {formatNumber(doneEntries)}/{formatNumber(totalEntries)} translated · {formatNumber(shownEntries)} shown
              </div>
              <div className="ml-auto">
                Shortcuts: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border">/</kbd> focus search ·{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border">Ctrl/Cmd+S</kbd> save
              </div>
            </div>
          </header>

          <section id="tableWrap" className="grow overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 w-[24ch]">Key</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2 w-[28ch]">Saved</th>
                  <th className="px-3 py-2 w-[36ch]">Translation</th>
                  <th className="px-3 py-2 w-[26ch]">Suggestions</th>
                  <th className="px-3 py-2 w-[12ch]">Checks</th>
                </tr>
              </thead>
              <tbody id="rows" className="divide-y divide-slate-200">
                {filteredEntries.map(entry => (
                  <TranslationRow
                    key={entry.unitId}
                    entry={entry}
                    targetLang={targetLang}
                    value={entry.draft}
                    suggestions={suggestionsFor(entry)}
                    checked={selection.has(entry.unitId)}
                    onToggle={checked => handleToggle(entry, checked)}
                    onChange={value => handleEntryChange(entry, value)}
                    onSuggestion={value => handleSuggestion(entry, value)}
                  />
                ))}
              </tbody>
            </table>
          </section>

          <footer className="border-t border-slate-200 bg-white p-2 text-xs text-slate-600 flex items-center justify-between">
            <div id="footerStatus">{status}</div>
            <div className="flex items-center gap-2">
              <button
                id="exportMemory"
                className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                onClick={handleExportMemory}
              >
                Export TMX/JSON
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
