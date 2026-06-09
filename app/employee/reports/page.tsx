"use client";
import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  month: number;
  year: number;
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function EmployeeReportsPage() {
  const [empId, setEmpId] = useState<string | null>(null);
  const [view, setView] = useState<"summary" | "detailed">("summary");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [detailData, setDetailData] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("employees").select("id").eq("email", user.email).single()
        .then(({ data }) => { if (data) setEmpId(data.id); });
    });
  }, []);

  const generateReport = useCallback(async (activeView: "summary" | "detailed") => {
    if (!fromDate || !toDate || !empId) return;
    setLoading(true);

    const { data: attData } = await supabase
      .from("attendance")
      .select("id, employee_id, date, clock_in, clock_out, status, ip_address")
      .eq("employee_id", empId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: true });

    const attendance: AttendanceRow[] = attData || [];

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
        .eq("employee_id", empId)
        .eq("month", month)
        .eq("year", year);
      if (data) payrollRows = [...payrollRows, ...data];
    }

    if (activeView === "summary") {
      const rows: SummaryRow[] = months.map(({ month, year }) => {
        const monthAtt = attendance.filter((a) => {
          const d = new Date(a.date);
          return d.getMonth() + 1 === month && d.getFullYear() === year;
        });
        const present = monthAtt.filter((a) => a.status === "present").length;
        const late = monthAtt.filter((a) => a.status === "late").length;
        const absent = monthAtt.filter((a) => a.status === "absent").length;
        const p = payrollRows.find((p) => p.month === month && p.year === year);
        return {
          month, year, present, late, absent,
          cl_days: p ? Number(p.cl_days) : 0,
          lop_days: p ? Number(p.lop_days) : 0,
          working_days: p ? Number(p.working_days) : 0,
          payroll_found: !!p,
        };
      });
      setSummaryData(rows);
    } else {
      const rows: DetailRow[] = attendance.map((a) => ({
        date: a.date,
        status: a.status,
        clock_in: a.clock_in,
        clock_out: a.clock_out,
      }));
      setDetailData(rows);
    }

    setLoading(false);
    setGenerated(true);
  }, [fromDate, toDate, empId]);

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
      csv = "Month,Year,Present,Late,Absent,CL Used,LOP,Working Days\n";
      summaryData.forEach((r) => {
        csv += `"${MONTHS[r.month - 1]}",${r.year},${r.present},${r.late},${r.absent},${r.cl_days},${r.lop_days},${r.working_days}\n`;
      });
    } else {
      csv = "Date,Status,Clock In,Clock Out\n";
      detailData.forEach((r) => {
        csv += `"${r.date}","${r.status}","${toIST(r.clock_in)}","${toIST(r.clock_out)}"\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my_report_${view}_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    let tableHTML = "";
    if (view === "summary") {
      tableHTML = `
        <table>
          <thead><tr><th>Month</th><th>Year</th><th>Present</th><th>Late</th><th>Absent</th><th>CL</th><th>LOP</th><th>Working Days</th></tr></thead>
          <tbody>${summaryData.map((r) => `<tr><td>${MONTHS[r.month - 1]}</td><td>${r.year}</td><td>${r.present}</td><td>${r.late}</td><td>${r.absent}</td><td>${r.payroll_found ? r.cl_days : "N/A"}</td><td>${r.payroll_found ? r.lop_days : "N/A"}</td><td>${r.payroll_found ? r.working_days : "N/A"}</td></tr>`).join("")}</tbody>
        </table>`;
    } else {
      tableHTML = `
        <table>
          <thead><tr><th>Date</th><th>Status</th><th>Clock In</th><th>Clock Out</th></tr></thead>
          <tbody>${detailData.map((r) => `<tr><td>${r.date}</td><td>${r.status}</td><td>${toIST(r.clock_in)}</td><td>${toIST(r.clock_out)}</td></tr>`).join("")}</tbody>
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
      <h2>My Attendance Report</h2>
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

  const badge = (status: string) => {
    const map: Record<string, string> = { present: "bg-green-600", late: "bg-yellow-600", absent: "bg-red-600" };
    return `inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${map[status] || "bg-slate-500"}`;
  };

  return (
    <div className="p-6 min-h-screen bg-[#1a1a2e] text-white">
      <h1 className="text-xl font-bold mb-6">My Reports</h1>

      <div className="bg-[#12122a] rounded-xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">From</label>
            <input type="date" className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-lg text-white px-3 py-2 text-sm"
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To</label>
            <input type="date" className="bg-[#1a1a2e] border border-[#2d2d4e] rounded-lg text-white px-3 py-2 text-sm"
              value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
            {loading ? "Loading..." : "Generate"}
          </button>
        </div>
      </div>

      {generated && (
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setView("summary")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === "summary" ? "bg-purple-600 text-white" : "bg-[#2d2d4e] text-white/60"}`}>
              Summary
            </button>
            <button
              onClick={() => setView("detailed")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === "detailed" ? "bg-purple-600 text-white" : "bg-[#2d2d4e] text-white/60"}`}>
              Detailed
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Export CSV</button>
            <button onClick={exportPDF} className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">Export PDF</button>
          </div>
        </div>
      )}

      {loading && <div className="text-slate-400 text-center py-8">Loading...</div>}

      {!loading && generated && view === "summary" && (
        <div className="bg-[#12122a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                {["Month", "Year", "Present", "Late", "Absent", "CL Used", "LOP", "Working Days"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 font-semibold border-b border-[#2d2d4e]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryData.map((r, i) => (
                <tr key={i} className="border-b border-[#1e1e3a]">
                  <td className="px-4 py-3 text-sm">{MONTHS[r.month - 1]}</td>
                  <td className="px-4 py-3 text-sm">{r.year}</td>
                  <td className="px-4 py-3 text-sm">{r.present}</td>
                  <td className="px-4 py-3 text-sm">{r.late}</td>
                  <td className="px-4 py-3 text-sm">{r.absent}</td>
                  <td className="px-4 py-3 text-sm">{r.payroll_found ? r.cl_days : <span className="text-slate-500 text-xs">N/A</span>}</td>
                  <td className="px-4 py-3 text-sm">{r.payroll_found ? r.lop_days : <span className="text-slate-500 text-xs">N/A</span>}</td>
                  <td className="px-4 py-3 text-sm">{r.payroll_found ? r.working_days : <span className="text-slate-500 text-xs">N/A</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && generated && view === "detailed" && (
        <div className="bg-[#12122a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                {["Date", "Status", "Clock In", "Clock Out"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 font-semibold border-b border-[#2d2d4e]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailData.map((r, i) => (
                <tr key={i} className="border-b border-[#1e1e3a]">
                  <td className="px-4 py-3 text-sm">{r.date}</td>
                  <td className="px-4 py-3"><span className={badge(r.status)}>{r.status}</span></td>
                  <td className="px-4 py-3 text-sm">{toIST(r.clock_in)}</td>
                  <td className="px-4 py-3 text-sm">{toIST(r.clock_out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
