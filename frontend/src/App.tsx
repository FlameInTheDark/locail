import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type TranslationMap = Record<string, string>

type Entry = {
  key: string
  source: string
  translations?: TranslationMap
  notes?: string
}

type FileRecord = {
  path: string
  entries: Entry[]
}

type Project = {
  id: string
  name: string
  languages: string[]
  files: FileRecord[]
}

type Suggestion = { label: string; value: string }

type ProviderSettings = {
  provider: string
  baseUrl: string
  model: string
  apiKey: string
}

type TranslationOptions = {
  formality: string
  tone: string
  glossary: string
  preservePlaceholders: boolean
}

const placeholderRegex = /\{[^\}]+\}|%[sdif]|:\w+/g

const demoProject: Project = {
  id: 'proj1',
  name: 'Demo App',
  languages: ['en', 'ru', 'de', 'es', 'fr'],
  files: [
    {
      path: 'i18n/common.json',
      entries: [
        { key: 'app.title', source: 'Welcome to Gochat', translations: { ru: 'Добро пожаловать в Gochat' } },
        { key: 'nav.home', source: 'Home', translations: {} },
        { key: 'nav.settings', source: 'Settings', translations: { ru: 'Настройки' } },
        { key: 'msg.unread_count', source: '{count} unread message', translations: {}, notes: 'plural' },
        { key: 'btn.save', source: 'Save', translations: { ru: 'Сохранить' } },
        { key: 'auth.sign_in', source: 'Sign in', translations: {} },
        { key: 'auth.sign_out', source: 'Sign out', translations: { ru: 'Выйти' } },
        { key: 'errors.network', source: 'Network error. Please try again.', translations: {} },
        { key: 'channel.joined', source: 'You joined the channel {name}', translations: {} },
      ],
    },
    {
      path: 'i18n/errors.json',
      entries: [
        { key: 'error.unknown', source: 'An unknown error occurred.', translations: {} },
        { key: 'error.timeout', source: 'Request timed out after {seconds}s', translations: {} },
      ],
    },
  ],
}

const tinyDictRU = new Map(
  Object.entries({
    welcome: 'добро пожаловать',
    home: 'главная',
    settings: 'настройки',
    save: 'сохранить',
    sign: 'войти',
    'sign in': 'войти',
    'sign out': 'выйти',
    network: 'сеть',
    error: 'ошибка',
    please: 'пожалуйста',
    try: 'попробуйте',
    again: 'снова',
    request: 'запрос',
    timed: 'превышено',
    out: 'время',
    after: 'после',
    unknown: 'неизвестная',
    message: 'сообщение',
    unread: 'непрочитанное',
    you: 'вы',
    joined: 'присоединились',
    the: '',
    channel: 'канал',
  })
)

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

function fakeTranslateToRU(text: string) {
  const placeholders: Record<string, string> = {}
  let counter = 0
  const masked = text.replace(/(\{[^\}]+\}|%[sdif]|:\w+)/g, match => {
    const token = `§§${counter++}§§`
    placeholders[token] = match
    return token
  })

  const translated = masked
    .split(/(\W+)/)
    .map(token => {
      const lower = token.toLowerCase()
      if (tinyDictRU.has(lower)) {
        const value = tinyDictRU.get(lower) || ''
        if (/[A-Z]/.test(token[0] || '')) {
          return value.charAt(0).toUpperCase() + value.slice(1)
        }
        return value
      }
      return token
    })
    .join(' ')
    .replace(/\s+(\W)/g, '$1')
    .replace(/\s{2,}/g, ' ')

  return translated.replace(/§§\d+§§/g, token => placeholders[token])
}

