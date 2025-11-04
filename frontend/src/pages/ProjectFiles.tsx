import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/table'
import EmptyState from '../components/EmptyState'
import { UploadCloud, RefreshCw } from 'lucide-react'
import * as FileAPI from '../../wailsjs/go/app/FileAPI'
import * as ImportAPI from '../../wailsjs/go/app/ImportAPI'

type FileRow = { id: number; path: string; format: string; locale?: string }

function guessFormat(filename: string): string {
  const f = filename.toLowerCase()
  if (f.endsWith('.json')) return 'paraglidejson'
  if (f.endsWith('.csv')) return 'csv'
  if (f.endsWith('.vdf') || f.endsWith('.txt') || f.includes('half-life') || f.includes('valve')) return 'valvevdf'
  return 'paraglidejson'
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result is data:...;base64,XXXXX
      const idx = result.indexOf('base64,')
      if (idx >= 0) return resolve(result.substring(idx + 7))
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ProjectFilesPage() {
  const { id } = useParams()
  const projectID = useMemo(() => Number(id), [id])
  const [files, setFiles] = useState<FileRow[]>([])
  const [locale, setLocale] = useState('')
  const [format, setFormat] = useState('paraglidejson')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const res = await (FileAPI as any).ListByProject(projectID)
    setFiles(res || [])
  }
  useEffect(() => { if (projectID) load() }, [projectID])

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) setFormat(guessFormat(f.name))
  }

  const doImport = async () => {
    if (!file) return
    if (!format) { setError('Select a format.'); return }
    if (!locale.trim()) { setError('Locale is required.'); return }
    setBusy(true)
    try {
      setError(null)
      const b64 = await fileToBase64(file)
      await (ImportAPI as any).ImportBase64({
        project_id: projectID,
        filename: file.name,
        format,
        locale,
        content_b64: b64,
      })
      setFile(null)
      await load()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Project Files</h1>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Import Translation File</CardTitle>
          <CardDescription>Upload a file and parse into units.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Locale (file language)</label>
              <Input value={locale} onChange={e => setLocale(e.target.value)} placeholder="e.g., ru or en" />
            </div>
            <div>
              <label className="text-sm">Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)} className="h-9 border rounded-md px-2 w-full">
                <option value="paraglidejson">Paraglide JSON</option>
                <option value="csv">CSV</option>
                <option value="valvevdf">Valve/HL VDF</option>
              </select>
            </div>
          </div>
          <label className="text-sm">File</label>
          <div
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); setFormat(guessFormat(f.name)) } }}
            className="border rounded-md p-6 text-center bg-muted/20"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <UploadCloud className="h-6 w-6 text-muted-foreground"/>
              <div className="text-sm text-muted-foreground">Drag & drop or choose a file</div>
              <div className="text-xs text-muted-foreground">Supported: .json (Paraglide), .csv (CSV), .vdf or .txt (Valve VDF)</div>
              <input type="file" onChange={onSelectFile} className="hidden" id="fileinput" accept=".json,.csv,.vdf,.txt" />
              <Button variant="outline" onClick={() => (document.getElementById('fileinput') as HTMLInputElement)?.click()}>Browse…</Button>
              {file && <div className="text-xs text-muted-foreground">Selected: {file.name}</div>}
            </div>
          </div>
          <Button onClick={doImport} disabled={!file || busy || !locale.trim()} className="w-fit">Import</Button>
        </CardContent>
      </Card>

      {files.length === 0 ? (
        <EmptyState title="No files imported" subtitle="Import translation files to start working with units." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Imported Files</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Path</Th>
                  <Th>Format</Th>
                  <Th>Locale</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {files.map(f => (
                  <Tr key={f.id}>
                    <Td className="font-mono text-xs">{f.path}</Td>
                    <Td>{f.format}</Td>
                    <Td>{f.locale || 'n/a'}</Td>
                    <Td className="text-right"><a href={`#/files/${f.id}/units`} className="text-sm underline">Units</a></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )}
