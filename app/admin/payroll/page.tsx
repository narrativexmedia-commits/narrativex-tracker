'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PayrollRow = {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  cl_days: number;
  lop_days: number;
  gross_salary: number;
  deduction: number;
  net_pay: number;
  status: 'draft' | 'approved' | 'paid';
  employee: { full_name: string; department: string; };
};

type Employee = {
  id: string;
  full_name: string;
  salary: number;
  is_active: boolean;
  exit_date: string | null;
};

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function exportCSV(rows: PayrollRow[], month: number, year: number) {
  const headers = ['Employee', 'Working Days', 'Present', 'Absent', 'CL', 'LOP', 'Gross', 'Deduction', 'Net Pay', 'Status'];
  const data = rows.map(r => [
    r.employee?.full_name ?? '',
    r.working_days, r.present_days, r.absent_days, r.cl_days, r.lop_days,
    r.gross_salary, r.deduction, r.net_pay, r.status,
  ]);
  const csv = [headers, ...data].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${months[month - 1]}-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(rows: PayrollRow[], month: number, year: number) {
  const headers = ['Employee', 'Working Days', 'Present', 'Absent', 'CL', 'LOP', 'Gross (₹)', 'Deduction (₹)', 'Net Pay (₹)', 'Status'];
  const data = rows.map(r => [
    r.employee?.full_name ?? '',
    r.working_days, r.present_days, r.absent_days, r.cl_days, r.lop_days,
    r.gross_salary, r.deduction, r.net_pay, r.status,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = [20, 14, 10, 10, 8, 8, 14, 14, 14, 10].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${months[month - 1]} ${year}`);
  XLSX.writeFile(wb, `payroll-${months[month - 1]}-${year}.xlsx`);
}

function exportPDF(rows: PayrollRow[], month: number, year: number) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(`Payroll — ${months[month - 1]} ${year}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 23);
  autoTable(doc, {
    startY: 28,
    head: [['Employee', 'Working Days', 'Present', 'Absent', 'CL', 'LOP', 'Gross (₹)', 'Deduction (₹)', 'Net Pay (₹)', 'Status']],
    body: rows.map(r => [
      r.employee?.full_name ?? '',
      r.working_days, r.present_days, r.absent_days, r.cl_days, r.lop_days,
      fmt(r.gross_salary), fmt(r.deduction), fmt(r.net_pay), r.status,
    ]),
    foot: [[
      'Total', '', '', '', '', '',
      fmt(rows.reduce((s, r) => s + r.gross_salary, 0)),
      fmt(rows.reduce((s, r) => s + r.deduction, 0)),
      fmt(rows.reduce((s, r) => s + r.net_pay, 0)),
      '',
    ]],
    headStyles: { fillColor: [30, 30, 60], textColor: 255, fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 255] },
  });
  doc.save(`payroll-${months[month - 1]}-${year}.pdf`);
}

function generatePayslip(row: PayrollRow) {
  const perDay = (row.gross_salary / row.working_days).toFixed(2);
  const monthName = months[row.month - 1];
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payslip - ${monthName} ${row.year}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,sans-serif;padding:40px;color:#1a1a2e;}
.header{border-bottom:2px solid #7c3aed;padding-bottom:16px;margin-bottom:24px;}
.company{font-size:20px;font-weight:700;color:#7c3aed;}
.subtitle{font-size:13px;color:#666;margin-top:2px;}
.meta{display:flex;justify-content:space-between;margin-bottom:24px;}
.meta-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.05em;}
.meta-value{font-size:14px;font-weight:600;margin-top:2px;}
table{width:100%;border-collapse:collapse;}
tr{border-bottom:1px solid #f0f0f0;}
td{padding:10px 12px;font-size:13px;}
td:last-child{text-align:right;font-weight:500;}
.net td{background:#f5f0ff;font-weight:700;font-size:14px;color:#7c3aed;border-bottom:none;}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;}
.footer{margin-top:32px;font-size:11px;color:#aaa;text-align:center;}
</style>
</head>
<body>
<div class="header">
  <div class="company">NarrativeX Media</div>
  <div class="subtitle">Payslip &#8212; ${monthName} ${row.year}</div>
</div>
<div class="meta">
  <div><div class="meta-label">Employee</div><div class="meta-value">${row.employee?.full_name ?? '—'}</div></div>
  <div><div class="meta-label">Department</div><div class="meta-value">${row.employee?.department ?? '—'}</div></div>
  <div><div class="meta-label">Status</div><div class="meta-value">
    <span class="badge" style="background:${row.status === 'paid' ? '#dcfce7' : '#ede9fe'};color:${row.status === 'paid' ? '#16a34a' : '#7c3aed'}">
      ${row.status.charAt(0).toUpperCase() + row.status.slice(1)}
    </span>
  </div></div>
</div>
<table>
  <tr><td>Gross Salary</td><td>&#8377;${fmt(row.gross_salary)}</td></tr>
  <tr><td>Working Days</td><td>${row.working_days}</td></tr>
  <tr><td>Present Days</td><td>${row.present_days}</td></tr>
  <tr><td>Absent Days</td><td>${row.absent_days}</td></tr>
  <tr><td>CL Days Used</td><td>${row.cl_days}</td></tr>
  <tr><td>LOP Days</td><td>${row.lop_days}</td></tr>
  <tr><td>Per Day Rate</td><td>&#8377;${perDay}</td></tr>
  <tr><td>Deduction</td><td>&#8377;${fmt(row.deduction)}</td></tr>
  <tr class="net"><td>Net Pay</td><td>&#8377;${fmt(row.net_pay)}</td></tr>
</table>
<div class="footer">Generated on ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} &#183; NarrativeX Media</div>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.focus();
}

function getWorkingDays(year: number, month: number, holidays: string[]): number {
  const holidaySet = new Set(holidays);
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === 0) continue;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (holidaySet.has(dateStr)) continue;
    count++;
  }
  return count;
}

export default function PayrollPage() {
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const years = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    supabase.from('employees').select('id, full_name, salary, is_active, exit_date')
      .eq('is_active', true).order('full_name')
      .then(({ data }) => setActiveEmployees(data ?? []));
  }, []);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('payroll')
      .select('*, employee:employees!payroll_employee_id_fkey(full_name, department)')
      .eq('month', filterMonth)
      .eq('year', filterYear);
    if (filterEmployee !== 'all') query = query.eq('employee_id', filterEmployee);
    const { data, error } = await query.order('employee(full_name)', { ascending: true });
    if (!error && data) setPayrollRows(data as unknown as PayrollRow[]);
    else setPayrollRows([]);
    setSelectedIds(new Set());
    setLoading(false);
  }, [filterMonth, filterYear, filterEmployee]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  async function handleGenerate() {
    setMessage(null);
    setGenerating(true);

    const { data: existing } = await supabase
      .from('payroll')
      .select('id, status, employee_id')
      .eq('month', filterMonth)
      .eq('year', filterYear);

    if (existing && existing.length > 0) {
      const relevant = filterEmployee === 'all'
        ? existing
        : existing.filter(r => r.employee_id === filterEmployee);
      const hasLocked = relevant.some(r => r.status === 'approved' || r.status === 'paid');
      if (hasLocked) {
        setMessage({ type: 'error', text: 'Payroll already approved or paid. Cannot regenerate.' });
        setGenerating(false);
        return;
      }
      let delQuery = supabase.from('payroll').delete()
        .eq('month', filterMonth).eq('year', filterYear).eq('status', 'draft');
      if (filterEmployee !== 'all') delQuery = delQuery.eq('employee_id', filterEmployee);
      await delQuery;
    }

    let empQuery = supabase
      .from('employees')
      .select('id, full_name, salary, is_active, exit_date')
      .eq('is_active', true);
    if (filterEmployee !== 'all') empQuery = empQuery.eq('id', filterEmployee);
    const { data: employees } = await empQuery;

    if (!employees || employees.length === 0) {
      setMessage({ type: 'error', text: 'No active employees found.' });
      setGenerating(false);
      return;
    }

    const monthStr = String(filterMonth).padStart(2, '0');
    const nextMonth = filterMonth === 12 ? 1 : filterMonth + 1;
    const nextYear = filterMonth === 12 ? filterYear + 1 : filterYear;
    const nextMonthStr = String(nextMonth).padStart(2, '0');

    const { data: holidays } = await supabase
      .from('holidays')
      .select('date')
      .gte('date', `${filterYear}-${monthStr}-01`)
      .lt('date', `${nextYear}-${nextMonthStr}-01`);

    const holidayDates = (holidays ?? []).map((h: { date: string }) => h.date);
    const workingDays = getWorkingDays(filterYear, filterMonth, holidayDates);

    const { data: attendance } = await supabase
      .from('attendance')
      .select('employee_id, status')
      .gte('date', `${filterYear}-${monthStr}-01`)
      .lt('date', `${nextYear}-${nextMonthStr}-01`);

    const attendanceMap: Record<string, { present: number; cl: number; }> = {};
    (attendance ?? []).forEach((a: { employee_id: string; status: string }) => {
      if (!attendanceMap[a.employee_id]) attendanceMap[a.employee_id] = { present: 0, cl: 0 };
      if (a.status === 'present' || a.status === 'late') attendanceMap[a.employee_id].present++;
      if (a.status === 'cl') attendanceMap[a.employee_id].cl++;
    });

    const records = (employees as Employee[]).map(emp => {
      const att = attendanceMap[emp.id] ?? { present: 0, cl: 0 };
      const presentDays = att.present;
      const clDays = att.cl;
      let daysToPayFor = workingDays;
      if (emp.exit_date) {
        const exit = new Date(emp.exit_date);
        const exitMonth = exit.getMonth() + 1;
        const exitYear = exit.getFullYear();
        if (exitMonth === filterMonth && exitYear === filterYear) {
          let count = 0;
          for (let d = 1; d <= exit.getDate(); d++) {
            const date = new Date(filterYear, filterMonth - 1, d);
            if (date.getDay() === 0) continue;
            const dateStr = `${filterYear}-${String(filterMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            if (holidayDates.includes(dateStr)) continue;
            count++;
          }
          daysToPayFor = count;
        }
      }
      const absentDays = Math.max(0, daysToPayFor - presentDays - clDays);
      const lopDays = Math.max(0, absentDays - clDays);
      const perDay = workingDays > 0 ? emp.salary / workingDays : 0;
      const earnedPay = parseFloat((perDay * daysToPayFor).toFixed(2));
      const deduction = parseFloat((perDay * lopDays).toFixed(2));
      const netPay = parseFloat((earnedPay - deduction).toFixed(2));
      return {
        employee_id: emp.id,
        month: filterMonth,
        year: filterYear,
        working_days: daysToPayFor,
        present_days: presentDays,
        absent_days: absentDays,
        cl_days: clDays,
        lop_days: lopDays,
        gross_salary: emp.salary,
        deduction,
        net_pay: netPay,
        status: 'draft',
      };
    });

    const { error: insertError } = await supabase.from('payroll').insert(records);
    setGenerating(false);
    if (insertError) { setMessage({ type: 'error', text: insertError.message }); return; }
    setMessage({ type: 'success', text: `Payroll generated for ${months[filterMonth - 1]} ${filterYear}.` });
    fetchPayroll();
  }

  async function handleApproveAll() {
    setApproving(true);
    setMessage(null);
    const ids = payrollRows.filter(r => r.status === 'draft').map(r => r.id);
    if (ids.length === 0) { setApproving(false); return; }
    const { error } = await supabase
      .from('payroll')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .in('id', ids);
    setApproving(false);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: 'All drafts approved.' });
    fetchPayroll();
  }

  async function handleApproveSelected() {
    setApproving(true);
    setMessage(null);
    const ids = [...selectedIds].filter(id => payrollRows.find(r => r.id === id && r.status === 'draft'));
    if (ids.length === 0) { setApproving(false); return; }
    const { error } = await supabase
      .from('payroll')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .in('id', ids);
    setApproving(false);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: `${ids.length} employee(s) approved.` });
    fetchPayroll();
  }

  async function handleMarkPaid() {
    setMessage(null);
    const ids = payrollRows.filter(r => r.status === 'approved').map(r => r.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('payroll')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: 'Payroll marked as paid.' });
    fetchPayroll();
  }

  async function handleRefresh() {
    setMessage(null);
    let delQuery = supabase.from('payroll').delete()
      .eq('month', filterMonth).eq('year', filterYear).eq('status', 'draft');
    if (filterEmployee !== 'all') delQuery = delQuery.eq('employee_id', filterEmployee);
    await delQuery;
    fetchPayroll();
  }

  const draftRows = payrollRows.filter(r => r.status === 'draft');
  const isDraft = payrollRows.length > 0 && payrollRows.every(r => r.status === 'draft');
  const isApproved = payrollRows.length > 0 && payrollRows.every(r => r.status === 'approved');
  const isPaid = payrollRows.length > 0 && payrollRows.every(r => r.status === 'paid');
  const hasRows = payrollRows.length > 0;
  const hasDrafts = draftRows.length > 0;

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };

  const spinnerSVG = (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {payrollRows.length > 0 ? `${payrollRows.length} employees` : 'No payroll generated yet'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Approve Selected */}
          {selectedIds.size > 0 && (
            <button onClick={handleApproveSelected} disabled={approving}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {approving ? spinnerSVG : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              Approve Selected ({selectedIds.size})
            </button>
          )}
          {/* Approve All */}
          {isDraft && (
            <button onClick={handleApproveAll} disabled={approving}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {approving ? spinnerSVG : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              Approve All
            </button>
          )}
          {/* Mark Paid */}
          {isApproved && (
            <button onClick={handleMarkPaid}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Mark as Paid
            </button>
          )}
          {/* Generate */}
          <button onClick={handleGenerate} disabled={generating || isPaid}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
            {generating ? spinnerSVG : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
            Generate Payroll
          </button>
          {/* Exports */}
          {hasRows && (
            <div className="flex gap-2">
              <button onClick={() => exportCSV(payrollRows, filterMonth, filterYear)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
              <button onClick={() => exportExcel(payrollRows, filterMonth, filterYear)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Excel
              </button>
              <button onClick={() => exportPDF(payrollRows, filterMonth, filterYear)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Month</label>
            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]">
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Year</label>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Employee</label>
            <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]">
              <option value="all">All Employees</option>
              {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          {hasDrafts && (
            <button onClick={handleRefresh}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                {['', 'Employee', 'Working Days', 'Present', 'Absent', 'CL', 'LOP', 'Gross', 'Deduction', 'Net Pay', 'Status', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={13} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <div className="flex items-center justify-center gap-2">{spinnerSVG} Loading...</div>
                </td></tr>
              ) : payrollRows.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  No payroll generated for {months[filterMonth - 1]} {filterYear}
                </td></tr>
              ) : (
                payrollRows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      {row.status === 'draft' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={e => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              e.target.checked ? next.add(row.id) : next.delete(row.id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-purple-600 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.working_days}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.present_days}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.absent_days}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.cl_days}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.lop_days}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">₹{fmt(row.gross_salary)}</td>
                    <td className="px-4 py-3 text-red-600 dark:text-red-400">
                      {row.deduction > 0 ? `−₹${fmt(row.deduction)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">₹{fmt(row.net_pay)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => generatePayslip(row)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Payslip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {payrollRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200" colSpan={6}>Total</td>
                  <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    ₹{fmt(payrollRows.reduce((s, r) => s + r.gross_salary, 0))}
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600 dark:text-red-400">
                    −₹{fmt(payrollRows.reduce((s, r) => s + r.deduction, 0))}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    ₹{fmt(payrollRows.reduce((s, r) => s + r.net_pay, 0))}
                  </td>
                  <td /><td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