function download(filename: string, data: string) {
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function fileBase(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1]
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
      <td className="px-3 py-2 align-top text-slate-500 old">{entry.translations?.[targetLang] || '—'}</td>
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
            <option key={option.label} value={option.value}>
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

function App() {
  const [projects, setProjects] = useState<Project[]>([demoProject])
  const [selectedProjectId, setSelectedProjectId] = useState('proj1')
  const [selectedFilePath, setSelectedFilePath] = useState(demoProject.files[0].path)
  const [srcLang] = useState('en')
  const [targetLang, setTargetLang] = useState('ru')
  const [search, setSearch] = useState('')
  const [onlyUntranslated, setOnlyUntranslated] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('Ready.')
  const [activeTab, setActiveTab] = useState<'projects' | 'files' | 'settings'>('projects')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>({
    provider: 'openai',
    baseUrl: '',
    model: 'gpt-4o-mini',
    apiKey: '',
  })
  const [translationOptions, setTranslationOptions] = useState<TranslationOptions>({
    formality: 'auto',
    tone: 'neutral',
    glossary: '',
    preservePlaceholders: true,
  })

  const importInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const memory = useTranslationMemory()

  const project = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId])
  const fileRecord = useMemo(() => project?.files.find(f => f.path === selectedFilePath), [project, selectedFilePath])

  useEffect(() => {
    if (!project) return
    if (!project.files.some(f => f.path === selectedFilePath)) {
      setSelectedFilePath(project.files[0]?.path ?? '')
    }
  }, [project, selectedFilePath])

  useEffect(() => {
    if (!project) return
    if (!project.languages.includes(targetLang)) {
      const fallback = project.languages.find(lang => lang !== srcLang) || targetLang
      setTargetLang(fallback)
    }
  }, [project, srcLang, targetLang])

  const entries = useMemo(() => fileRecord?.entries ?? [], [fileRecord])

  const filteredEntries = useMemo(() => {
    let list = entries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(entry => {
        const translated = entry.translations?.[targetLang] || ''
        return (
          entry.key.toLowerCase().includes(q) ||
          entry.source.toLowerCase().includes(q) ||
          translated.toLowerCase().includes(q)
        )
      })
    }
    if (onlyUntranslated) {
      list = list.filter(entry => {
        const translated = entry.translations?.[targetLang]
        return !translated || translated.trim() === ''
      })
    }
    return list
  }, [entries, search, onlyUntranslated, targetLang])

  const suggestionsFor = useCallback(
    (entry: Entry): Suggestion[] => {
      const list: Suggestion[] = []
      const current = entry.translations?.[targetLang]
      if (current) {
        list.push({ label: `Previous (${targetLang})`, value: current })
      }
      const mem = memory.get(`${entry.source}|${targetLang}`)
      if (mem && mem !== current) {
        list.push({ label: 'Memory', value: mem })
      }
      if (targetLang === 'ru') {
        const mt = fakeTranslateToRU(entry.source)
        if (mt && mt !== current) {
          list.push({ label: 'AI (demo)', value: mt })
        }
      }
      if (entry.source && entry.source !== current) {
        list.push({ label: 'Copy source', value: entry.source })
      }
      return list
    },
    [memory, targetLang]
  )

  const updateEntry = useCallback(
    (key: string, value: string) => {
      setProjects(prev =>
        prev.map(p => {
          if (p.id !== selectedProjectId) return p
          return {
            ...p,
            files: p.files.map(f => {
              if (f.path !== selectedFilePath) return f
              return {
                ...f,
                entries: f.entries.map(entry => {
                  if (entry.key !== key) return entry
                  return {
                    ...entry,
                    translations: { ...entry.translations, [targetLang]: value },
                  }
                }),
              }
            }),
          }
        })
      )
    },
    [selectedFilePath, selectedProjectId, targetLang]
  )

  const clearSelection = useCallback(() => {
    setSelection(new Set())
  }, [])

  const handleEntryChange = useCallback(
    (entry: Entry, value: string) => {
      updateEntry(entry.key, value)
      setDirty(true)
    },
    [updateEntry]
  )

  const handleSuggestion = useCallback(
    (entry: Entry, value: string) => {
      updateEntry(entry.key, value)
      setDirty(true)
    },
    [updateEntry]
  )

  const handleToggle = useCallback((entry: Entry, checked: boolean) => {
    setSelection(prev => {
      const next = new Set(prev)
      if (checked) next.add(entry.key)
      else next.delete(entry.key)
      return next
    })
  }, [])

  const allFilteredSelected = useMemo(
    () => filteredEntries.length > 0 && filteredEntries.every(entry => selection.has(entry.key)),
    [filteredEntries, selection]
  )

  const handleToggleAll = useCallback(() => {
    setSelection(prev => {
      const next = new Set(prev)
      if (filteredEntries.length === 0) return next
      if (filteredEntries.every(entry => next.has(entry.key))) {
        filteredEntries.forEach(entry => next.delete(entry.key))
      } else {
        filteredEntries.forEach(entry => next.add(entry.key))
      }
      return next
    })
  }, [filteredEntries])

  const handleAiTranslate = useCallback(() => {
    if (!fileRecord) return
    let count = 0
    fileRecord.entries.forEach(entry => {
      if (!selection.has(entry.key)) return
      const suggestion = suggestionsFor(entry).find(opt => opt.label.startsWith('AI'))
      if (!suggestion) return
      count += 1
      updateEntry(entry.key, suggestion.value)
      memory.set(`${entry.source}|${targetLang}`, suggestion.value)
    })
    if (count > 0) {
      setDirty(true)
    }
    setStatus(`AI filled ${count} entr${count === 1 ? 'y' : 'ies'} (demo).`)
  }, [fileRecord, memory, selection, suggestionsFor, targetLang, updateEntry])

  const handleSave = useCallback(() => {
    if (!fileRecord) return
    const output: Record<string, string> = {}
    fileRecord.entries.forEach(entry => {
      const value = entry.translations?.[targetLang] || ''
      output[entry.key] = value
      if (value.trim()) {
        memory.set(`${entry.source}|${targetLang}`, value)
      }
    })
    const filename = `${fileBase(selectedFilePath).replace(/\.json$/, '')}.${targetLang}.json`
    download(filename, JSON.stringify(output, null, 2))
    setDirty(false)
    setStatus('Saved to file download.')
  }, [fileRecord, memory, selectedFilePath, targetLang])

  const handleExportMemory = useCallback(() => {
    const json = JSON.stringify(memory.toJSON(), null, 2)
    download('translation-memory.json', json)
    setStatus('Exported translation memory.')
  }, [memory])

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file || !fileRecord) return
      const text = await file.text()
      try {
        const data = JSON.parse(text) as Record<string, string>
        Object.entries(data).forEach(([key, value]) => {
          updateEntry(key, String(value ?? ''))
        })
        setDirty(true)
        setStatus('Imported translations.')
      } catch (error) {
        setStatus('Invalid JSON file.')
      } finally {
        event.target.value = ''
      }
    },
    [fileRecord, updateEntry]
  )

  const totalEntries = entries.length
  const doneEntries = useMemo(
    () => entries.filter(entry => (entry.translations?.[targetLang] || '').trim() !== '').length,
    [entries, targetLang]
  )
  const shownEntries = filteredEntries.length

  useKeyboardShortcuts(
    () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    },
    handleSave
  )

  const handleSelectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId)
      const nextProject = projects.find(p => p.id === projectId)
      if (nextProject) {
        setSelectedFilePath(nextProject.files[0]?.path ?? '')
      }
      setSelection(new Set())
    },
    [projects]
  )

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFilePath(path)
    setSelection(new Set())
  }, [])

  const handleNewProject = useCallback(() => {
    const name = window.prompt('Project name?')?.trim()
    if (!name) return
    const id = `proj${projects.length + 1}`
    const newProject: Project = {
      id,
      name,
      languages: ['en', 'ru'],
      files: [
        {
          path: 'i18n/new.json',
          entries: [],
        },
      ],
    }
    setProjects(prev => [...prev, newProject])
    setSelectedProjectId(id)
    setSelectedFilePath(newProject.files[0].path)
    setSelection(new Set())
    setStatus('Created new project.')
  }, [projects])

  const handleProviderChange = useCallback(
    (field: keyof ProviderSettings, value: string) => {
      setProviderSettings(prev => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleOptionsChange = useCallback(
    (field: keyof TranslationOptions, value: string | boolean) => {
      setTranslationOptions(prev => ({ ...prev, [field]: value }))
    },
    []
  )

  const statusSection = (
    <div className="border-t border-slate-200 p-3 text-xs text-slate-600 flex items-center justify-between">
      <div>
        Status: <span id="status">{status}</span>
      </div>
      <button
        id="importBtn"
        className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
        onClick={() => importInputRef.current?.click()}
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
                  value={selectedProjectId}
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
                        className="w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100"
                        data-proj={p.id}
                        onClick={() => handleSelectProject(p.id)}
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
                    value={selectedFilePath}
                    onChange={event => handleSelectFile(event.target.value)}
                  >
                    {project?.files.map(file => (
                      <option key={file.path} value={file.path}>
                        {file.path}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  id="refreshFiles"
                  className="mt-6 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                  title="Refresh files"
                  onClick={() => setStatus('Files refreshed.')}
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
                  {project?.files.map(file => {
                    const count = file.entries.length
                    const untranslated = file.entries.filter(entry => !(entry.translations?.[targetLang])).length
                    const current = file.path === selectedFilePath
                    return (
                      <li key={file.path}>
                        <button
                          className={`w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100 ${current ? 'bg-slate-100' : ''}`}
                          data-file={file.path}
                          onClick={() => handleSelectFile(file.path)}
                        >
                          <span className="font-mono text-xs">{file.path}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            {untranslated}/{count}
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
                        value={providerSettings.provider}
                        onChange={event => handleProviderChange('provider', event.target.value)}
                      >
                        <option value="openai">OpenAI Compatible</option>
                        <option value="anthropic">Anthropic Compatible</option>
                        <option value="local">Local HTTP</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      Base URL
                      <input
                        id="baseUrl"
                        className="mt-1 w-full rounded-xl border-slate-300"
                        placeholder="https://api.example.com"
                        value={providerSettings.baseUrl}
                        onChange={event => handleProviderChange('baseUrl', event.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      Model
                      <input
                        id="model"
                        className="mt-1 w-full rounded-xl border-slate-300"
                        placeholder="gpt-4o-mini"
                        value={providerSettings.model}
                        onChange={event => handleProviderChange('model', event.target.value)}
                      />
                    </label>
                    <label className="col-span-2 text-sm">
                      API Key
                      <input
                        id="apiKey"
                        type="password"
                        className="mt-1 w-full rounded-xl border-slate-300"
                        placeholder="••••••••"
                        value={providerSettings.apiKey}
                        onChange={event => handleProviderChange('apiKey', event.target.value)}
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
                        className="mt-1 w-full rounded-xl border-slate-300"
                        value={translationOptions.formality}
                        onChange={event => handleOptionsChange('formality', event.target.value)}
                      >
                        <option>auto</option>
                        <option>formal</option>
                        <option>informal</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      Tone
                      <select
                        id="tone"
                        className="mt-1 w-full rounded-xl border-slate-300"
                        value={translationOptions.tone}
                        onChange={event => handleOptionsChange('tone', event.target.value)}
                      >
                        <option>neutral</option>
                        <option>friendly</option>
                        <option>concise</option>
                        <option>marketing</option>
                      </select>
                    </label>
                    <label className="col-span-2 text-sm">
                      Glossary (comma-separated terms)
                      <input
                        id="glossary"
                        className="mt-1 w-full rounded-xl border-slate-300"
                        placeholder="user, server, channel"
                        value={translationOptions.glossary}
                        onChange={event => handleOptionsChange('glossary', event.target.value)}
                      />
                    </label>
                    <label className="text-sm flex items-center gap-2 mt-1">
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
                  <option value={srcLang}>English (en)</option>
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
                  {project?.languages
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
                  Select all
                </button>
                <button
                  id="aiTranslateSelected"
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-sm"
                  title="AI translate selected"
                  onClick={handleAiTranslate}
                  disabled={selection.size === 0}
                >
                  AI Translate
                </button>
                <button
                  id="saveBtn"
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-sm"
                  title="Save (Ctrl/Cmd+S)"
                  onClick={handleSave}
                >
                  Save
                </button>
                <a id="downloadLink" className="hidden px-3 py-2 rounded-xl border border-slate-200 text-sm" download>
                  Download
                </a>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
              <div>
                File: <span id="currentFileLabel" className="font-medium">{selectedFilePath || '—'}</span>
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
                  <th className="px-3 py-2 w-[28ch]">Old</th>
                  <th className="px-3 py-2 w-[36ch]">Translation</th>
                  <th className="px-3 py-2 w-[26ch]">Suggestions</th>
                  <th className="px-3 py-2 w-[12ch]">Checks</th>
                </tr>
              </thead>
              <tbody id="rows" className="divide-y divide-slate-200">
                {filteredEntries.map(entry => (
                  <TranslationRow
                    key={entry.key}
                    entry={entry}
                    targetLang={targetLang}
                    value={entry.translations?.[targetLang] || ''}
                    suggestions={suggestionsFor(entry)}
                    checked={selection.has(entry.key)}
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
