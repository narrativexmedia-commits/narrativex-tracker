'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Work window constants (IST)
const WORK_START_MINS = 9 * 60 + 30   // 570 = 9:30
const WORK_END_MINS   = 18 * 60 + 30  // 1110 = 18:30
const WORK_TOTAL_MINS = WORK_END_MINS - WORK_START_MINS  // 540

type Flag = {
  id: string
  idle_start:       string | null
  flagged_at:       string          // idle end
  duration_minutes: number
  explanation:      string | null
  status:           string
  admin_note:       string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISTMins(ts: string): number {
  const d = new Date(ts)
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return ist.getHours() * 60 + ist.getMinutes()
}

function getIdleStart(flag: Flag): string {
  if (flag.idle_start) return flag.idle_start
  // Fallback for old data: derive from flagged_at - duration
  const d = new Date(flag.flagged_at)
  d.setMinutes(d.getMinutes() - flag.duration_minutes)
  return d.toISOString()
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00+05:30')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const isToday = iso === today
  const isYesterday = iso === new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  if (isToday) return 'Today'
  if (isYesterday) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Position of a flag segment on the timeline (0–100%)
function flagLeft(flag: Flag): number {
  const startMins = toISTMins(getIdleStart(flag))
  const clamped   = Math.max(WORK_START_MINS, Math.min(WORK_END_MINS, startMins))
  return ((clamped - WORK_START_MINS) / WORK_TOTAL_MINS) * 100
}

function flagWidth(flag: Flag): number {
  return Math.min(
    (flag.duration_minutes / WORK_TOTAL_MINS) * 100,
    100 - flagLeft(flag)
  )
}

function statusColor(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case 'approved': return { bg: 'rgba(34,197,94,0.25)',  border: 'rgba(34,197,94,0.5)',  text: '#4ade80' }
    case 'rejected': return { bg: 'rgba(239,68,68,0.25)',  border: 'rgba(239,68,68,0.5)',  text: '#f87171' }
    case 'explained':return { bg: 'rgba(234,179,8,0.25)',  border: 'rgba(234,179,8,0.5)',  text: '#fbbf24' }
    default:         return { bg: 'rgba(239,68,68,0.35)',  border: 'rgba(239,68,68,0.7)',  text: '#ef4444' }
  }
}

// ─── Timeline Tick Labels ─────────────────────────────────────────────────────
const TICKS = ['9:30', '11:00', '12:30', '14:00', '15:30', '17:00', '18:30']
const TICK_POSITIONS = TICKS.map(t => {
  const [h, m] = t.split(':').map(Number)
  return ((h * 60 + m - WORK_START_MINS) / WORK_TOTAL_MINS) * 100
})

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmployeeActivityFlagsPage() {
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const [selectedDate, setSelectedDate]     = useState(todayIST)
  const [flags, setFlags]                   = useState<Flag[]>([])
  const [loading, setLoading]               = useState(true)
  const [selectedFlag, setSelectedFlag]     = useState<Flag | null>(null)
  const [explanation, setExplanation]       = useState('')
  const [submitting, setSubmitting]         = useState(false)
  const [submitMsg, setSubmitMsg]           = useState<string | null>(null)
  const [hoveredId, setHoveredId]           = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchFlags(selectedDate) }, [selectedDate])

  async function fetchFlags(date: string) {
    setLoading(true)
    setSelectedFlag(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const start = `${date}T00:00:00+05:30`
    const end   = `${date}T23:59:59+05:30`

    const { data } = await supabase
      .from('activity_flags')
      .select('id, idle_start, flagged_at, duration_minutes, explanation, status, admin_note')
      .eq('employee_id', user.id)
      .gte('flagged_at', start)
      .lte('flagged_at', end)
      .order('flagged_at', { ascending: true })

    setFlags(data ?? [])
    setLoading(false)
  }

  function selectFlag(flag: Flag) {
    if (selectedFlag?.id === flag.id) {
      setSelectedFlag(null)
      return
    }
    setSelectedFlag(flag)
    setExplanation(flag.explanation ?? '')
    setSubmitMsg(null)
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  async function submitExplanation() {
    if (!selectedFlag || !explanation.trim()) return
    setSubmitting(true)
    const { error } = await supabase
      .from('activity_flags')
      .update({ explanation: explanation.trim(), status: 'explained' })
      .eq('id', selectedFlag.id)

    if (error) {
      setSubmitMsg('Error saving. Try again.')
    } else {
      setSubmitMsg('Saved!')
      await fetchFlags(selectedDate)
      setSelectedFlag(null)
    }
    setSubmitting(false)
    setTimeout(() => setSubmitMsg(null), 3000)
  }

  function shiftDate(delta: number) {
    const d = new Date(selectedDate + 'T00:00:00+05:30')
    d.setDate(d.getDate() + delta)
    const next = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    if (next <= todayIST) setSelectedDate(next)
  }

  const isToday = selectedDate === todayIST

  // Current time position (only for today)
  const nowMins = (() => {
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    return ist.getHours() * 60 + ist.getMinutes()
  })()
  const nowPct = Math.min(100, Math.max(0, ((nowMins - WORK_START_MINS) / WORK_TOTAL_MINS) * 100))

  return (
    <div style={{ padding: 20, maxWidth: 780 }}>

      {/* Header */}
      <h1 style={{ fontSize: 16, fontWeight: 600, color: '#e2d9ff', marginBottom: 4 }}>
        Activity Timeline
      </h1>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
        Idle periods over 5 mins are flagged. Click a red segment to add your explanation.
      </p>

      {/* Date Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => shiftDate(-1)} style={navBtnStyle}>
          <i className="ti ti-chevron-left" style={{ fontSize: 14 }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#e2d9ff', minWidth: 90, textAlign: 'center' }}>
          {formatDateLabel(selectedDate)}
        </span>
        <button onClick={() => shiftDate(1)} disabled={isToday} style={navBtnStyle}>
          <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
        </button>
        {!isToday && (
          <button onClick={() => setSelectedDate(todayIST)} style={{
            ...navBtnStyle,
            fontSize: 11, padding: '4px 10px',
            color: '#c4b5fd', borderColor: 'rgba(139,92,246,0.4)',
          }}>
            Today
          </button>
        )}
        <button onClick={() => fetchFlags(selectedDate)} style={{
          ...navBtnStyle, marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: 'rgba(255,255,255,0.4)',
        }}>
          <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
        </button>
      </div>

      {/* Timeline Card */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '18px 20px', marginBottom: 20,
      }}>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { color: '#ef4444', label: 'Idle (pending)' },
            { color: '#fbbf24', label: 'Explained' },
            { color: '#4ade80', label: 'Approved' },
            { color: '#f87171', label: 'Rejected' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.8 }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Timeline bar */}
        <div style={{ position: 'relative', height: 36, marginBottom: 6 }}>
          {/* Base track */}
          <div style={{
            position: 'absolute', top: 10, left: 0, right: 0, height: 16,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 4, overflow: 'visible',
          }}>

            {/* Flag segments */}
            {flags.map(flag => {
              const left  = flagLeft(flag)
              const width = flagWidth(flag)
              const col   = statusColor(flag.status)
              const isSelected = selectedFlag?.id === flag.id
              const isHovered  = hoveredId === flag.id

              return (
                <div
                  key={flag.id}
                  title={`${formatTime(getIdleStart(flag))} – ${formatTime(flag.flagged_at)} · ${flag.duration_minutes} min`}
                  onClick={() => selectFlag(flag)}
                  onMouseEnter={() => setHoveredId(flag.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: 'absolute',
                    left:   `${left}%`,
                    width:  `max(${width}%, 6px)`,   // min 6px so tiny flags are clickable
                    top: isSelected || isHovered ? -3 : 0,
                    height: isSelected || isHovered ? 22 : 16,
                    background: col.bg,
                    border: `1.5px solid ${col.border}`,
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    zIndex: isSelected ? 3 : isHovered ? 2 : 1,
                    boxShadow: isSelected ? `0 0 0 2px ${col.border}` : 'none',
                  }}
                />
              )
            })}

            {/* Current time indicator (today only) */}
            {isToday && nowMins >= WORK_START_MINS && nowMins <= WORK_END_MINS && (
              <div style={{
                position: 'absolute',
                left: `${nowPct}%`,
                top: -6, bottom: -6, width: 1.5,
                background: 'rgba(139,92,246,0.7)',
                zIndex: 4,
              }}>
                <div style={{
                  position: 'absolute', top: -4, left: -3,
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#a78bfa',
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Tick labels */}
        <div style={{ position: 'relative', height: 16, marginTop: 2 }}>
          {TICKS.map((tick, i) => (
            <span key={tick} style={{
              position: 'absolute',
              left: `${TICK_POSITIONS[i]}%`,
              transform: 'translateX(-50%)',
              fontSize: 9, color: 'rgba(255,255,255,0.2)',
              whiteSpace: 'nowrap',
            }}>{tick}</span>
          ))}
        </div>

        {/* Empty state */}
        {!loading && flags.length === 0 && (
          <p style={{
            textAlign: 'center', fontSize: 12, marginTop: 12,
            color: 'rgba(255,255,255,0.2)', fontStyle: 'italic',
          }}>
            No flags for this day. 
          </p>
        )}

        {loading && (
          <p style={{ textAlign: 'center', fontSize: 12, marginTop: 12, color: 'rgba(255,255,255,0.2)' }}>
            Loading…
          </p>
        )}
      </div>

      {/* Flag Detail Panel (shown on click) */}
      {selectedFlag && (
        <div ref={detailRef} style={{
          background: 'rgba(255,255,255,0.04)',
          border: `0.5px solid ${statusColor(selectedFlag.status).border}`,
          borderRadius: 10, padding: 18, marginBottom: 20,
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2d9ff', marginBottom: 4 }}>
                Idle Period — {selectedFlag.duration_minutes} min
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {formatTime(getIdleStart(selectedFlag))} → {formatTime(selectedFlag.flagged_at)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={selectedFlag.status} />
              <button onClick={() => setSelectedFlag(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.3)', fontSize: 16, padding: 2,
              }}>×</button>
            </div>
          </div>

          {selectedFlag.admin_note && (
            <div style={{
              marginBottom: 12, padding: '8px 12px',
              background: 'rgba(139,92,246,0.1)',
              border: '0.5px solid rgba(139,92,246,0.2)',
              borderRadius: 6, fontSize: 11, color: 'rgba(196,181,253,0.8)',
            }}>
              <span style={{ fontWeight: 600 }}>Admin note: </span>{selectedFlag.admin_note}
            </div>
          )}

          <textarea
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            rows={3}
            placeholder="What were you doing during this time?"
            disabled={selectedFlag.status === 'approved' || selectedFlag.status === 'rejected'}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '9px 12px',
              fontSize: 12, color: '#e2d9ff', resize: 'vertical', outline: 'none',
              opacity: (selectedFlag.status === 'approved' || selectedFlag.status === 'rejected') ? 0.5 : 1,
              cursor: (selectedFlag.status === 'approved' || selectedFlag.status === 'rejected') ? 'not-allowed' : 'text',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            {submitMsg ? (
              <span style={{ fontSize: 12, color: submitMsg === 'Saved!' ? '#4ade80' : '#f87171' }}>
                {submitMsg}
              </span>
            ) : <span />}

            {selectedFlag.status !== 'approved' && selectedFlag.status !== 'rejected' && (
              <button
                onClick={submitExplanation}
                disabled={submitting || !explanation.trim()}
                style={{
                  background: explanation.trim()
                    ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)',
                  border: `0.5px solid ${explanation.trim()
                    ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 6, padding: '7px 18px',
                  fontSize: 12, fontWeight: 500,
                  color: explanation.trim() ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
                  cursor: (submitting || !explanation.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {submitting ? 'Saving…' : 'Submit Explanation'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Flag List (summary below timeline) */}
      {!loading && flags.length > 0 && (
        <div>
          <h2 style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            {formatDateLabel(selectedDate)} — {flags.length} flag{flags.length !== 1 ? 's' : ''}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {flags.map(flag => {
              const col = statusColor(flag.status)
              const isSelected = selectedFlag?.id === flag.id
              return (
                <div
                  key={flag.id}
                  onClick={() => selectFlag(flag)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    background: isSelected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
                    border: `0.5px solid ${isSelected ? col.border : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{
                    width: 3, height: 28, borderRadius: 2, flexShrink: 0,
                    background: col.text,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#e2d9ff', fontWeight: 500 }}>
                      {formatTime(getIdleStart(flag))} → {formatTime(flag.flagged_at)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                      {flag.duration_minutes} min idle
                      {flag.explanation && ` · "${flag.explanation.slice(0, 40)}${flag.explanation.length > 40 ? '…' : ''}"`}
                    </div>
                  </div>
                  <StatusBadge status={flag.status} />
                  <i className="ti ti-chevron-right" style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    pending:  { background: 'rgba(239,68,68,0.15)',  color: '#f87171' },
    explained:{ background: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
    approved: { background: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
    rejected: { background: 'rgba(239,68,68,0.15)',  color: '#dc2626' },
  }
  return (
    <span style={{
      ...(styles[status] ?? { background: 'rgba(255,255,255,0.08)', color: '#aaa' }),
      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500,
      textTransform: 'capitalize', flexShrink: 0,
    }}>
      {status}
    </span>
  )
}

// ─── Shared button style ──────────────────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: 6, padding: '5px 10px',
  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
  fontSize: 12, display: 'flex', alignItems: 'center',
}