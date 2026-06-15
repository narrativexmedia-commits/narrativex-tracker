'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAILY_HOURS = 7.25; // 9:30–18:00 minus 1h15m break

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
  worked_hours: number;
  expected_hours: number;
  gross_salary: number;
  deduction: number;
  net_pay: number;
  status: 'draft' | 'approved' | 'paid';
  employee: { full_name: string; department: string };
};

type Employee = {
  id: string;
  full_name: string;
  salary: number;
  is_active: boolean;
  exit_date: string | null;
};

type Tab = 'draft' | 'approved' | 'paid';

const months = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtHrs(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function exportCSV(rows: PayrollRow[], month: number, year: number) {
  const headers = ['Employee','Working Days','Present','Absent','CL','LOP','Worked Hrs','Expected Hrs','Gross','Deduction','Net Pay','Status'];
  const data = rows.map(r => [
    r.employee?.full_name ?? '',
    r.working_days, r.present_days, r.absent_days, r.cl_days, r.lop_days,
    r.worked_hours?.toFixed(2) ?? 0, r.expected_hours?.toFixed(2) ?? 0,
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
  const headers = ['Employee','Working Days','Present','Absent','CL','LOP','Worked Hrs','Expected Hrs','Gross (₹)','Deduction (₹)','Net Pay (₹)','Status'];
  const data = rows.map(r => [
    r.employee?.full_name ?? '',
    r.working_days, r.present_days, r.absent_days, r.cl_days, r.lop_days,
    r.worked_hours?.toFixed(2) ?? 0, r.expected_hours?.toFixed(2) ?? 0,
    r.gross_salary, r.deduction, r.net_pay, r.status,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = [20, 14, 10, 10, 8, 8, 12, 12, 14, 14, 14, 10].map(w => ({ wch: w }));
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
    head: [['Employee','Working Days','Present','Absent','CL','LOP','Worked Hrs','Expected Hrs','Gross (₹)','Deduction (₹)','Net Pay (₹)','Status']],
    body: rows.map(r => [
      r.employee?.full_name ?? '',
      r.working_days, r.present_days, r.absent_days, r.cl_days, r.lop_days,
      fmtHrs(r.worked_hours ?? 0), fmtHrs(r.expected_hours ?? 0),
      fmt(r.gross_salary), fmt(r.deduction), fmt(r.net_pay), r.status,
    ]),
    foot: [[
      'Total','','','','','','','',
      fmt(rows.reduce((s, r) => s + r.gross_salary, 0)),
      fmt(rows.reduce((s, r) => s + r.deduction, 0)),
      fmt(rows.reduce((s, r) => s + r.net_pay, 0)),
      '',
    ]],
    headStyles: { fillColor: [30, 30, 60], textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 255] },
  });
  doc.save(`payroll-${months[month - 1]}-${year}.pdf`);
}

function generatePayslip(row: PayrollRow) {
  const hourlyRate = row.expected_hours > 0
    ? (row.gross_salary / row.expected_hours).toFixed(2)
    : '0.00';
  const monthName = months[row.month - 1];
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
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
</style></head><body>
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
  <tr><td>Expected Hours</td><td>${fmtHrs(row.expected_hours ?? 0)}</td></tr>
  <tr><td>Hourly Rate</td><td>&#8377;${hourlyRate}/hr</td></tr>
  <tr><td>Present Days</td><td>${row.present_days}</td></tr>
  <tr><td>Worked Hours</td><td>${fmtHrs(row.worked_hours ?? 0)}</td></tr>
  <tr><td>Absent Days</td><td>${row.absent_days}</td></tr>
  <tr><td>CL Days Used</td><td>${row.cl_days}</td></tr>
  <tr><td>LOP Days</td><td>${row.lop_days}</td></tr>
  <tr><td>Deduction</td><td>&#8377;${fmt(row.deduction)}</td></tr>
  <tr class="net"><td>Net Pay</td><td>&#8377;${fmt(row.net_pay)}</td></tr>
</table>
<div class="footer">Generated on ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} &#183; NarrativeX Media</div>
</body></html>`;
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
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (holidaySet.has(dateStr)) continue;
    count++;
  }
  return count;
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

function ExportButtons({ rows, month, year }: { rows: PayrollRow[]; month: number; year: number }) {
  const btnCls = 'flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
  return (
    <div className="flex gap-2">
      <button onClick={() => exportCSV(rows, month, year)} className={btnCls}><i className="ti ti-download text-xs" /> CSV</button>
      <button onClick={() => exportExcel(rows, month, year)} className={btnCls}><i className="ti ti-download text-xs" /> Excel</button>
      <button onClick={() => exportPDF(rows, month, year)} className={btnCls}><i className="ti ti-download text-xs" /> PDF</button>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center">
      <i className={`ti ${icon} text-3xl text-gray-300 dark:text-gray-600 mb-2 block`} />
      <p className="text-sm text-gray-400 dark:text-gray-500">{text}</p>
    </div>
  );
}

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>('draft');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [allPayrollRows, setAllPayrollRows] = useState<PayrollRow[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const years = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setEmpDropdownOpen(false);
      }
    }
    if (empDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [empDropdownOpen]);

  // ─── Derived state ────────────────────────────────────────────────────────
  const draftRows    = useMemo(() => allPayrollRows.filter(r => r.status === 'draft'),    [allPayrollRows]);
  const approvedRows = useMemo(() => allPayrollRows.filter(r => r.status === 'approved'), [allPayrollRows]);
  const paidRows     = useMemo(() => allPayrollRows.filter(r => r.status === 'paid'),     [allPayrollRows]);

  const employeesWithRecord    = useMemo(() => new Set(allPayrollRows.map(r => r.employee_id)), [allPayrollRows]);
  const employeesWithoutRecord = useMemo(() => activeEmployees.filter(e => !employeesWithRecord.has(e.id)), [activeEmployees, employeesWithRecord]);

  const currentTabRows = activeTab === 'draft' ? draftRows : activeTab === 'approved' ? approvedRows : paidRows;
  const currentTabSelectedIds = currentTabRows.map(r => r.id).filter(id => selectedTableIds.has(id));

  // ─── Data fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('employees')
      .select('id, full_name, salary, is_active, exit_date')
      .eq('is_active', true).order('full_name')
      .then(({ data }) => setActiveEmployees(data ?? []));
  }, []);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll')
      .select('*, employee:employees!payroll_employee_id_fkey(full_name, department)')
      .eq('month', filterMonth)
      .eq('year', filterYear)
      .order('employee(full_name)', { ascending: true });
    if (!error && data) setAllPayrollRows(data as unknown as PayrollRow[]);
    else setAllPayrollRows([]);
    setSelectedTableIds(new Set());
    setSelectedEmpIds(new Set());
    setLoading(false);
  }, [filterMonth, filterYear]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  // ─── Generate payroll (hourly) ────────────────────────────────────────────
  async function handleGenerate() {
    if (selectedEmpIds.size === 0) {
      setMessage({ type: 'error', text: 'Select at least one employee to generate payroll.' });
      return;
    }
    setMessage(null);
    setGenerating(true);
    setEmpDropdownOpen(false);

    const empIds = [...selectedEmpIds];
    const empsToProcess = activeEmployees.filter(e => empIds.includes(e.id));

    const monthStr   = String(filterMonth).padStart(2, '0');
    const nextMonth  = filterMonth === 12 ? 1 : filterMonth + 1;
    const nextYear   = filterMonth === 12 ? filterYear + 1 : filterYear;
    const nextMonthStr = String(nextMonth).padStart(2, '0');

    const { data: holidays } = await supabase
      .from('holidays').select('date')
      .gte('date', `${filterYear}-${monthStr}-01`)
      .lt('date', `${nextYear}-${nextMonthStr}-01`);

    const holidayDates  = (holidays ?? []).map(h => h.date);
    const daysToPayFor  = getWorkingDays(filterYear, filterMonth, holidayDates);
    const expectedHours = parseFloat((daysToPayFor * DAILY_HOURS).toFixed(2));

    const records = await Promise.all(empsToProcess.map(async (emp) => {
      const { data: attRows } = await supabase
        .from('attendance')
        .select('date, status, clock_in, clock_out')
        .eq('employee_id', emp.id)
        .gte('date', `${filterYear}-${monthStr}-01`)
        .lt('date', `${nextYear}-${nextMonthStr}-01`);

      const att = attRows ?? [];

      // ── Hourly calculation ──────────────────────────────────────────────
      let workedHours = 0;
      let presentDays = 0;

      for (const a of att) {
        if (!a.clock_in || !a.clock_out) continue; // skip — no checkout
        const diffMs  = new Date(a.clock_out).getTime() - new Date(a.clock_in).getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        if (diffHrs <= 0) continue;
        workedHours += Math.min(diffHrs, DAILY_HOURS); // cap at 7.25h/day
        presentDays++;
      }

      workedHours = parseFloat(workedHours.toFixed(4));

      const absentDays = daysToPayFor - presentDays;
      const clDays     = Math.min(2, absentDays);
      const lopDays    = Math.max(0, absentDays - clDays);

      // CL days are paid at full daily rate
      const paidHours  = workedHours + clDays * DAILY_HOURS;
      const hourlyRate = emp.salary > 0 ? emp.salary / expectedHours : 0;
      const netPay     = parseFloat(Math.min(paidHours * hourlyRate, emp.salary).toFixed(2));
      const deduction  = parseFloat((emp.salary - netPay).toFixed(2));

      return {
        employee_id:    emp.id,
        month:          filterMonth,
        year:           filterYear,
        working_days:   daysToPayFor,
        present_days:   presentDays,
        absent_days:    absentDays,
        cl_days:        clDays,
        lop_days:       lopDays,
        worked_hours:   workedHours,
        expected_hours: expectedHours,
        gross_salary:   emp.salary,
        deduction,
        net_pay:        netPay,
        status:         'draft',
      };
    }));

    const { error: insertError } = await supabase.from('payroll').insert(records);
    setGenerating(false);
    if (insertError) { setMessage({ type: 'error', text: insertError.message }); return; }
    setMessage({ type: 'success', text: `Payroll draft generated for ${records.length} employee(s).` });
    setSelectedEmpIds(new Set());
    fetchPayroll();
  }

  async function handleDelete(ids: string[]) {
    setDeleting(true);
    const { error } = await supabase.from('payroll').delete().in('id', ids);
    setDeleting(false);
    setDeleteConfirm(null);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: `${ids.length} record(s) deleted.` });
    fetchPayroll();
  }

  async function handleApprove(ids: string[]) {
    const { error } = await supabase.from('payroll')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: `${ids.length} record(s) approved.` });
    fetchPayroll();
  }

  async function handleMarkPaid(ids: string[]) {
    const { error } = await supabase.from('payroll')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: `${ids.length} record(s) marked as paid.` });
    fetchPayroll();
  }

  // ─── Selection helpers ────────────────────────────────────────────────────
  function toggleSelectAll(rows: PayrollRow[]) {
    const ids       = rows.map(r => r.id);
    const allChosen = ids.length > 0 && ids.every(id => selectedTableIds.has(id));
    setSelectedTableIds(prev => {
      const next = new Set(prev);
      if (allChosen) ids.forEach(id => next.delete(id));
      else           ids.forEach(id => next.add(id));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedTableIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleEmpSelect(id: string) {
    setSelectedEmpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllEmps() {
    if (selectedEmpIds.size === employeesWithoutRecord.length) setSelectedEmpIds(new Set());
    else setSelectedEmpIds(new Set(employeesWithoutRecord.map(e => e.id)));
  }

  // ─── Table components ─────────────────────────────────────────────────────
  // colSpan for "Total" label = checkbox(1) + employee + working_days + present + absent + cl + lop + worked_hrs + expected_hrs = 9
  const COL_HEADERS = ['Employee','Working Days','Present','Absent','CL','LOP','Worked Hrs','Expected Hrs','Gross','Deduction','Net Pay'];

  function TableHeader({ rows, showCheckbox = true }: { rows: PayrollRow[]; showCheckbox?: boolean }) {
    return (
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
          {showCheckbox && (
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={rows.length > 0 && rows.every(r => selectedTableIds.has(r.id))}
                onChange={() => toggleSelectAll(rows)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
            </th>
          )}
          {COL_HEADERS.map(h => (
            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
          ))}
          <th className="px-4 py-3 w-20" />
        </tr>
      </thead>
    );
  }

  function TableRow({ row, showCheckbox = true, showDelete = true }: { row: PayrollRow; showCheckbox?: boolean; showDelete?: boolean }) {
    const selected = selectedTableIds.has(row.id);
    return (
      <tr className={`transition-colors ${selected ? 'bg-purple-50 dark:bg-purple-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/20'}`}>
        {showCheckbox && (
          <td className="px-4 py-3">
            <input type="checkbox" checked={selected} onChange={() => toggleRow(row.id)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
          </td>
        )}
        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.employee?.full_name ?? '—'}</td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.working_days}</td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.present_days}</td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.absent_days}</td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.cl_days}</td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.lop_days}</td>
        <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{fmtHrs(row.worked_hours ?? 0)}</td>
        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtHrs(row.expected_hours ?? 0)}</td>
        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">₹{fmt(row.gross_salary)}</td>
        <td className="px-4 py-3 text-red-600 dark:text-red-400 font-medium whitespace-nowrap">−₹{fmt(row.deduction)}</td>
        <td className="px-4 py-3 text-gray-900 dark:text-white font-semibold whitespace-nowrap">₹{fmt(row.net_pay)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-0.5">
            <button onClick={() => generatePayslip(row)} title="Payslip"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
              <i className="ti ti-file-invoice text-base" />
            </button>
            {showDelete && (
              <button
                onClick={() => setDeleteConfirm({ ids: [row.id], label: `${row.employee?.full_name ?? 'this employee'}'s record` })}
                title="Delete"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <i className="ti ti-trash text-base" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // colSpan: with checkbox = 9, without checkbox = 8
  function TableFooter({ rows, colSpan }: { rows: PayrollRow[]; colSpan: number }) {
    return (
      <tfoot>
        <tr className="bg-gray-50 dark:bg-gray-700/40 border-t border-gray-200 dark:border-gray-700 font-semibold text-sm">
          <td colSpan={colSpan} className="px-4 py-3 text-gray-700 dark:text-gray-200">Total</td>
          <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">₹{fmt(rows.reduce((s, r) => s + r.gross_salary, 0))}</td>
          <td className="px-4 py-3 text-red-600 dark:text-red-400 whitespace-nowrap">−₹{fmt(rows.reduce((s, r) => s + r.deduction, 0))}</td>
          <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">₹{fmt(rows.reduce((s, r) => s + r.net_pay, 0))}</td>
          <td />
        </tr>
      </tfoot>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'draft',    label: 'Drafts',           count: draftRows.length },
    { key: 'approved', label: 'Approved Payroll',  count: approvedRows.length },
    { key: 'paid',     label: 'Marked as Paid',    count: paidRows.length },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payroll</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {months[filterMonth - 1]} {filterYear}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterMonth}
            onChange={e => { setFilterMonth(Number(e.target.value)); setActiveTab('draft'); }}
            className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={e => { setFilterYear(Number(e.target.value)); setActiveTab('draft'); }}
            className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
        }`}>
          <i className={`ti ${message.type === 'error' ? 'ti-alert-circle' : 'ti-circle-check'} text-base`} />
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto opacity-60 hover:opacity-100">
            <i className="ti ti-x text-sm" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedTableIds(new Set()); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: DRAFTS ────────────────────────────────────────────────── */}
      {activeTab === 'draft' && (
        <div className="space-y-4">
          {employeesWithoutRecord.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Generate Payroll</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {employeesWithoutRecord.length} employee(s) without payroll for this period · Hourly basis (7.25h/day)
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || selectedEmpIds.size === 0}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {generating ? <Spinner /> : <i className="ti ti-player-play text-sm" />}
                  Generate {selectedEmpIds.size > 0 ? `(${selectedEmpIds.size})` : ''}
                </button>
              </div>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setEmpDropdownOpen(prev => !prev)}
                  className={`flex items-center justify-between w-full h-10 px-3 rounded-lg border text-sm transition-colors ${
                    empDropdownOpen
                      ? 'border-purple-500 ring-2 ring-purple-500/20 bg-white dark:bg-gray-700'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                  } text-gray-700 dark:text-gray-200`}
                >
                  <span className={selectedEmpIds.size === 0 ? 'text-gray-400 dark:text-gray-500' : ''}>
                    {selectedEmpIds.size === 0
                      ? 'Select employees…'
                      : selectedEmpIds.size === employeesWithoutRecord.length
                        ? 'All employees selected'
                        : `${selectedEmpIds.size} of ${employeesWithoutRecord.length} selected`}
                  </span>
                  <i className={`ti ${empDropdownOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400 text-sm`} />
                </button>

                {empDropdownOpen && (
                  <div className="absolute left-0 right-0 top-11 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
                    <div
                      onClick={toggleAllEmps}
                      className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={employeesWithoutRecord.length > 0 && selectedEmpIds.size === employeesWithoutRecord.length}
                        onChange={() => {}}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                      />
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Select All</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {employeesWithoutRecord.map(emp => (
                        <div
                          key={emp.id}
                          onClick={() => toggleEmpSelect(emp.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-gray-50 dark:border-gray-700/40 last:border-0 transition-colors ${
                            selectedEmpIds.has(emp.id)
                              ? 'bg-purple-50 dark:bg-purple-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmpIds.has(emp.id)}
                            onChange={() => {}}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200">{emp.full_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : draftRows.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {draftRows.length} Draft{draftRows.length !== 1 ? 's' : ''}
                </p>
                <ExportButtons rows={draftRows} month={filterMonth} year={filterYear} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <TableHeader rows={draftRows} />
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {draftRows.map(row => <TableRow key={row.id} row={row} />)}
                  </tbody>
                  <TableFooter rows={draftRows} colSpan={9} />
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="ti-file-text" text="No drafts for this period" />
          )}
        </div>
      )}

      {/* ── TAB: APPROVED ──────────────────────────────────────────────── */}
      {activeTab === 'approved' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : approvedRows.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {approvedRows.length} Approved
                </p>
                <ExportButtons rows={approvedRows} month={filterMonth} year={filterYear} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <TableHeader rows={approvedRows} />
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {approvedRows.map(row => <TableRow key={row.id} row={row} />)}
                  </tbody>
                  <TableFooter rows={approvedRows} colSpan={9} />
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="ti-circle-check" text="No approved payroll for this period" />
          )}
        </div>
      )}

      {/* ── TAB: PAID ──────────────────────────────────────────────────── */}
      {activeTab === 'paid' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : paidRows.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {paidRows.length} Paid
                </p>
                <ExportButtons rows={paidRows} month={filterMonth} year={filterYear} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                      {[...COL_HEADERS, 'Payslip'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {paidRows.map(row => (
                      <TableRow key={row.id} row={row} showCheckbox={false} showDelete={false} />
                    ))}
                  </tbody>
                  <TableFooter rows={paidRows} colSpan={8} />
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="ti-currency-rupee" text="No paid payroll for this period" />
          )}
        </div>
      )}

      {/* ── Floating Action Bar ─────────────────────────────────────────── */}
      {currentTabSelectedIds.length > 0 && activeTab !== 'paid' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-gray-950 text-white px-5 py-3 rounded-2xl shadow-2xl border border-gray-700 backdrop-blur-sm">
          <span className="text-sm font-medium text-gray-300">{currentTabSelectedIds.length} selected</span>
          <div className="w-px h-5 bg-gray-600" />

          {activeTab === 'draft' && (
            <button
              onClick={() => handleApprove(currentTabSelectedIds)}
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <i className="ti ti-circle-check text-base" /> Approve
            </button>
          )}

          {activeTab === 'approved' && (
            <button
              onClick={() => handleMarkPaid(currentTabSelectedIds)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <i className="ti ti-currency-rupee text-base" /> Mark Paid
            </button>
          )}

          <div className="w-px h-5 bg-gray-600" />

          <button
            onClick={() => setDeleteConfirm({
              ids:   currentTabSelectedIds,
              label: `${currentTabSelectedIds.length} selected record(s)`,
            })}
            className="flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <i className="ti ti-trash text-base" /> Delete
          </button>

          <div className="w-px h-5 bg-gray-600" />

          <button onClick={() => setSelectedTableIds(new Set())}
            className="text-gray-400 hover:text-white transition-colors">
            <i className="ti ti-x text-sm" />
          </button>
        </div>
      )}

      {/* ── Delete Confirm Dialog ───────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-alert-triangle text-red-600 dark:text-red-400 text-lg" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-base">Confirm Delete</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              Permanently delete <strong className="text-gray-900 dark:text-white">{deleteConfirm.label}</strong>?
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.ids)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {deleting && <Spinner />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}