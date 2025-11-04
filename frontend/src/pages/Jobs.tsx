import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import * as JobsAPI from '../../wailsjs/go/app/JobsAPI'

type Job = { id: number; type: string; status: string; progress: number; total: number }
type Log = { id: number; time: string; level: string; message: string }

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [current, setCurrent] = useState<number | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await (JobsAPI as any).List(20)
      setJobs(res || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!current) return
    let active = true
    const fetchLogs = async () => {
      const res = await (JobsAPI as any).Logs(current, 500)
      if (active) setLogs(res || [])
    }
    fetchLogs()
    const timer = setInterval(fetchLogs, 1500)
    return () => { active = false; clearInterval(timer) }
  }, [current])

  const pct = (j: Job) => j.total > 0 ? Math.round((j.progress / j.total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      <div className="grid gap-2">
        {jobs.map(j => (
          <div key={j.id} className={`border rounded-md p-3 ${current===j.id?'bg-muted/20':''}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm">#{j.id} · {j.type} · {j.status} · {j.progress}/{j.total} ({pct(j)}%)</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setCurrent(j.id)}>Logs</Button>
                <Button size="sm" variant="outline" onClick={async ()=>{ await (JobsAPI as any).Cancel(j.id); await load()}}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={async ()=>{ await (JobsAPI as any).Delete(j.id); await load()}}>Remove</Button>
              </div>
            </div>
            <div className="mt-2"><Progress value={j.progress} max={j.total||100}/></div>
          </div>
        ))}
      </div>
      {current && (
        <div className="border rounded-md p-3 max-h-80 overflow-auto bg-muted/10">
          <div className="text-sm font-medium mb-2">Logs for job #{current}</div>
          {logs.length===0 ? (
            <div className="text-xs text-muted-foreground">No logs yet</div>
          ) : (
            logs.map(l => (
              <div key={l.id} className="text-xs"><span className="text-muted-foreground">[{l.time}]</span> <span className="uppercase">{l.level}</span>: {l.message}</div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

