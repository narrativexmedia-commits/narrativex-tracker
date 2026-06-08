"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 20;

export default function EmployeeHistory() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => { loadEmployee(); }, []);
  useEffect(() => { if (employeeId) loadRecords(); }, [employeeId, page]);

  async function loadEmployee() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }
    const { data: emp } = await supabase.from("employees").select("id").eq("email", user.email).single();
    if (!emp) { router.push("/"); return; }
    setEmployeeId(emp.id);
  }

  async function loadRecords() {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from("attendance")
      .select("*", { count: "exact" })
      .eq("employee_id", employeeId)
      .order("date", { ascending: false })
      .range(from, to);

    setRecords(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatTime = (ts: string | null) => ts
    ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    : "—";

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const statusStyle = (status: string) => {
    if (status === "present") return "bg-emerald-500/20 text-emerald-300";
    if (status === "late") return "bg-amber-500/20 text-amber-300";
    if (status === "absent") return "bg-red-500/20 text-red-300";
    return "bg-white/10 text-white/50";
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance History</h1>
        <p className="text-xs text-white/40 mt-1">{total} total records</p>
      </div>

      <div className="bg-[#12122a] rounded-2xl border border-white/[0.08] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-white/[0.08] text-xs font-semibold text-white/40 uppercase tracking-wide">
          <div>Date</div>
          <div>Clock In</div>
          <div>Clock Out</div>
          <div>Status</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-sm text-white/30">No records found</div>
        ) : (
          records.map((r, i) => (
            <div key={r.id}
              className={`grid grid-cols-4 gap-4 px-5 py-3.5 text-sm items-center
                ${i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"}
                border-b border-white/[0.05] last:border-0`}>
              <div className="text-white/80 font-medium">{formatDate(r.date)}</div>
              <div className="text-white/60">{formatTime(r.clock_in)}</div>
              <div className="text-white/60">{formatTime(r.clock_out)}</div>
              <div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyle(r.status)}`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/30 text-xs">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-medium"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-medium"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}