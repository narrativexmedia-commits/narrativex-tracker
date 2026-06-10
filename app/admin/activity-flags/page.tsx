'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Flag = {
  id: string
  employee_id: string
  flagged_at: string
  duration_minutes: number
  explanation: string | null
  status: string
  admin_note: string | null
  reviewed_at: string | null
  profiles: { full_name: string } | null
}

type Employee = { id: string; full_name: string }

export default function ActivityFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    fetchFlags()
  }, [filterStatus, filterEmployee, filterDate])

  async function fetchEmployees() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'employee')
      .order('full_name')
    if (data) setEmployees(data)
  }

  async function fetchFlags() {
    setLoading(true)
    let query = supabase
      .from('activity_flags')
      .select('*, profiles(full_name)')
      .order('flagged_at', { ascending: false })

    if (filterStatus) query = query.eq('status', filterStatus)
    if (filterEmployee) query = query.eq('employee_id', filterEmployee)
    if (filterDate) {
      const start = `${filterDate}T00:00:00+05:30`
      const end = `${filterDate}T23:59:59+05:30`
      query = query.gte('flagged_at', start).lte('flagged_at', end)
    }

    const { data } = await query
    if (data) setFlags(data as Flag[])
    setLoading(false)
  }

  function openModal(flag: Flag) {
    setSelectedFlag(flag)
    setAdminNote(flag.admin_note || '')
  }

  function closeModal() {
    setSelectedFlag(null)
    setAdminNote('')
  }

  async function handleReview(newStatus: 'approved' | 'rejected') {
    if (!selectedFlag) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('activity_flags')
      .update({
        status: newStatus,
        admin_note: adminNote || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', selectedFlag.id)
    setSaving(false)
    closeModal()
    fetchFlags()
  }

  function formatIST(ts: string) {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 6, padding: '7px 10px',
    fontSize: 12, color: '#e2d9ff',
    outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, color: '#e2d9ff', marginBottom: 20 }}>
        Activity Flags
      </h1>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={inputStyle}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={filterEmployee}
          onChange={e => setFilterEmployee(e.target.value)}
          style={inputStyle}
        >
          <option value="">All Employees</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={inputStyle}
        />

        {(filterStatus || filterEmployee || filterDate) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterEmployee(''); setFilterDate('') }}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(196,181,253,0.5)', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Loading...</p>
      ) : flags.length === 0 ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No flags found.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Employee', 'Flagged At (IST)', 'Duration', 'Status', 'Explanation', 'Action'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11, color: 'rgba(255,255,255,0.3)',
                    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px',
                    borderBottom: '0.5px solid rgba(255,255,255,0.08)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flags.map((flag, i) => (
                <tr key={flag.id} style={{
                  borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}>
                  <td style={{ padding: '10px 14px', color: '#e2d9ff', fontWeight: 500 }}>
                    {flag.profiles?.full_name ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)' }}>
                    {formatIST(flag.flagged_at)}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)' }}>
                    {flag.duration_minutes} min
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {statusBadge(flag.status)}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)', maxWidth: 200 }}>
                    {flag.explanation
                      ? <span style={{ color: 'rgba(255,255,255,0.6)' }} title={flag.explanation}>
                          {flag.explanation.length > 60 ? flag.explanation.slice(0, 60) + '…' : flag.explanation}
                        </span>
                      : <span style={{ fontStyle: 'italic', fontSize: 11 }}>No explanation</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => openModal(flag)}
                      style={{
                        background: 'rgba(139,92,246,0.2)',
                        border: '0.5px solid rgba(139,92,246,0.4)',
                        borderRadius: 4, padding: '4px 10px',
                        fontSize: 11, color: '#c4b5fd',
                        cursor: 'pointer', fontWeight: 500,
                      }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {selectedFlag && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: '#1a1a2e',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: 24,
            width: '100%', maxWidth: 460,
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2d9ff', marginBottom: 16 }}>
              Review Flag
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[
                ['Employee', selectedFlag.profiles?.full_name ?? '—'],
                ['Flagged At', formatIST(selectedFlag.flagged_at)],
                ['Duration', `${selectedFlag.duration_minutes} min`],
                ['Status', selectedFlag.status],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', width: 90, flexShrink: 0 }}>{label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                Employee Explanation
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '10px 12px',
                fontSize: 13, color: 'rgba(255,255,255,0.6)',
                minHeight: 60,
              }}>
                {selectedFlag.explanation
                  ? selectedFlag.explanation
                  : <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.25)' }}>Not submitted yet</span>
                }
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 6 }}>
                Admin Note (optional)
              </label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                rows={3}
                placeholder="Add a note..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, padding: '8px 10px',
                  fontSize: 13, color: '#e2d9ff',
                  resize: 'vertical', outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                style={{
                  background: 'none', border: '0.5px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview('rejected')}
                disabled={saving}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '0.5px solid rgba(239,68,68,0.3)',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, color: '#f87171',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                Reject
              </button>
              <button
                onClick={() => handleReview('approved')}
                disabled={saving}
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  border: '0.5px solid rgba(34,197,94,0.3)',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, color: '#4ade80',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
