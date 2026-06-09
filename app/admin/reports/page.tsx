"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  full_name: string;
  department: string;
  is_active: boolean;
};

type AttendanceRow = {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  ip_address: string | null;
};

type PayrollRow = {
  employee_id: string;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  cl_days: number;
  lop_days: number;
};

type SummaryRow = {
  employee_id: string;
  full_name: string;
  department: string;
  present: number;
  late: number;
  absent: number;
  cl_days: number;
  lop_days: number;
  working_days: number;
  payroll_found: boolean;
};

type DetailRow = {
  date: string;
  employee_id: string;
  full_name: string;
  department: string;
  status: string;
  clock_in: string | null;
  clock_out: string | null;
};

function toIST(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [view, setView] = useState<"summary" | "detailed">("summary");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [empFilter, setEmpFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [detailData, setDetailData] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    supabase
      .from("employees")
      .select("id, full_name, department, is_active")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees(data || []));
  }, []);

  const departments = Array.from(new Set(employees.map((e) => e.department))).filter(Boolean);

  const generateReport = useCallback(async (activeView: "summary" | "detailed") => {
    if (!fromDate || !toDate) return;
    setLoading(true);

    let empQuery = supabase
      .from("attendance")
      .select("id, employee_id, date, clock_in, clock_out, status, ip_address")
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: true });

    if (empFilter !== "all") empQuery = empQuery.eq("employee_id", empFilter);

    const { data: attData } = await empQuery;
    const attendance: AttendanceRow[] = attData || [];

    const empIds = empFilter === "all"
      ? employees.filter((e) => deptFilter === "all" || e.department === deptFilter).map((e) => e.id)
      : [empFilter];

    const filteredAtt = attendance.filter((a) => empIds.includes(a.employee_id));

    const months: { month: number; year: number }[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      months.push({ month: cur.getMonth() + 1, year: cur.getFullYear() });
      cur.setMonth(cur.getMonth() + 1);
    }

    let payrollRows: PayrollRow[] = [];
    for (const { month, year } of months) {
      const { data } = await supabase
        .from("payroll")
        .select("employee_id, month, year, working_days, present_days, absent_days, cl_days, lop_days")
        .eq("month", month)
        .eq("year", year)
        .in("employee_id", empIds);
      if (data) payrollRows = [...payrollRows, ...data];
    }

    if (activeView === "summary") {
      const rows: SummaryRow[] = empIds.map((eid) => {
        const emp = employees.find((e) => e.id === eid);
        const empAtt = filteredAtt.filter((a) => a.employee_id === eid);
        const present = empAtt.filter((a) => a.status === "present").length;
        const late = empAtt.filter((a) => a.status === "late").length;
        const absent = empAtt.filter((a) => a.status === "absent").length;
        const empPayroll = payrollRows.filter((p) => p.employee_id === eid);
        const payroll_found = empPayroll.length > 0;
        const cl_days = empPayroll.reduce((s, p) => s + Number(p.cl_days), 0);
        const lop_days = empPayroll.reduce((s, p) => s + Number(p.lop_days), 0);
        const working_days = empPayroll.reduce((s, p) => s + Number(p.working_days), 0);
        return {
          employee_id: eid,
          full_name: emp?.full_name || "Unknown",
          department: emp?.department || "—",
          present, late, absent, cl_days, lop_days, working_days, payroll_found,
        };
      });
      setSummaryData(rows);
    } else {
      const rows: DetailRow[] = filteredAtt.map((a) => {
        const emp = employees.find((e) => e.id === a.employee_id);
        return {
          date: a.date,
          employee_id: a.employee_id,
          full_name: emp?.full_name || "Unknown",
          department: emp?.department || "—",
          status: a.status,
          clock_in: a.clock_in,
          clock_out: a.clock_out,
        };
      });
      setDetailData(rows);
    }

    setLoading(false);
    setGenerated(true);
  }, [fromDate, toDate, empFilter, deptFilter, employees]);

  // re-run when view toggles (only if already generated)
  useEffect(() => {
    if (generated) generateReport(view);
  }, [view]);

  function handleGenerate() {
    if (!fromDate || !toDate) return alert("Select date range");
    generateReport(view);
  }

  function exportCSV() {
    let csv = "";
    if (view === "summary") {
      csv = "Name,Department,Present,Late,Absent,CL Used,LOP,Working Days\n";
      summaryData.forEach((r) => {
        csv += `"${r.full_name}","${r.department}",${r.present},${r.late},${r.absent},${r.cl_days},${r.lop_days},${r.working_days}\n`;
      });
    } else {
      csv = "Date,Name,Department,Status,Clock In,Clock Out\n";
      detailData.forEach((r) => {
        csv += `"${r.date}","${r.full_name}","${r.department}","${r.status}","${toIST(r.clock_in)}","${toIST(r.clock_out)}"\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${view}_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF(employeeId?: string) {
    const rows = employeeId
      ? (view === "summary" ? summaryData.filter((r) => r.employee_id === employeeId) : detailData.filter((r) => r.employee_id === employeeId))
      : (view === "summary" ? summaryData : detailData);

    const title = employeeId
      ? `Attendance Report — ${(rows[0] as SummaryRow | DetailRow)?.full_name || ""}`
      : "Attendance Report — All Employees";

    let tableHTML = "";
    if (view === "summary") {
      const sRows = rows as SummaryRow[];
      tableHTML = `
        <table>
          <thead><tr><th>Name</th><th>Dept</th><th>Present</th><th>Late</th><th>Absent</th><th>CL</th><th>LOP</th><th>Working Days</th></tr></thead>
          <tbody>${sRows.map((r) => `<tr><td>${r.full_name}</td><td>${r.department}</td><td>${r.present}</td><td>${r.late}</td><td>${r.absent}</td><td>${r.cl_days}</td><td>${r.lop_days}</td><td>${r.working_days}</td></tr>`).join("")}</tbody>
        </table>`;
    } else {
      const dRows = rows as DetailRow[];
      tableHTML = `
        <table>
          <thead><tr><th>Date</th><th>Name</th><th>Dept</th><th>Status</th><th>Clock In</th><th>Clock Out</th></tr></thead>
          <tbody>${dRows.map((r) => `<tr><td>${r.date}</td><td>${r.full_name}</td><td>${r.department}</td><td>${r.status}</td><td>${toIST(r.clock_in)}</td><td>${toIST(r.clock_out)}</td></tr>`).join("")}</tbody>
        </table>`;
    }

    const html = `<!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; }
      h2 { margin-bottom: 4px; }
      p { margin: 0 0 16px; color: #555; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
      th { background: #f3f4f6; font-weight: 600; }
      tr:nth-child(even) { background: #fafafa; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <h2>${title}</h2>
      <p>Period: ${fromDate} → ${toDate}</p>
      ${tableHTML}
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }

  const s = {
    page: { minHeight: "100vh", background: "#1a1a2e", color: "#e2e8f0", padding: "32px" },
    card: { background: "#12122a", borderRadius: "12px", padding: "24px", marginBottom: "24px" },
    label: { fontSize: "12px", color: "#94a3b8", marginBottom: "4px", display: "block" },
    input: { background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: "#e2e8f0", padding: "8px 12px", fontSize: "14px", width: "100%" },
    btn: (color: string) => ({ background: color, color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }),
    badge: (status: string) => {
      const map: Record<string, string> = { present: "#16a34a", late: "#d97706", absent: "#dc2626" };
      return { background: map[status] || "#475569", color: "#fff", borderRadius: "6px", padding: "2px 10px", fontSize: "12px", fontWeight: 600 };
    },
    th: { padding: "10px 14px", textAlign: "left" as const, color: "#94a3b8", fontSize: "12px", fontWeight: 600, borderBottom: "1px solid #2d2d4e" },
    td: { padding: "10px 14px", borderBottom: "1px solid #1e1e3a", fontSize: "14px" },
  };

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "24px" }}>Reports</h1>

      <div style={s.card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: "16px", alignItems: "flex-end" }}>
          <div>
            <span style={s.label}>From</span>
            <input type="date" style={s.input} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <span style={s.label}>To</span>
            <input type="date" style={s.input} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <span style={s.label}>Employee</span>
            <select style={s.input} value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
              <option value="all">All Employees</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div>
            <span style={s.label}>Department</span>
            <select style={s.input} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button style={s.btn("#7c3aed")} onClick={handleGenerate} disabled={loading}>
            {loading ? "Loading..." : "Generate"}
          </button>
        </div>
      </div>

      {generated && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={s.btn(view === "summary" ? "#7c3aed" : "#2d2d4e")} onClick={() => setView("summary")}>Summary</button>
            <button style={s.btn(view === "detailed" ? "#7c3aed" : "#2d2d4e")} onClick={() => setView("detailed")}>Detailed</button>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={s.btn("#0f766e")} onClick={exportCSV}>Export CSV</button>
            <button style={s.btn("#0369a1")} onClick={() => exportPDF()}>Export PDF (All)</button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: "#94a3b8", textAlign: "center", padding: "32px" }}>Loading...</div>}

      {!loading && generated && view === "summary" && (
        <div style={s.card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Department", "Present", "Late", "Absent", "CL Used", "LOP", "Working Days", "PDF"].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryData.map((r) => (
                <tr key={r.employee_id}>
                  <td style={s.td}>{r.full_name}</td>
                  <td style={s.td}>{r.department}</td>
                  <td style={s.td}>{r.present}</td>
                  <td style={s.td}>{r.late}</td>
                  <td style={s.td}>{r.absent}</td>
                  <td style={s.td}>{r.payroll_found ? r.cl_days : <span style={{ color: "#94a3b8", fontSize: "12px" }}>N/A</span>}</td>
                  <td style={s.td}>{r.payroll_found ? r.lop_days : <span style={{ color: "#94a3b8", fontSize: "12px" }}>N/A</span>}</td>
                  <td style={s.td}>{r.payroll_found ? r.working_days : <span style={{ color: "#94a3b8", fontSize: "12px" }}>N/A</span>}</td>
                  <td style={s.td}>
                    <button style={s.btn("#0369a1")} onClick={() => exportPDF(r.employee_id)}>PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && generated && view === "detailed" && (
        <div style={s.card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Date", "Name", "Department", "Status", "Clock In", "Clock Out"].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailData.map((r, i) => (
                <tr key={i}>
                  <td style={s.td}>{r.date}</td>
                  <td style={s.td}>{r.full_name}</td>
                  <td style={s.td}>{r.department}</td>
                  <td style={s.td}><span style={s.badge(r.status)}>{r.status}</span></td>
                  <td style={s.td}>{toIST(r.clock_in)}</td>
                  <td style={s.td}>{toIST(r.clock_out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
