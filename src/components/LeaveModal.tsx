import { AlertCircle, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LeaveType, TripRecord } from '../types/fleet';
import {
  buildMonthCellText,
  countUniqueLeaveDays,
  extractMonthTypeInputs,
  fmtRoDate,
  isLeaveMatrix,
  LEAVE_TYPE_META,
  LEAVE_TYPES,
  normRo,
  parseMonthLeaveCell,
  plainRo,
  splitDrivers,
  todayRo,
} from '../utils/roDates';

const MONTHS_RO = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

const MONTH_PREFIXES = [
  'ian',
  'feb',
  'mar',
  'apr',
  'mai',
  'iun',
  'iul',
  'aug',
  'sep',
  'oct',
  'noi',
  'dec',
];

interface LeaveModalProps {
  open: boolean;
  initialDriver?: string;
  initialMonth?: number;
  flota: string[][];
  rawConcediu: string[][];
  trips: TripRecord[];
  onClose: () => void;
  onSave: (payload: {
    nume: string;
    monthIdx: number;
    cellText: string;
  }) => Promise<void>;
}

const EMPTY_BY_TYPE: Record<LeaveType, string> = {
  CO: '',
  CM: '',
  L: '',
  CFP: '',
};

export function LeaveModal({
  open,
  initialDriver,
  initialMonth,
  flota,
  rawConcediu,
  trips,
  onClose,
  onSave,
}: LeaveModalProps) {
  const today = todayRo();
  const currentYear = today.getFullYear();

  const [nume, setNume] = useState('');
  const [monthIdx, setMonthIdx] = useState<number>(today.getMonth());
  const [byType, setByType] = useState<Record<LeaveType, string>>(EMPTY_BY_TYPE);
  const [localError, setLocalError] = useState<string | null>(null);

  const lookupExistingByType = useCallback(
    (driverName: string, mIdx: number): Record<LeaveType, string> => {
      if (!driverName.trim() || !isLeaveMatrix(rawConcediu)) {
        return { ...EMPTY_BY_TYPE };
      }
      const header = rawConcediu[0] || [];
      let colIdx = mIdx + 1;
      header.forEach((h, idx) => {
        const p = plainRo(h);
        if (
          p.startsWith(MONTH_PREFIXES[mIdx]) ||
          (mIdx === 10 && p.startsWith('nov'))
        ) {
          colIdx = idx;
        }
      });
      const targetKey = normRo(driverName);
      const row = rawConcediu.find(
        (r, idx) => idx > 0 && normRo(r[0]) === targetKey
      );
      const rawCell = row ? String(row[colIdx] || '').trim() : '';
      return rawCell ? extractMonthTypeInputs(rawCell) : { ...EMPTY_BY_TYPE };
    },
    [rawConcediu]
  );

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    const drv = initialDriver || '';
    const m =
      typeof initialMonth === 'number' && initialMonth >= 0 && initialMonth <= 11
        ? initialMonth
        : today.getMonth();
    setNume(drv);
    setMonthIdx(m);
    setByType(lookupExistingByType(drv, m));
  }, [open, initialDriver, initialMonth, lookupExistingByType]);

  const driversList = useMemo(() => {
    const set = new Set<string>();
    for (let i = 1; i < flota.length; i++) {
      const d = String(flota[i]?.[2] || '').trim();
      if (d) set.add(d);
    }
    for (let i = 0; i < rawConcediu.length; i++) {
      const d = String(rawConcediu[i]?.[0] || '').trim();
      if (d && plainRo(d) !== 'nume sofer' && plainRo(d) !== 'nume') {
        set.add(d);
      }
    }
    trips.forEach((t) => {
      splitDrivers(t.sofer).forEach((d) => set.add(d));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flota, rawConcediu, trips]);

  if (!open) return null;

  const combinedCellText = buildMonthCellText(byType);
  const parsedByType: Record<
    LeaveType,
    { periods: { start: Date; end: Date; type: LeaveType }[]; days: number }
  > = {
    CO: { periods: [], days: 0 },
    CM: { periods: [], days: 0 },
    L: { periods: [], days: 0 },
    CFP: { periods: [], days: 0 },
  };

  for (const t of LEAVE_TYPES) {
    const raw = byType[t].trim();
    if (raw) {
      const periods = parseMonthLeaveCell(`${t} ${raw}`, monthIdx, currentYear);
      parsedByType[t] = {
        periods,
        days: countUniqueLeaveDays(periods),
      };
    }
  }

  const allParsedPeriods = LEAVE_TYPES.flatMap((t) => parsedByType[t].periods);
  const totalDays = countUniqueLeaveDays(allParsedPeriods);

  const conflictingTrip =
    nume.trim() && allParsedPeriods.length > 0
      ? trips.find((t) => {
          if (!t.isActive || !t.dataDescDate) return false;
          const matchesDriver = splitDrivers(t.sofer).some(
            (d) => normRo(d) === normRo(nume)
          );
          if (!matchesDriver) return false;
          return allParsedPeriods.some(
            (p) => t.dataDescDate! >= p.start && t.dataDescDate! <= p.end
          );
        })
      : undefined;

  const handleDriverChange = (nextName: string) => {
    setNume(nextName);
    const hasAnyInput = LEAVE_TYPES.some((t) => byType[t].trim() !== '');
    if (!hasAnyInput) {
      setByType(lookupExistingByType(nextName, monthIdx));
    }
  };

  const handleMonthChange = (nextMonth: number) => {
    setMonthIdx(nextMonth);
    setByType(lookupExistingByType(nume, nextMonth));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!nume.trim()) {
      setLocalError('Introdu sau selectează numele șoferului.');
      return;
    }

    for (const t of LEAVE_TYPES) {
      if (byType[t].trim() && parsedByType[t].periods.length === 0) {
        setLocalError(
          `Format nerecunoscut la ${LEAVE_TYPE_META[t].label} (${t}). Folosește ex: 23-25 sau 12,16,26.`
        );
        return;
      }
    }

    await onSave({
      nume: nume.trim(),
      monthIdx,
      cellText: combinedCellText,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl pb-[env(safe-area-inset-bottom)]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Concedii & libere ({MONTHS_RO[monthIdx]})
            </h2>
            <p className="text-xs text-slate-500">
              Se salvează în celula lunii și actualizează coloanele CO, CM, L, CFP
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {localError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nume șofer
              </label>
              <input
                type="text"
                required
                list="leave-drivers-list"
                value={nume}
                onChange={(e) => handleDriverChange(e.target.value)}
                placeholder="ex. POPESCU ION"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <datalist id="leave-drivers-list">
                {driversList.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Luna
              </label>
              <select
                value={monthIdx}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              >
                {MONTHS_RO.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Introdu zilele pe fiecare categorie (ex. 23-25 sau 12,16,26)</span>
              <span className="font-mono font-medium text-slate-700 tabular-nums">
                Total lună: {totalDays} {totalDays === 1 ? 'zi' : 'zile'}
              </span>
            </div>

            {LEAVE_TYPES.map((t) => {
              const meta = LEAVE_TYPE_META[t];
              const rawVal = byType[t];
              const info = parsedByType[t];
              return (
                <div
                  key={t}
                  className={`p-3 rounded-lg border ${meta.borderClass} space-y-1.5`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                      <span
                        className={`inline-block px-1.5 py-0.5 font-mono text-[11px] font-semibold border rounded ${meta.badgeClass}`}
                      >
                        {t}
                      </span>
                      <span>{meta.label}</span>
                    </label>
                    {rawVal.trim() && (
                      <span className="font-mono text-[11px] font-medium text-slate-700 tabular-nums">
                        {info.periods.length > 0
                          ? `${info.days} ${info.days === 1 ? 'zi' : 'zile'}`
                          : 'Format invalid'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={rawVal}
                    onChange={(e) =>
                      setByType((prev) => ({ ...prev, [t]: e.target.value }))
                    }
                    placeholder={
                      t === 'CO'
                        ? 'ex. 23-25 sau 12,16,26'
                        : t === 'CM'
                          ? 'ex. 10-12'
                          : t === 'L'
                            ? 'ex. 29'
                            : 'ex. 01-03'
                    }
                    className="w-full px-3 py-2 font-mono text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                  />
                  {info.periods.length > 0 && (
                    <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                      {info.periods
                        .map((p) =>
                          p.start.getTime() === p.end.getTime()
                            ? fmtRoDate(p.start)
                            : `${fmtRoDate(p.start)}–${fmtRoDate(p.end)}`
                        )
                        .join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <div>
              În foaia Google Sheet ({MONTHS_RO[monthIdx]}) se va salva:{' '}
              <code className="font-mono text-slate-900 font-medium">
                {combinedCellText || '(celulă goală — șters)'}
              </code>
            </div>
          </div>

          {conflictingTrip && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              Atenție: șoferul are cursă activă ({conflictingTrip.cells[1]}) cu
              descărcare la <strong>{conflictingTrip.dataDesc}</strong>.
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              Salvează în {MONTHS_RO[monthIdx]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
