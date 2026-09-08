import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';

export interface CalendarPickerProps {
  selectedDate?: string; // YYYY-MM-DD format
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  selectedDate,
  onSelectDate,
  onClose,
}) => {
  // Parsing initial viewing year and month from selectedDate or today
  const initialDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState<number>(
    isNaN(initialDate.getTime()) ? new Date().getFullYear() : initialDate.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    isNaN(initialDate.getTime()) ? new Date().getMonth() : initialDate.getMonth()
  );

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewYear(Number(e.target.value));
  };

  // Generate Calendar Days Grid for viewYear & viewMonth
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 6 = Sat
  const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const days: { dayNumber: number; monthOffset: number; fullDateStr: string }[] = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYearVal = viewMonth === 0 ? viewYear - 1 : viewYear;
    const fullDateStr = `${prevYearVal}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(
      d
    ).padStart(2, '0')}`;
    days.push({ dayNumber: d, monthOffset: -1, fullDateStr });
  }

  // Current month days
  for (let d = 1; d <= daysInViewMonth; d++) {
    const fullDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(
      2,
      '0'
    )}`;
    days.push({ dayNumber: d, monthOffset: 0, fullDateStr });
  }

  // Next month leading days to complete week rows (up to 35 or 42 cells)
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYearVal = viewMonth === 11 ? viewYear + 1 : viewYear;
    const fullDateStr = `${nextYearVal}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(
      d
    ).padStart(2, '0')}`;
    days.push({ dayNumber: d, monthOffset: 1, fullDateStr });
  }

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long' });

  // Generate Year options (current year +- 5 years)
  const currentYearNum = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYearNum - 5 + i);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-black text-slate-900">Select Order Date</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Month & Year Controls */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-2 rounded-2xl">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:shadow-2xs transition-all"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900">{monthName}</span>
            <select
              value={viewYear}
              onChange={handleYearChange}
              className="text-xs font-extrabold bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-slate-800 focus:outline-none focus:border-slate-800 cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl text-slate-600 hover:bg-white hover:shadow-2xs transition-all"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday Labels Header */}
        <div className="grid grid-cols-7 text-center text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((item, idx) => {
            const isSelected = item.fullDateStr === selectedDate;
            const isToday = item.fullDateStr === todayStr;
            const isCurrentMonth = item.monthOffset === 0;

            return (
              <button
                key={`${item.fullDateStr}-${idx}`}
                disabled={!isCurrentMonth}
                onClick={() => {
                  if (isCurrentMonth) {
                    onSelectDate(item.fullDateStr);
                    onClose();
                  }
                }}
                className={`h-9 w-full rounded-xl text-xs font-extrabold flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md scale-105'
                    : isToday && isCurrentMonth
                    ? 'bg-amber-100 text-amber-900 border border-amber-400 font-black'
                    : isCurrentMonth
                    ? 'text-slate-800 hover:bg-slate-100 hover:text-slate-950'
                    : 'text-slate-300 opacity-40 cursor-not-allowed'
                }`}
              >
                {item.dayNumber}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              onSelectDate(todayStr);
              onClose();
            }}
            className="text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
          >
            Select Today ({todayStr})
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
