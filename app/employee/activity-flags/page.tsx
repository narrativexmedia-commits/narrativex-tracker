'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Flag = {
  id: string
  flagged_at: string
  duration_minutes: number
  explanation: string | null
  status: string
  admin_note: string | null
}

export default function EmployeeActivityFlagsPage() {
  const [todayFlags, setTodayFlags] = useState<Flag[]>([])
  const [pastFlags, setPastFlags] = useState<Flag[]>([])
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetchFlags()
  }, [])

  async function fetchFlags() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const start = `${todayIST}T00:00:00+05:30`
    const end = `${todayIST}T23:59:59+05:30`

    const [todayRes, pastRes] = await Promise.all([
      supabase
        .from('activity_flags')
        .select('id, flagged_at, duration_minutes, explanation, status, admin_note')
        .eq('employee_id', user.id)
        .gte('flagged_at', start)
        .lte('flagged_at', end)
        .order('flagged_at', { ascending: true }),
      supabase
        .from('activity_flags')
        .select('id, flagged_at, duration_minutes, explanation, status, admin_note')
        .eq('employee_id', user.id)
        .lt('flagged_at', start)
        .order('flagged_at', { ascending: false })
        .limit(30),
    ])

    if (todayRes.data) {
      setTodayFlags(todayRes.data)
      // Pre-fill existing explanations
      const existing: Record<string, string> = {}
      todayRes.data.forEach(f => {
        if (f.explanation) existing[f.id] = f.explanation
      })
      setExplanations(existing)
    }
    if (pastRes.data) setPastFlags(pastRes.data)
    setLoading(false)
  }

  async function handleSubmitAll() {
    setSubmitting(true)
    const updates = todayFlags.map(flag =>
      supabase
        .from('activity_flags')
        .update({ explanation: explanations[flag.id] || null })
        .eq('id', flag.id)
    )
    await Promise.all(updates)
    setSubmitting(false)
    setSubmitted(true)
    fetchFlags()
    setTimeout(() => setSubmitted(false), 3000)
  }

  function formatIST(ts: string) {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function formatDateIST(ts: string) {
    return new Date(ts).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, React.CSSProperties> = {
      pending:  { background: 'rgba(234,179,8,0.15)',  color: '#ca8a04' },
      approved: { background: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
      rejected: { background: 'rgba(239,68,68,0.15)',  color: '#dc2626' },
    }
    return (
      <span style={{
        ...(styles[status] ?? { background: 'rgba(255,255,255,0.08)', color: '#aaa' }),
        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
        textTransform: 'capitalize',
      }}>
        {status}
      </span>
    )
  }

  const allTodayExplained = todayFlags.length > 0 &&
    todayFlags.every(f => (explanations[f.id] ?? '').trim().length > 0)

  if (loading) return (
    <div style={{ padding: 20, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
  )

  return (
    <div style={{ padding: 20, maxWidth: 720 }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, color: '#e2d9ff', marginBottom: 4 }}>
        Activity Flags
      </h1>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
        Inactivity flags raised by the system. Add explanations for today's flags and submit.
      </p>

      {/* Today's flags */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: 16, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>
            Today's Flags
            {todayFlags.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 500,
                background: 'rgba(139,92,246,0.2)', color: '#c4b5fd',
                padding: '1px 7px', borderRadius: 10,
              }}>
                {todayFlags.length}
              </span>
            )}
          </h2>
        </div>

        {todayFlags.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
            No flags today. 
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {todayFlags.map((flag, i) => (
                <div key={flag.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        Flag #{i + 1}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        {formatIST(flag.flagged_at)}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        {flag.duration_minutes} min inactive
                      </span>
                    </div>
                    {statusBadge(flag.status)}
                  </div>

                  <textarea
                    value={explanations[flag.id] ?? ''}
                    onChange={e => setExplanations(prev => ({ ...prev, [flag.id]: e.target.value }))}
                    rows={2}
                    placeholder="Explain what you were doing during this time..."
                    disabled={flag.status !== 'pending'}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: flag.status !== 'pending'
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.05)',
                      border: '0.5px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, padding: '8px 10px',
                      fontSize: 12, color: '#e2d9ff',
                      resize: 'vertical', outline: 'none',
                      opacity: flag.status !== 'pending' ? 0.5 : 1,
                      cursor: flag.status !== 'pending' ? 'not-allowed' : 'text',
                    }}
                  />

                  {flag.admin_note && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px',
                      background: 'rgba(139,92,246,0.08)',
                      borderRadius: 5, fontSize: 11,
                      color: 'rgba(196,181,253,0.7)',
                    }}>
                      <span style={{ fontWeight: 500 }}>Admin note: </span>{flag.admin_note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {submitted && (
                <span style={{ fontSize: 12, color: '#4ade80' }}>
                  ✓ Explanations submitted
                </span>
              )}
              {!submitted && <span />}
              <button
                onClick={handleSubmitAll}
                disabled={submitting || !allTodayExplained}
                style={{
                  background: allTodayExplained
                    ? 'rgba(139,92,246,0.3)'
                    : 'rgba(255,255,255,0.05)',
                  border: `0.5px solid ${allTodayExplained ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 6, padding: '8px 20px',
                  fontSize: 13, fontWeight: 500,
                  color: allTodayExplained ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
                  cursor: (submitting || !allTodayExplained) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit All Explanations'}
              </button>
            </div>

            {!allTodayExplained && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 8, textAlign: 'right' }}>
                Fill in all explanations before submitting.
              </p>
            )}
          </>
        )}
      </div>

      {/* Past flags */}
      {pastFlags.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
            Past Flags
          </h2>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['Date', 'Duration', 'Status', 'Explanation', 'Admin Note'].map(h => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left',
                      fontSize: 10, color: 'rgba(255,255,255,0.3)',
                      fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderBottom: '0.5px solid rgba(255,255,255,0.08)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastFlags.map((flag, i) => (
                  <tr key={flag.id} style={{
                    borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.6)' }}>
                      {formatDateIST(flag.flagged_at)}
                    </td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)' }}>
                      {flag.duration_minutes} min
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      {statusBadge(flag.status)}
                    </td>
                    <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.45)', maxWidth: 180 }}>
                      {flag.explanation
                        ? <span title={flag.explanation}>
                            {flag.explanation.length > 50 ? flag.explanation.slice(0, 50) + '…' : flag.explanation}
                          </span>
                        : <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '9px 14px', color: 'rgba(196,181,253,0.6)', maxWidth: 160 }}>
                      {flag.admin_note
                        ? <span title={flag.admin_note}>
                            {flag.admin_note.length > 40 ? flag.admin_note.slice(0, 40) + '…' : flag.admin_note}
                          </span>
                        : <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
