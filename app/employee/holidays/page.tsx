"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Holiday = {
  id: string;
  date: string;
  name: string;
  type: "public" | "second_saturday";
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getSecondSaturday(year: number, month: number): number {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month, d);
    if (date.getMonth() !== month) break;
    if (date.getDay() === 6) { count++; if (count === 2) return d; }
  }
  return -1;
}

export default function HolidaysPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolidays = async () => {
      setLoading(true);
      const mm = String(month + 1).padStart(2, "0");
      const { data } = await supabase
        .from("holidays")
        .select("*")
        .gte("date", `${year}-${mm}-01`)
        .lte("date", `${year}-${mm}-31`)
        .order("date");
      setHolidays(data ?? []);
      setLoading(false);
    };
    fetchHolidays();
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const secondSat = getSecondSaturday(year, month);

  const holidayMap: Record<number, Holiday> = {};
  holidays.forEach(h => { holidayMap[parseInt(h.date.split("-")[2])] = h; });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold text-white mb-6">Holidays</h1>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors">
          <i className="ti ti-chevron-left" />
        </button>
        <span className="text-sm font-medium text-white">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors">
          <i className="ti ti-chevron-right" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-5 mb-4">
        <span className="flex items-center gap-1.5 text-xs text-white/40">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/70 inline-block" />Public Holiday
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/40">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60 inline-block" />2nd Saturday
        </span>
        <span className="flex items-center gap-1.5 text-xs text-white/40">
          <span className="w-2.5 h-2.5 rounded-sm bg-white/10 inline-block" />Sunday
        </span>
      </div>

      {/* Calendar grid */}
      <div className="bg-[#12122a] rounded-xl border border-white/[0.08] overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-white/[0.08]">
          {DAYS.map(d => (
            <div key={d} className={`text-center py-2.5 text-xs font-medium ${d === "Sun" ? "text-white/25" : "text-white/40"}`}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-white/30 text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="h-16 border-b border-r border-white/[0.05]" />;

              const colIndex = i % 7;
              const isSunday = colIndex === 0;
              const is2ndSat = colIndex === 6 && day === secondSat;
              const holiday = holidayMap[day];
              const isToday = isCurrentMonth && day === now.getDate();

              let bg = "";
              let labelText = "";
              let labelColor = "";

              if (holiday?.type === "public") {
                bg = "bg-purple-500/10";
                labelText = holiday.name;
                labelColor = "text-purple-400";
              } else if (is2ndSat || holiday?.type === "second_saturday") {
                bg = "bg-amber-500/10";
                labelText = holiday?.name ?? "2nd Saturday";
                labelColor = "text-amber-400";
              } else if (isSunday) {
                bg = "bg-white/[0.02]";
              }

              return (
                <div key={i} className={`h-16 border-b border-r border-white/[0.05] p-1.5 flex flex-col ${bg}`}>
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? "bg-purple-600 text-white" : isSunday ? "text-white/25" : "text-white/60"}`}>
                    {day}
                  </span>
                  {labelText && (
                    <span className={`text-[10px] leading-tight mt-0.5 line-clamp-2 ${labelColor}`}>
                      {labelText}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Holiday list */}
      {!loading && holidays.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-xs text-white/40 mb-3">This month</div>
          {holidays.map(h => {
            const dateObj = new Date(h.date + "T00:00:00");
            return (
              <div key={h.id} className="flex items-center gap-3 bg-[#12122a] border border-white/[0.08] rounded-xl px-4 py-3">
                <div className={`w-1 h-8 rounded-full flex-shrink-0 ${h.type === "public" ? "bg-purple-500" : "bg-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{h.name}</div>
                  <div className="text-xs text-white/30">{DAYS[dateObj.getDay()]}, {MONTHS[month]} {dateObj.getDate()}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  h.type === "public" ? "bg-purple-500/20 text-purple-400" : "bg-amber-500/20 text-amber-400"
                }`}>
                  {h.type === "public" ? "Public" : "2nd Sat"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && holidays.length === 0 && (
        <div className="mt-6 text-center text-white/30 text-sm py-10 bg-[#12122a] border border-white/[0.08] rounded-xl">
          No holidays this month
        </div>
      )}
    </div>
  );
}
