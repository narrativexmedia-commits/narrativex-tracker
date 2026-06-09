'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Holiday = {
  id: string;
  date: string;
  name: string;
  type: 'public' | 'optional' | 'second_saturday';
};

type HolidayForm = {
  date: string;
  name: string;
  type: 'public' | 'second_saturday';
};

const typeLabels: Record<string, string> = {
  public: 'Public Holiday',
  second_saturday: '2nd Saturday',
  optional: 'Optional Holiday',
};

const typeBadgeStyles: Record<string, string> = {
  public: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  second_saturday: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  optional: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

function getSecondSaturday(year: number, month: number): string {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getMonth() !== month - 1) break;
    if (date.getDay() === 6) {
      count++;
      if (count === 2) {
        return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  return '';
}

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<HolidayForm>({
    date: '',
    name: '',
    type: 'public',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    const monthStr = String(filterMonth).padStart(2, '0');
    const from = `${filterYear}-${monthStr}-01`;
    const to = `${filterYear}-${monthStr}-31`;

    const { data, error } = await supabase
      .from('holidays')
      .select('id, date, name, type')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    if (!error && data) setHolidays(data as Holiday[]);
    setLoading(false);
  }, [filterMonth, filterYear]);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  function openModal() {
    setForm({ date: '', name: '', type: 'public' });
    setModalError('');
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setModalError(''); }

  function handleTypeChange(type: HolidayForm['type']) {
    if (type === 'second_saturday') {
      const date = getSecondSaturday(filterYear, filterMonth);
      setForm({ date, name: '2nd Saturday', type });
    } else {
      setForm(f => ({ ...f, type, name: f.type === 'second_saturday' ? '' : f.name }));
    }
  }

  async function handleSubmit() {
    setModalError('');
    if (!form.date) { setModalError('Select a date.'); return; }
    if (!form.name.trim()) { setModalError('Enter holiday name.'); return; }

    setSubmitting(true);

    const { data: existing } = await supabase
      .from('holidays').select('id').eq('date', form.date).single();

    if (existing) { setModalError('A holiday already exists on this date.'); setSubmitting(false); return; }

    const { error } = await supabase.from('holidays').insert({
      date: form.date,
      name: form.name.trim(),
      type: form.type,
    });

    setSubmitting(false);
    if (error) { setModalError(error.message); return; }
    closeModal();
    fetchHolidays();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await supabase.from('holidays').delete().eq('id', id);
    setDeletingId(null);
    fetchHolidays();
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Holidays</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{holidays.length} holiday{holidays.length !== 1 ? 's' : ''} this month</p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Holiday
        </button>
      </div>

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
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                {['Date', 'Name', 'Type', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Loading...
                  </div>
                </td></tr>
              ) : holidays.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400 dark:text-gray-500">No holidays this month</td></tr>
              ) : (
                holidays.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{h.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeBadgeStyles[h.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {typeLabels[h.type] ?? h.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(h.id)}
                        disabled={deletingId === h.id}
                        title="Delete"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Holiday Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add Holiday</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {modalError && (
                <div className="px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{modalError}</div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</label>
                <select value={form.type} onChange={e => handleTypeChange(e.target.value as HolidayForm['type'])}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="public">Public Holiday</option>
                  <option value="second_saturday">2nd Saturday</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Diwali, Christmas..."
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={closeModal}
                className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {submitting
                  ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : 'Save Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
