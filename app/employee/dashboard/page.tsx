"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EmployeeDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: emp } = await supabase
      .from("employees").select("*").eq("email", user.email).single();
    if (!emp) { router.push("/"); return; }
    setEmployee(emp);

    const today = new Date().toISOString().split("T")[0];
    const { data: att } = await supabase
      .from("attendance").select("*")
      .eq("employee_id", emp.id).eq("date", today).single();

    setAttendance(att || null);
    setLoading(false);
  }

  async function handleClockIn() {
    setActionLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/attendance/clock-in", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setMessage({ text: data.error || "Clock in failed", type: "error" });
      else { setMessage({ text: "Clocked in successfully!", type: "success" }); await loadData(); }
    } catch { setMessage({ text: "Something went wrong", type: "error" }); }
    setActionLoading(false);
  }

  async function handleClockOut() {
    setActionLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/attendance/clock-out", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setMessage({ text: data.error || "Clock out failed", type: "error" });
      else { setMessage({ text: "Clocked out successfully!", type: "success" }); await loadData(); }
    } catch { setMessage({ text: "Something went wrong", type: "error" }); }
    setActionLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
      <svg className="animate-spin h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const clockedIn = !!attendance?.clock_in;
  const clockedOut = !!attendance?.clock_out;

  const formatTime = (ts: string | null) => ts
    ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      {/* Topbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#12122a] border-b border-white/[0.08]">
        <div>
          <div className="text-sm font-medium text-purple-300">NarrativeX</div>
          <div className="text-xs text-purple-300/50">Tracker</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/50">{employee?.full_name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <i className="ti ti-logout text-sm" />
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        {/* Greeting */}
        <div>
          <p className="text-xs text-white/40 mb-1">{today}</p>
          <h1 className="text-2xl font-bold text-white">
            Good day, {employee?.full_name?.split(" ")[0]} 👋
          </h1>
        </div>

        {/* Attendance Card */}
        <div className="bg-[#12122a] rounded-2xl border border-white/[0.08] overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
            <span className="text-sm font-semibold text-white">Today's Attendance</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              clockedOut
                ? "bg-emerald-500/20 text-emerald-300"
                : clockedIn
                ? "bg-amber-500/20 text-amber-300"
                : "bg-white/10 text-white/50"
            }`}>
              {clockedOut ? "Completed" : clockedIn ? "In Office" : "Not Started"}
            </span>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-px bg-white/[0.08]">
            <div className="bg-[#12122a] px-5 py-4 text-center">
              <div className="text-xs text-white/40 mb-1.5">Clock In</div>
              <div className="text-2xl font-bold text-white">{formatTime(attendance?.clock_in)}</div>
            </div>
            <div className="bg-[#12122a] px-5 py-4 text-center">
              <div className="text-xs text-white/40 mb-1.5">Clock Out</div>
              <div className="text-2xl font-bold text-white">{formatTime(attendance?.clock_out)}</div>
            </div>
          </div>

          {/* Action */}
          <div className="px-5 py-4">
            {message && (
              <div className={`mb-3 px-4 py-2.5 rounded-lg text-sm font-medium ${
                message.type === "success"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300"
              }`}>
                {message.text}
              </div>
            )}

            {!clockedIn && !clockedOut && (
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {actionLoading
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  : <><span className="text-base">🟢</span> Clock In</>
                }
              </button>
            )}

            {clockedIn && !clockedOut && (
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {actionLoading
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  : <><span className="text-base">🔴</span> Clock Out</>
                }
              </button>
            )}

            {clockedOut && (
              <div className="text-center text-sm text-emerald-400 font-medium py-1">
                ✅ Attendance complete for today
              </div>
            )}
          </div>
        </div>

        {/* My Details */}
        <div className="bg-[#12122a] rounded-2xl border border-white/[0.08]">
          <div className="px-5 py-4 border-b border-white/[0.08]">
            <span className="text-sm font-semibold text-white">My Details</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {[
              { label: "Department", value: employee?.department || "—" },
              { label: "Join Date", value: employee?.join_date ? new Date(employee.join_date).toLocaleDateString("en-IN") : "—" },
              { label: "Status", value: employee?.is_active ? "Active ✅" : "Inactive" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-white/40">{label}</span>
                <span className="text-sm text-white/80">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}