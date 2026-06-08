"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function EmployeeDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("email", user.email)
      .single();

    if (!emp) { router.push("/"); return; }
    setEmployee(emp);

    const today = new Date().toISOString().split("T")[0];
    const { data: att } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", emp.id)
      .eq("date", today)
      .single();

    setAttendance(att || null);
    setLoading(false);
  }

  async function handleClockIn() {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/attendance/clock-in", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Clock in failed", type: "error" });
      } else {
        setMessage({ text: "Clocked in successfully!", type: "success" });
        await loadData();
      }
    } catch {
      setMessage({ text: "Something went wrong", type: "error" });
    }
    setActionLoading(false);
  }

  async function handleClockOut() {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/attendance/clock-out", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Clock out failed", type: "error" });
      } else {
        setMessage({ text: "Clocked out successfully!", type: "success" });
        await loadData();
      }
    } catch {
      setMessage({ text: "Something went wrong", type: "error" });
    }
    setActionLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <div className="spinner-border text-primary" />
    </div>
  );

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const clockedIn = !!attendance?.clock_in;
  const clockedOut = !!attendance?.clock_out;

  return (
    <div className="min-vh-100 bg-body-tertiary">
      {/* Topbar */}
      <nav className="navbar navbar-expand bg-white border-bottom px-4 py-3">
        <span className="navbar-brand fw-bold text-primary">NarrativeX Tracker</span>
        <div className="ms-auto d-flex align-items-center gap-3">
          <span className="text-muted small">{employee?.full_name}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="container py-5" style={{ maxWidth: 600 }}>
        {/* Date */}
        <p className="text-muted mb-1 small">{today}</p>
        <h4 className="fw-bold mb-4">Good day, {employee?.full_name?.split(" ")[0]} 👋</h4>

        {/* Status Card */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-semibold">Today's Attendance</span>
              <span className={`badge ${clockedOut ? "bg-success" : clockedIn ? "bg-warning text-dark" : "bg-secondary"}`}>
                {clockedOut ? "Completed" : clockedIn ? "In Office" : "Not Started"}
              </span>
            </div>

            <div className="row text-center g-3 mb-4">
              <div className="col-6">
                <div className="bg-body-tertiary rounded p-3">
                  <div className="small text-muted mb-1">Clock In</div>
                  <div className="fw-bold fs-5">
                    {attendance?.clock_in
                      ? new Date(attendance.clock_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="bg-body-tertiary rounded p-3">
                  <div className="small text-muted mb-1">Clock Out</div>
                  <div className="fw-bold fs-5">
                    {attendance?.clock_out
                      ? new Date(attendance.clock_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`alert ${message.type === "success" ? "alert-success" : "alert-danger"} py-2 small mb-3`}>
                {message.text}
              </div>
            )}

            {/* Action Button */}
            {!clockedIn && !clockedOut && (
              <button className="btn btn-success w-100 py-2 fw-semibold" onClick={handleClockIn} disabled={actionLoading}>
                {actionLoading ? <span className="spinner-border spinner-border-sm" /> : "🟢 Clock In"}
              </button>
            )}
            {clockedIn && !clockedOut && (
              <button className="btn btn-danger w-100 py-2 fw-semibold" onClick={handleClockOut} disabled={actionLoading}>
                {actionLoading ? <span className="spinner-border spinner-border-sm" /> : "🔴 Clock Out"}
              </button>
            )}
            {clockedOut && (
              <div className="text-center text-muted small">✅ Attendance complete for today</div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="fw-semibold mb-3">My Details</div>
            <div className="row g-2 small">
              <div className="col-6 text-muted">Department</div>
              <div className="col-6">{employee?.department || "—"}</div>
              <div className="col-6 text-muted">Join Date</div>
              <div className="col-6">{employee?.join_date ? new Date(employee.join_date).toLocaleDateString("en-IN") : "—"}</div>
              <div className="col-6 text-muted">Status</div>
              <div className="col-6">{employee?.is_active ? "Active ✅" : "Inactive"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}