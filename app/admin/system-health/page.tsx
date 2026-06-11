'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface EmployeeHealth {
  employee_id: string
  full_name: string
  last_heartbeat: string | null
  last_event: string | null
  errors_24h: number
}

interface CronLog {
  run_at: string
  status: string
  message: string
  marked_absent_count: number
}

export default function SystemHealthPage() {
  const [employeeHealth, setEmployeeHealth] = useState<EmployeeHealth[]>([])
  const [lastCron, setLastCron] = useState<CronLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const d = theme === 'dark'

  useEffect(() => {
    fetchHealth()
  }, [])

  async function fetchHealth() {
    setLoading(true)

    // Get all employees
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'employee')

    // Get last 24h agent logs
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: logs } = await supabase
      .from('agent_logs')
      .select('employee_id, event, detail, ts')
      .gte('ts', since)
      .order('ts', { ascending: false })

    // Build per-employee health
    const health: EmployeeHealth[] = (profiles || []).map(p => {
      const empLogs = (logs || []).filter(l => l.employee_id === p.id)
      const heartbeats = empLogs.filter(l => l.event === 'heartbeat')
      const errors = empLogs.filter(l => l.event === 'error')
      const lastLog = empLogs[0]

      return {
        employee_id: p.id,
        full_name: p.full_name,
        last_heartbeat: heartbeats[0]?.ts ?? null,
        last_event: lastLog?.event ?? null,
        errors_24h: errors.length,
      }
    })

    setEmployeeHealth(health)

    // Get last cron log
    const { data: cronLogs } = await supabase
      .from('cron_logs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(1)

    setLastCron(cronLogs?.[0] ?? null)
    setLoading(false)
  }

  function getAgentStatus(last_heartbeat: string | null) {
    if (!last_heartbeat) return { label: 'No Data', color: '#6b7280' }
    const diff = Date.now() - new Date(last_heartbeat).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins <= 10) return { label: 'Online', color: '#22c55e' }
    if (mins <= 60) return { label: `${mins}m ago`, color: '#f59e0b' }
    return { label: `${Math.floor(mins / 60)}h ago`, color: '#ef4444' }
  }

  function formatTime(ts: string | null) {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const card = {
    background: d ? '#1e1e3a' : '#ffffff',
    border: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  }

  const th = {
    fontSize: 11,
    color: d ? 'rgba(255,255,255,0.35)' : '#9994b8',
    fontWeight: 500,
    padding: '8px 12px',
    textAlign: 'left' as const,
    borderBottom: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  }

  const td = {
    fontSize: 13,
    color: d ? 'rgba(255,255,255,0.7)' : '#3d3760',
    padding: '10px 12px',
    borderBottom: d ? '0.5px solid rgba(255,255,255,0.05)' : '0.5px solid #f0eef8',
  }

  if (loading) return (
    <div style={{ color: d ? 'rgba(255,255,255,0.4)' : '#9994b8', fontSize: 13, marginTop: 40, textAlign: 'center' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ maxWidth: 800 }}>

      {/* Cron Status */}
      <div style={card}>
        <div style={{ fontSize: 12, color: d ? 'rgba(255,255,255,0.35)' : '#9994b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Last Absent-Marking Cron
        </div>
        {lastCron ? (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8', marginBottom: 4 }}>Run At</div>
              <div style={{ fontSize: 13, color: d ? '#e2d9ff' : '#2d2354' }}>{formatTime(lastCron.run_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8', marginBottom: 4 }}>Status</div>
              <div style={{ fontSize: 13, color: lastCron.status === 'success' ? '#22c55e' : lastCron.status === 'skipped' ? '#f59e0b' : '#ef4444', fontWeight: 500 }}>
                {lastCron.status.charAt(0).toUpperCase() + lastCron.status.slice(1)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8', marginBottom: 4 }}>Message</div>
              <div style={{ fontSize: 13, color: d ? '#e2d9ff' : '#2d2354' }}>{lastCron.message}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8', marginBottom: 4 }}>Marked Absent</div>
              <div style={{ fontSize: 13, color: d ? '#e2d9ff' : '#2d2354' }}>{lastCron.marked_absent_count}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: d ? 'rgba(255,255,255,0.3)' : '#9994b8' }}>No cron runs recorded yet.</div>
        )}
      </div>

      {/* Agent Health per Employee */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: d ? 'rgba(255,255,255,0.35)' : '#9994b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Agent Health (Last 24h)
          </div>
          <button
            onClick={fetchHealth}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              background: d ? 'rgba(139,92,246,0.2)' : '#eeecff',
              color: d ? '#c4b5fd' : '#4c3d9e',
              border: 'none', cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Employee</th>
              <th style={th}>Agent Status</th>
              <th style={th}>Last Heartbeat</th>
              <th style={th}>Errors (24h)</th>
            </tr>
          </thead>
          <tbody>
            {employeeHealth.map(e => {
              const status = getAgentStatus(e.last_heartbeat)
              return (
                <tr key={e.employee_id}>
                  <td style={td}>{e.full_name}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 500, color: status.color,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }} />
                      {status.label}
                    </span>
                  </td>
                  <td style={td}>{formatTime(e.last_heartbeat)}</td>
                  <td style={td}>
                    <span style={{ color: e.errors_24h > 0 ? '#ef4444' : d ? 'rgba(255,255,255,0.4)' : '#9994b8' }}>
                      {e.errors_24h > 0 ? `${e.errors_24h} error${e.errors_24h > 1 ? 's' : ''}` : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {employeeHealth.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: 'center', color: d ? 'rgba(255,255,255,0.3)' : '#9994b8' }}>
                  No employee data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}