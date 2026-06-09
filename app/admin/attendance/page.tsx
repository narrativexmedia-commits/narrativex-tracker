'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Employee = { id: string; full_name: string; };

type AttendanceRow = {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  ip_address: string | null;
  status: 'present' | 'late' | 'absent' | 'cl';
  employee: { full_name: string; };
};

type ManualForm = {
  employee_id: string;
  date: string;
  clock_in: string;
  clock_out: string;
  status: 'present' | 'late' | 'absent' | 'cl';
};

type EditForm = {
  id: string;
  clock_in: string;
  clock_out: string;
  status: 'present' | 'late' | 'absent' | 'cl';
  date: string;
};

const PAGE_SIZE = 20;

function formatTime(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

function calcHours(clockIn: string | null, clockOut: string | null): string {
  if (!clockIn || !clockOut) return '—';
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  if (diff <= 0) return '—';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function extractTime(ts: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).replace('.', ':');
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    cl: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };
  const labels: Record<string, string> = { present: 'Present', late: 'Late', absent: 'Absent', cl: 'CL' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

const emptyForm = (): ManualForm => ({
  employee_id: '',
  date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
  clock_in: '09:00',
  clock_out: '18:00',
  status: 'present',
});

export default function AttendancePage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterDate, setFilterDate] = useState(today);
  const [filterEmployee, setFilterEmployee] = useState('');

  // Manual entry modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    supabase.from('employees').select('id, full_name').eq('is_active', true).order('full_name')
      .then(({ data }) => { if (data) setEmployees(data); });
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('attendance')
      .select(`id, date, clock_in, clock_out, ip_address, status, employee:employees!attendance_employee_id_fkey(full_name)`, { count: 'exact' })
      .order('date', { ascending: false })
      .order('clock_in', { ascending: false })
      .range(from, to);

    if (filterDate) query = query.eq('date', filterDate);
    if (filterEmployee) query = query.eq('employee_id', filterEmployee);

    const { data, count, error } = await query;
    if (!error && data) { setRows(data as unknown as AttendanceRow[]); setTotalCount(count ?? 0); }
    setLoading(false);
  }, [page, filterDate, filterEmployee]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function openModal() { setForm(emptyForm()); setModalError(''); setShowModal(true); }
  function closeModal() { setShowModal(false); setModalError(''); }

  async function handleManualSubmit() {
    setModalError('');
    if (!form.employee_id) { setModalError('Select employee.'); return; }
    if (!form.date) { setModalError('Select date.'); return; }
    setSubmitting(true);

    const { data: existing } = await supabase
      .from('attendance').select('id').eq('employee_id', form.employee_id).eq('date', form.date).single();

    if (existing) { setModalError('Record already exists for this employee on this date.'); setSubmitting(false); return; }

    const toISO = (date: string, time: string) => {
      if (!time) return null;
      return new Date(`${date}T${time}:00+05:30`).toISOString();
    };

    const { error } = await supabase.from('attendance').insert({
      employee_id: form.employee_id,
      date: form.date,
      clock_in: form.clock_in ? toISO(form.date, form.clock_in) : null,
      clock_out: form.clock_out ? toISO(form.date, form.clock_out) : null,
      ip_address: 'manual-entry',
      status: form.status,
    });

    setSubmitting(false);
    if (error) { setModalError(error.message); return; }
    closeModal();
    fetchAttendance();
  }

  function openEditModal(row: AttendanceRow) {
    setEditForm({
      id: row.id,
      date: row.date,
      clock_in: extractTime(row.clock_in),
      clock_out: extractTime(row.clock_out),
      status: row.status,
    });
    setEditError('');
    setShowEditModal(true);
  }

  function closeEditModal() { setShowEditModal(false); setEditForm(null); setEditError(''); }

  async function handleEditSubmit() {
    if (!editForm) return;
    setEditError('');
    setEditSubmitting(true);

    const toISO = (date: string, time: string) => {
      if (!time) return null;
      return new Date(`${date}T${time}:00+05:30`).toISOString();
    };

    const { error } = await supabase
      .from('attendance')
      .update({
        status: editForm.status,
        clock_in: editForm.clock_in ? toISO(editForm.date, editForm.clock_in) : null,
        clock_out: editForm.clock_out ? toISO(editForm.date, editForm.clock_out) : null,
      })
      .eq('id', editForm.id);

    setEditSubmitting(false);
    if (error) { setEditError(error.message); return; }
    closeEditModal();
    fetchAttendance();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {totalCount} record{totalCount !== 1 ? 's' : ''} found
          </p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          <i className="ti ti-plus text-base" />
          Manual Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Employee</label>
            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]">
              <option value="">All Employees</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pb-0.5">
            <button onClick={() => { setPage(1); fetchAttendance(); }}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">Search</button>
            <button onClick={() => { setFilterDate(today); setFilterEmployee(''); setPage(1); }}
              className="h-9 px-4 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Clear</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                {['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Loading...
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500">No records found</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatTime(row.clock_in)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatTime(row.clock_out)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{calcHours(row.clock_in, row.clock_out)}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEditModal(row)}
                        title="Edit"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <i className="ti ti-pencil text-base" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p); return acc;
                }, [])
                .map((p, idx) => p === '...'
                  ? <span key={`e-${idx}`} className="h-8 w-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                  : <button key={p} onClick={() => setPage(p as number)}
                      className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${page === p ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p}</button>
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Manual Attendance Entry</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {modalError && (
                <div className="px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{modalError}</div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Employee</label>
                <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select employee</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clock In</label>
                  <input type="time" value={form.clock_in} onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clock Out</label>
                  <input type="time" value={form.clock_out} onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ManualForm['status'] }))}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="cl">Casual Leave (CL)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={closeModal}
                className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleManualSubmit} disabled={submitting}
                className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {submitting
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Edit Attendance Record</h2>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <i className="ti ti-x text-lg" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {editError && (
                <div className="px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{editError}</div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</label>
                <div className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-sm flex items-center">
                  {new Date(editForm.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clock In</label>
                  <input type="time" value={editForm.clock_in} onChange={e => setEditForm(f => f ? { ...f, clock_in: e.target.value } : f)}
                    className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Clock Out</label>
                  <input type="time" value={editForm.clock_out} onChange={e => setEditForm(f => f ? { ...f, clock_out: e.target.value } : f)}
                    className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => f ? { ...f, status: e.target.value as EditForm['status'] } : f)}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="cl">Casual Leave (CL)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={closeEditModal}
                className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleEditSubmit} disabled={editSubmitting}
                className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {editSubmitting
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}