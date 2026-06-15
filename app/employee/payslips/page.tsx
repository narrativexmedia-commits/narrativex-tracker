"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Payroll = {
  id: string;
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
  status: "approved" | "paid";
};

function fmtHrs(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function generatePDF(payroll: Payroll, employeeName: string, department: string) {
  const hourlyRate = payroll.expected_hours > 0
    ? (payroll.gross_salary / payroll.expected_hours).toFixed(2)
    : "0.00";
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payslip</title>
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
.section-header td{background:#f8f7ff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#7c3aed;padding:8px 12px;}
.net td{background:#f5f0ff;font-weight:700;font-size:14px;color:#7c3aed;border-bottom:none;}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;}
.footer{margin-top:32px;font-size:11px;color:#aaa;text-align:center;}
</style>
</head>
<body>
<div class="header">
  <div class="company">NarrativeX Media</div>
  <div class="subtitle">Payslip — ${MONTHS[payroll.month - 1]} ${payroll.year}</div>
</div>
<div class="meta">
  <div><div class="meta-label">Employee</div><div class="meta-value">${employeeName}</div></div>
  <div><div class="meta-label">Department</div><div class="meta-value">${department || "—"}</div></div>
  <div><div class="meta-label">Status</div><div class="meta-value">
    <span class="badge" style="background:${payroll.status === "paid" ? "#dcfce7" : "#ede9fe"};color:${payroll.status === "paid" ? "#16a34a" : "#7c3aed"}">
      ${payroll.status === "paid" ? "Paid" : "Approved"}
    </span>
  </div></div>
</div>
<table>
  <tr class="section-header"><td colspan="2">Attendance</td></tr>
  <tr><td>Working Days</td><td>${payroll.working_days}</td></tr>
  <tr><td>Present Days</td><td>${payroll.present_days}</td></tr>
  <tr><td>Absent Days</td><td>${payroll.absent_days}</td></tr>
  <tr><td>CL Days Used</td><td>${payroll.cl_days}</td></tr>
  <tr><td>LOP Days</td><td>${payroll.lop_days}</td></tr>
  <tr class="section-header"><td colspan="2">Hours</td></tr>
  <tr><td>Expected Hours</td><td>${fmtHrs(payroll.expected_hours ?? 0)}</td></tr>
  <tr><td>Worked Hours</td><td>${fmtHrs(payroll.worked_hours ?? 0)}</td></tr>
  <tr class="section-header"><td colspan="2">Earnings</td></tr>
  <tr><td>Gross Salary</td><td>&#8377;${payroll.gross_salary.toLocaleString("en-IN")}</td></tr>
  <tr><td>Hourly Rate</td><td>&#8377;${hourlyRate}/hr</td></tr>
  <tr><td>Deduction (LOP)</td><td>&#8377;${payroll.deduction.toLocaleString("en-IN")}</td></tr>
  <tr class="net"><td>Net Pay</td><td>&#8377;${payroll.net_pay.toLocaleString("en-IN")}</td></tr>
</table>
<div class="footer">Generated on ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} · NarrativeX Media</div>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) win.focus();
}

export default function PayslipsPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("email", user.email)
        .single();
      if (!emp) return;
      setEmployee(emp);
      const { data: pr } = await supabase
        .from("payroll")
        .select("*")
        .eq("employee_id", emp.id)
        .in("status", ["approved", "paid"])
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      setPayrolls(pr ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold text-white mb-6">Payslips</h1>
      {loading ? (
        <div className="text-white/30 text-sm py-10 text-center">Loading...</div>
      ) : payrolls.length === 0 ? (
        <div className="bg-[#12122a] border border-white/[0.08] rounded-xl py-12 text-center text-white/30 text-sm">
          No payslips available yet
        </div>
      ) : (
        <div className="space-y-3">
          {payrolls.map(p => (
            <div key={p.id} className="bg-[#12122a] border border-white/[0.08] rounded-xl px-5 py-4 flex items-center gap-4">
              {/* Month badge */}
              <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-purple-400 font-medium">{MONTHS[p.month - 1].slice(0, 3).toUpperCase()}</span>
                <span className="text-xs text-purple-300 font-bold">{p.year}</span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{MONTHS[p.month - 1]} {p.year}</div>
                <div className="text-xs text-white/40 mt-0.5">
                  {p.present_days}d present · {fmtHrs(p.worked_hours ?? 0)} worked
                  {p.lop_days > 0 && ` · ${p.lop_days}d LOP`}
                </div>
                {/* Hours progress bar */}
                {(p.expected_hours ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.min((p.worked_hours / p.expected_hours) * 100, 100).toFixed(1)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/30 whitespace-nowrap">
                      {((p.worked_hours / p.expected_hours) * 100).toFixed(0)}% of {fmtHrs(p.expected_hours)}
                    </span>
                  </div>
                )}
              </div>

              {/* Net pay + status */}
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-white">&#8377;{p.net_pay.toLocaleString("en-IN")}</div>
                {p.deduction > 0 && (
                  <div className="text-[10px] text-red-400 mt-0.5">−&#8377;{p.deduction.toLocaleString("en-IN")}</div>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                  p.status === "paid" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"
                }`}>
                  {p.status === "paid" ? "Paid" : "Approved"}
                </span>
              </div>

              {/* PDF button */}
              <button
                onClick={() => generatePDF(p, employee?.full_name ?? "", employee?.department ?? "")}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/40 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2 rounded-lg transition-colors"
              >
                <i className="ti ti-download text-sm" />
                PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}