"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import * as XLSX from "xlsx";

export default function ArchivePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const validate = () => {
    if (!fromDate || !toDate) {
      showToast("Select from and to date.", "error");
      return false;
    }
    if (fromDate > toDate) {
      showToast("From date must be before to date.", "error");
      return false;
    }
    return true;
  };

  const handleDownload = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const [attendanceRes, agentLogsRes, activityFlagsRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("*, profiles(full_name)")
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: true }),
        supabase
          .from("agent_logs")
          .select("*, profiles(full_name)")
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`)
          .order("created_at", { ascending: true }),
        supabase
          .from("activity_flags")
          .select("*, profiles!activity_flags_employee_id_fkey(full_name)")
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`)
          .order("created_at", { ascending: true }),
      ]);

      if (attendanceRes.error) throw attendanceRes.error;
      if (agentLogsRes.error) throw agentLogsRes.error;
      if (activityFlagsRes.error) throw activityFlagsRes.error;

      const attendance = (attendanceRes.data || []).map((r) => ({
        Date: r.date,
        Employee: r.profiles?.full_name ?? r.employee_id,
        Status: r.status,
        "Clock In": r.clock_in ?? "",
        "Clock Out": r.clock_out ?? "",
        "Late Minutes": r.late_minutes ?? 0,
        "Working Hours": r.working_hours ?? "",
      }));

      const agentLogs = (agentLogsRes.data || []).map((r) => ({
        Timestamp: r.created_at,
        Employee: r.profiles?.full_name ?? r.employee_id,
        "Mouse Events": r.mouse_events ?? 0,
        "Keyboard Events": r.keyboard_events ?? 0,
        "Active Minutes": r.active_minutes ?? 0,
        "Inactive Minutes": r.inactive_minutes ?? 0,
      }));

      const activityFlags = (activityFlagsRes.data || []).map((r) => ({
        Timestamp: r.created_at,
        Employee: r.profiles?.full_name ?? r.employee_id,
        Type: r.flag_type ?? "",
        Status: r.status ?? "",
        Notes: r.notes ?? "",
        "Employee Explanation": r.employee_explanation ?? "",
      }));

      const wb = XLSX.utils.book_new();

      const addSheet = (data, name) => {
        if (data.length === 0) {
          const ws = XLSX.utils.aoa_to_sheet([["No data for this range."]]);
          XLSX.utils.book_append_sheet(wb, ws, name);
        } else {
          const ws = XLSX.utils.json_to_sheet(data);
          // Auto column widths
          const cols = Object.keys(data[0]).map((k) => ({
            wch: Math.max(k.length, ...data.map((r) => String(r[k] ?? "").length)) + 2,
          }));
          ws["!cols"] = cols;
          XLSX.utils.book_append_sheet(wb, ws, name);
        }
      };

      addSheet(attendance, "Attendance");
      addSheet(agentLogs, "Agent Logs");
      addSheet(activityFlags, "Activity Flags");

      const fileName = `NarrativeX_Archive_${fromDate}_to_${toDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`Downloaded: ${fileName}`);
    } catch (err) {
      console.error(err);
      showToast("Download failed. Check console.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setShowDeleteConfirm(false);
    try {
      const [a, b, c] = await Promise.all([
        supabase
          .from("attendance")
          .delete()
          .gte("date", fromDate)
          .lte("date", toDate),
        supabase
          .from("agent_logs")
          .delete()
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`),
        supabase
          .from("activity_flags")
          .delete()
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`),
      ]);

      if (a.error) throw a.error;
      if (b.error) throw b.error;
      if (c.error) throw c.error;

      showToast(`Deleted data from ${fromDate} to ${toDate}.`);
    } catch (err) {
      console.error(err);
      showToast("Delete failed. Check console.", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === "error" ? "bg-red-500" : "bg-green-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <i className="ti ti-alert-triangle text-red-600 text-lg" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">Confirm Delete</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              This will permanently delete all records from:
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              {fromDate} → {toDate}
            </p>
            <p className="text-sm text-gray-600 mb-5">
              Tables: Attendance, Agent Logs, Activity Flags. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Archive</h1>
        <p className="text-sm text-gray-500 mt-1">
          Export or delete historical data by date range.
        </p>
      </div>

      {/* Date Range Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <i className="ti ti-calendar-range text-gray-400" />
          Date Range
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-700">
        <div className="flex gap-2">
          <i className="ti ti-info-circle mt-0.5 flex-shrink-0" />
          <div>
            Excel will contain 3 sheets:{" "}
            <span className="font-medium">Attendance</span>,{" "}
            <span className="font-medium">Agent Logs</span>,{" "}
            <span className="font-medium">Activity Flags</span>.
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleDownload}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Exporting…
            </>
          ) : (
            <>
              <i className="ti ti-download" />
              Download Excel
            </>
          )}
        </button>

        <button
          onClick={() => {
            if (!validate()) return;
            setShowDeleteConfirm(true);
          }}
          disabled={deleteLoading}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
        >
          {deleteLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Deleting…
            </>
          ) : (
            <>
              <i className="ti ti-trash" />
              Delete Data
            </>
          )}
        </button>
      </div>
    </div>
  );
}