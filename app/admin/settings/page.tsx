'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Setting = {
  id: string;
  key: string;
  value: string;
  updated_at: string;
};

export default function SettingsPage() {
  const [allowedIp, setAllowedIp] = useState('');
  const [lateTime, setLateTime] = useState('09:30');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (!error && data) {
        data.forEach((s: Setting) => {
          if (s.key === 'allowed_ip') setAllowedIp(s.value);
          if (s.key === 'late_after') setLateTime(s.value);
        });
      }
      setLoading(false);
    };

    fetchSettings();
  }, []);

  const upsertSetting = async (key: string, value: string) => {
    setSaving(key);
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      showToast(`Failed to save ${key}`, 'error');
    } else {
      showToast('Saved successfully', 'success');
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-400">
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Configure attendance and system preferences
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Attendance Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            Attendance
          </h2>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {/* Allowed IP */}
          <div className="px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-0.5">
                  Allowed IP Address
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Only this IP can clock in/out. Use office WiFi IP.
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={allowedIp}
                  onChange={(e) => setAllowedIp(e.target.value)}
                  placeholder="e.g. 49.37.153.230"
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 font-mono"
                />
                <button
                  onClick={() => upsertSetting('allowed_ip', allowedIp)}
                  disabled={saving === 'allowed_ip'}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {saving === 'allowed_ip' ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          {/* Late After */}
          <div className="px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-0.5">
                  Late After
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Clock-in after this time → marked as Late.
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="time"
                  value={lateTime}
                  onChange={(e) => setLateTime(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
                <button
                  onClick={() => upsertSetting('late_after', lateTime)}
                  disabled={saving === 'late_after'}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {saving === 'late_after' ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-5 py-4">
        <div className="flex gap-3">
          <i className="ti ti-info-circle text-amber-500 text-lg mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <p className="font-semibold">How to find office IP</p>
            <p>Connect to office WiFi → visit <span className="font-mono">whatismyip.com</span> → copy the IP → paste above.</p>
            <p>Update this whenever the office ISP changes the IP.</p>
          </div>
        </div>
      </div>
    </div>
  );
}