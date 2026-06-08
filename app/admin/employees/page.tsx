'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Employee = {
  id: string
  full_name: string
  email: string
  phone: string
  department: string
  join_date: string
  role: string
  salary: number
  is_active: boolean
}

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  department: '',
  join_date: '',
  role: 'employee',
  salary: '',
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchEmployees = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
    setEmployees(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  const openAdd = () => {
    setForm(emptyForm)
    setEditId(null)
    setError('')
    setShowModal(true)
  }

  const openEdit = (emp: Employee) => {
    setForm({
      full_name: emp.full_name,
      email: emp.email,
      phone: emp.phone ?? '',
      department: emp.department ?? '',
      join_date: emp.join_date ?? '',
      role: emp.role,
      salary: String(emp.salary),
    })
    setEditId(emp.id)
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.full_name || !form.email) {
      setError('Name and email required.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      department: form.department,
      join_date: form.join_date || null,
      role: form.role,
      salary: parseFloat(form.salary as string) || 0,
    }
    if (editId) {
      const { error: e } = await supabase.from('employees').update(payload).eq('id', editId)
      if (e) setError(e.message)
    } else {
      const { error: e } = await supabase.from('employees').insert(payload)
      if (e) setError(e.message)
    }
    setSaving(false)
    if (!error) {
      setShowModal(false)
      fetchEmployees()
    }
  }

  const handleDeactivate = async (id: string, current: boolean) => {
    await supabase.from('employees').update({ is_active: !current }).eq('id', id)
    fetchEmployees()
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
    border: '0.5px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)', color: '#e2d9ff',
    outline: 'none', marginTop: 4,
  }

  const departments = ['Content', 'Design', 'Social Media', 'Video', 'Management', 'Other']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#e2d9ff' }}>Employees</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            {employees.filter(e => e.is_active).length} active
          </div>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 6, fontSize: 13,
            background: 'rgba(139,92,246,0.3)', border: '0.5px solid rgba(139,92,246,0.5)',
            color: '#c4b5fd', cursor: 'pointer',
          }}
        >
          <i className="ti ti-plus" aria-hidden="true" />
          Add Employee
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Loading...</div>
      ) : employees.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No employees yet. Add one.</div>
      ) : (
        <div style={{ background: '#12122a', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px',
            padding: '9px 16px', fontSize: 11,
            color: 'rgba(255,255,255,0.3)', borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          }}>
            <div>Name</div>
            <div>Email</div>
            <div>Department</div>
            <div>Role</div>
            <div>Status</div>
            <div></div>
          </div>

          {employees.map(emp => (
            <div
              key={emp.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px',
                padding: '10px 16px', fontSize: 13,
                borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#e2d9ff', fontWeight: 500 }}>{emp.full_name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{emp.phone}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{emp.email}</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{emp.department || '—'}</div>
              <div>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: emp.role === 'admin' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.07)',
                  color: emp.role === 'admin' ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                }}>
                  {emp.role}
                </span>
              </div>
              <div>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: emp.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
                  color: emp.is_active ? '#4ade80' : 'rgba(255,255,255,0.3)',
                }}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => openEdit(emp)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}
                >
                  <i className="ti ti-edit" aria-hidden="true" />
                </button>
                <button
                  onClick={() => handleDeactivate(emp.id, emp.is_active)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: emp.is_active ? 'rgba(251,191,36,0.7)' : 'rgba(74,222,128,0.7)', fontSize: 16 }}
                  title={emp.is_active ? 'Deactivate' : 'Activate'}
                >
                  <i className={`ti ${emp.is_active ? 'ti-user-off' : 'ti-user-check'}`} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#12122a', border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: 24, width: '100%', maxWidth: 480,
          }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#e2d9ff', marginBottom: 20 }}>
              {editId ? 'Edit Employee' : 'Add Employee'}
            </div>

            {/* Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Full Name *</label>
                <input style={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Vijaya" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Email *</label>
                <input style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vijaya@narrativexmedia.in" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Phone</label>
                <input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Join Date</label>
                <input style={inp} type="date" value={form.join_date} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Department</label>
                <select style={{ ...inp }} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Role</label>
                <select style={{ ...inp }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Salary (INR/month)</label>
                <input style={inp} type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="25000" />
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: '#f87171', marginTop: 12 }}>{error}</div>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px', borderRadius: 6, fontSize: 13,
                  background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 6, fontSize: 13,
                  background: 'rgba(139,92,246,0.3)', border: '0.5px solid rgba(139,92,246,0.5)',
                  color: '#c4b5fd', cursor: 'pointer',
                }}
              >
                {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}