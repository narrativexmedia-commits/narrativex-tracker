'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Stats = {
  present: number
  late: number
  absent: number
  notMarked: number
  totalEmployees: number
  totalWorkingDays: number
  avgAttendancePct: number
  payrollNetTotal: number
  payrollStatus: string | null
  payrollCount: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const now = new Date()
  const todayIST = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthStr = String(month).padStart(2, '0')
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  useEffect(() => {
    // Sync theme from admin layout toggle if needed — read from DOM
    const obs = new MutationObserver(() => {
      const bg = document.body.style.background
      setTheme(bg.includes('26') ? 'dark' : 'light')
    })
    obs.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Active employees
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true)

      const totalEmployees = employees?.length ?? 0
      const empIds = (employees ?? []).map(e => e.id)

      // Today's attendance
      const { data: todayAtt } = await supabase
        .from('attendance')
        .select('employee_id, status')
        .eq('date', todayIST)

      const markedIds = new Set((todayAtt ?? []).map(a => a.employee_id))
      const present = (todayAtt ?? []).filter(a => a.status === 'present').length
      const late = (todayAtt ?? []).filter(a => a.status === 'late').length
      const absent = (todayAtt ?? []).filter(a => a.status === 'absent').length
      const notMarked = empIds.filter(id => !markedIds.has(id)).length

      // Month attendance for avg
      const { data: monthAtt } = await supabase
        .from('attendance')
        .select('employee_id, status')
        .gte('date', `${year}-${monthStr}-01`)
        .lt('date', `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`)

      // Working days this month so far (Mon–Sat, no holidays)
      const { data: holidays } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', `${year}-${monthStr}-01`)
        .lt('date', `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`)

      const holidaySet = new Set((holidays ?? []).map(h => h.date))
      const todayDate = now.getDate()
      let totalWorkingDays = 0
      for (let d = 1; d <= todayDate; d++) {
        const date = new Date(year, month - 1, d)
        if (date.getDay() === 0) continue
        const ds = `${year}-${monthStr}-${String(d).padStart(2,'0')}`
        if (holidaySet.has(ds)) continue
        totalWorkingDays++
      }

      // Avg attendance % this month
      const presentThisMonth = (monthAtt ?? []).filter(a => a.status === 'present' || a.status === 'late').length
      const expectedThisMonth = totalEmployees * totalWorkingDays
      const avgAttendancePct = expectedThisMonth > 0
        ? Math.round((presentThisMonth / expectedThisMonth) * 100)
        : 0

      // Payroll summary current month
      const { data: payroll } = await supabase
        .from('payroll')
        .select('net_pay, status')
        .eq('month', month)
        .eq('year', year)

      const payrollNetTotal = (payroll ?? []).reduce((s, r) => s + r.net_pay, 0)
      const payrollCount = payroll?.length ?? 0
      const statuses = [...new Set((payroll ?? []).map(r => r.status))]
      const payrollStatus = statuses.length === 1 ? statuses[0] : statuses.length > 1 ? 'mixed' : null

      setStats({
        present, late, absent, notMarked,
        totalEmployees, totalWorkingDays,
        avgAttendancePct,
        payrollNetTotal, payrollStatus, payrollCount,
      })
      setLoading(false)
    }
    load()
  }, [])

  const d = theme === 'dark'

  const card = (style?: React.CSSProperties): React.CSSProperties => ({
    background: d ? '#12122a' : '#ffffff',
    border: d ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #e5e3f0',
    borderRadius: 10,
    padding: '18px 20px',
    ...style,
  })

  const label: React.CSSProperties = {
    fontSize: 11,
    color: d ? 'rgba(255,255,255,0.35)' : '#a09bc4',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginBottom: 6,
  }

  const bigNum: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    color: d ? '#e2d9ff' : '#2d2354',
    lineHeight: 1,
  }

  const sub: React.CSSProperties = {
    fontSize: 11,
    color: d ? 'rgba(255,255,255,0.3)' : '#b0abc8',
    marginTop: 4,
  }

  const payrollStatusColor: Record<string, string> = {
    draft: d ? '#facc15' : '#b45309',
    approved: d ? '#34d399' : '#065f46',
    paid: d ? '#60a5fa' : '#1e40af',
    mixed: d ? '#c4b5fd' : '#4c3d9e',
  }

  const todayLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: d ? 'rgba(255,255,255,0.3)' : '#a09bc4', marginBottom: 4 }}>{todayLabel}</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: d ? '#e2d9ff' : '#2d2354' }}>
          Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, Admin 👋
        </div>
      </div>

      {loading ? (
        <div style={{ color: d ? 'rgba(255,255,255,0.3)' : '#a09bc4', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
          Loading stats...
        </div>
      ) : !stats ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Today's attendance — 4 cards */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: d ? 'rgba(255,255,255,0.3)' : '#a09bc4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
              Today's Attendance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Present', value: stats.present, color: '#34d399' },
                { label: 'Late', value: stats.late, color: '#facc15' },
                { label: 'Absent', value: stats.absent, color: '#f87171' },
                { label: 'Not Marked', value: stats.notMarked, color: d ? 'rgba(255,255,255,0.3)' : '#a09bc4' },
              ].map(({ label: l, value, color }) => (
                <div key={l} style={card()}>
                  <div style={label}>{l}</div>
                  <div style={{ ...bigNum, color }}>{value}</div>
                  <div style={sub}>of {stats.totalEmployees} employees</div>
                </div>
              ))}
            </div>
          </div>

          {/* Month summary + Payroll */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Month attendance */}
            <div style={card()}>
              <div style={label}>{MONTHS[month - 1]} {year} — Attendance</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div>
                  <div style={{ ...bigNum, color: '#c4b5fd' }}>{stats.avgAttendancePct}%</div>
                  <div style={sub}>avg attendance</div>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: d ? '#e2d9ff' : '#2d2354' }}>{stats.totalWorkingDays}</div>
                  <div style={sub}>working days so far</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 14, height: 4, borderRadius: 4, background: d ? 'rgba(255,255,255,0.08)' : '#eeecff' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${stats.avgAttendancePct}%`,
                  background: stats.avgAttendancePct >= 80 ? '#34d399' : stats.avgAttendancePct >= 60 ? '#facc15' : '#f87171',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>

            {/* Payroll summary */}
            <div style={card()}>
              <div style={label}>{MONTHS[month - 1]} {year} — Payroll</div>
              {stats.payrollCount === 0 ? (
                <div style={{ fontSize: 13, color: d ? 'rgba(255,255,255,0.25)' : '#b0abc8', paddingTop: 8 }}>
                  Not generated yet
                </div>
              ) : (
                <>
                  <div style={{ ...bigNum, color: d ? '#e2d9ff' : '#2d2354' }}>
                    ₹{stats.payrollNetTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <div style={sub}>{stats.payrollCount} employees</div>
                    {stats.payrollStatus && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 20, textTransform: 'capitalize',
                        background: d ? 'rgba(255,255,255,0.06)' : '#f0eeff',
                        color: payrollStatusColor[stats.payrollStatus] ?? '#c4b5fd',
                      }}>
                        {stats.payrollStatus}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
