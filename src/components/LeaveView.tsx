import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LeaveRecord, LeaveType, TripRecord } from '../types/fleet';
import {
  isLeaveMatrix,
  LEAVE_TYPE_META,
  LEAVE_TYPES,
  normRo,
  plainRo,
  splitDrivers,
} from '../utils/roDates';
import { SyncedScrollTable } from './SyncedScrollTable';

interface LeaveViewProps {
  leaves: LeaveRecord[];
  rawConcediu: string[][];
  trips: TripRecord[];
  mode: 'demo' | 'live';
  onAddLeave: (driverName?: string, monthIdx?: number) => void;
  onOpenConnection: () => void;
}

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

export function LeaveView({
  leaves,
  rawConcediu,
  trips,
  mode,
  onAddLeave,
  onOpenConnection,
}: LeaveViewProps) {
  const hasMatrix = useMemo(() => isLeaveMatrix(rawConcediu), [rawConcediu]);
  const [viewMode, setViewMode] = useState<'table' | 'timeline' | 'matrix'>(
    'table'
  );
  const [typeFilter, setTypeFilter] = useState<'ALL' | LeaveType>('ALL');
  const [search, setSearch] = useState('');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const activeTripByDriver = useMemo(() => {
    const map = new Map<string, TripRecord>();
    trips.forEach((t) => {
      if (t.isActive && t.sofer) {
        splitDrivers(t.sofer).forEach((drv) => {
          map.set(normRo(drv), t);
        });
      }
    });
    return map;
  }, [trips]);

  const filtered = useMemo(() => {
    const q = plainRo(search);
    return leaves
      .filter(
        (l) =>
          (typeFilter === 'ALL' || l.type === typeFilter) &&
          (!q || plainRo(l.nume).includes(q) || plainRo(l.type).includes(q))
      )
      .sort((a, b) => {
        const rank = (x: LeaveRecord) =>
          x.isActiveToday ? 0 : x.isUpcoming ? 1 : 2;
        const rDiff = rank(a) - rank(b);
        if (rDiff !== 0) return rDiff;
        const tA = a.startDate ? a.startDate.getTime() : 0;
        const tB = b.startDate ? b.startDate.getTime() : 0;
        return tB - tA;
      });
  }, [leaves, search, typeFilter]);

  const driverTotals = useMemo(() => {
    const totals = new Map<
      string,
      {
        nume: string;
        days: number;
        byType: Record<LeaveType, number>;
      }
    >();
    leaves.forEach((l) => {
      const k = normRo(l.nume);
      const existing = totals.get(k);
      if (existing) {
        existing.days += l.daysCount;
        existing.byType[l.type] += l.daysCount;
      } else {
        totals.set(k, {
          nume: l.nume,
          days: l.daysCount,
          byType: {
            CO: l.type === 'CO' ? l.daysCount : 0,
            CM: l.type === 'CM' ? l.daysCount : 0,
            L: l.type === 'L' ? l.daysCount : 0,
            CFP: l.type === 'CFP' ? l.daysCount : 0,
          },
        });
      }
    });
    return totals;
  }, [leaves]);

  const { matrixHeaders, missingTypeCols } = useMemo(() => {
    if (!hasMatrix || rawConcediu.length === 0) {
      return { matrixHeaders: [] as string[], missingTypeCols: [] as LeaveType[] };
    }
    const first = rawConcediu[0] || [];
    const baseHeaders =
      plainRo(first[0]).includes('nume') || plainRo(first[1]).startsWith('ian')
        ? first.map((h) => String(h || '').trim())
        : [
            'NUME ȘOFER',
            ...MONTHS_RO.map((m) => m.toUpperCase()),
            'TOTAL',
          ];

    const missing: LeaveType[] = [];
    for (const t of LEAVE_TYPES) {
      const hasCol = baseHeaders.some((h) => {
        const p = plainRo(h);
        return (
          p === t.toLowerCase() ||
          p === `total ${t.toLowerCase()}` ||
          p.endsWith(` ${t.toLowerCase()}`)
        );
      });
      if (!hasCol) missing.push(t);
    }

    return {
      matrixHeaders: [
        ...baseHeaders,
        ...missing.map((t) => `TOTAL ${t}`),
      ],
      missingTypeCols: missing,
    };
  }, [hasMatrix, rawConcediu]);

  const matrixRows = useMemo(() => {
    if (!hasMatrix) return [];
    const q = plainRo(search);
    const first = rawConcediu[0] || [];
    const startIdx =
      plainRo(first[0]).includes('nume') || plainRo(first[1]).startsWith('ian')
        ? 1
        : 0;
    return rawConcediu
      .slice(startIdx)
      .filter((r) => {
        if (!Array.isArray(r) || !String(r[0] || '').trim()) return false;
        if (!q) return true;
        return r.some((c) => plainRo(c).includes(q));
      });
  }, [hasMatrix, rawConcediu, search]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const uniqueDriversForTimeline = useMemo(() => {
    const map = new Map<string, { nume: string; periods: LeaveRecord[] }>();
    filtered.forEach((l) => {
      const k = normRo(l.nume);
      const entry = map.get(k);
      if (entry) entry.periods.push(l);
      else map.set(k, { nume: l.nume, periods: [l] });
    });
    return Array.from(map.values()).sort((a, b) => a.nume.localeCompare(b.nume));
  }, [filtered]);

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Perioade concediu ({filtered.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === 'timeline'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grafic lunar
              </button>
              {hasMatrix && (
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    viewMode === 'matrix'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tabel anual ({matrixRows.length})
                </button>
              )}
            </div>

            <div className="relative min-w-[200px] sm:w-64">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Caută șofer..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {viewMode === 'timeline' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="p-1.5 border border-slate-200 rounded-md hover:bg-slate-50"
                  aria-label="Luna anterioară"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <span className="font-display text-sm font-medium text-slate-900 min-w-[140px] text-center">
                  {MONTHS_RO[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="p-1.5 border border-slate-200 rounded-md hover:bg-slate-50"
                  aria-label="Luna următoare"
                >
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => onAddLeave()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adaugă concediu</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          {viewMode !== 'matrix' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-md border font-medium transition-colors ${
                  typeFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Toate ({leaves.length})
              </button>
              {LEAVE_TYPES.map((t) => {
                const count = leaves.filter((l) => l.type === t).length;
                const active = typeFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-md border font-medium transition-colors ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : `${LEAVE_TYPE_META[t].badgeClass} hover:opacity-80`
                    }`}
                  >
                    <span className="font-mono font-semibold">{t}</span>{' '}
                    <span className="opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-500">
              Apasă pe orice celulă de lună pentru a edita zilele pe categorii (CO, CM, L, CFP)
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {LEAVE_TYPES.map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <span
                  className={`px-1.5 py-0.5 font-mono font-semibold border rounded ${LEAVE_TYPE_META[t].badgeClass}`}
                >
                  {t}
                </span>
                <span>{LEAVE_TYPE_META[t].label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm text-slate-500">
                Nu există perioade de concediu înregistrate.
              </p>
              {mode === 'live' && rawConcediu.length === 0 && (
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Google Apps Script nu a returnat rânduri pentru foaia{' '}
                  <code className="font-mono">CONCEDIU SOFERI</code>. Actualizează{' '}
                  <button
                    type="button"
                    onClick={onOpenConnection}
                    className="text-blue-700 underline font-medium"
                  >
                    scriptul Code.gs
                  </button>{' '}
                  ca să trimită și să salveze concediile direct din aplicație.
                </p>
              )}
            </div>
          ) : (
            <SyncedScrollTable>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Șofer
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Perioadă & Tip
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 text-right whitespace-nowrap">
                      Durată
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 text-right whitespace-nowrap">
                      Total an șofer
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Status / Suprapuneri
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((l, idx) => {
                    const totInfo = driverTotals.get(normRo(l.nume));
                    const totalAn = totInfo?.days ?? l.daysCount;
                    const breakdown = totInfo
                      ? LEAVE_TYPES.filter((t) => totInfo.byType[t] > 0)
                          .map((t) => `${t} ${totInfo.byType[t]}`)
                          .join(' · ')
                      : '';
                    const activeTrip = activeTripByDriver.get(normRo(l.nume));
                    const conflict =
                      activeTrip &&
                      activeTrip.dataDescDate &&
                      l.startDate &&
                      l.endDate &&
                      activeTrip.dataDescDate >= l.startDate &&
                      activeTrip.dataDescDate <= l.endDate;
                    const meta = LEAVE_TYPE_META[l.type];

                    return (
                      <tr
                        key={`${l.nume}-${l.type}-${l.startStr}-${idx}`}
                        onClick={() =>
                          onAddLeave(
                            l.nume,
                            l.startDate ? l.startDate.getMonth() : undefined
                          )
                        }
                        title="Apasă pentru a modifica luna acestui șofer"
                        className="group hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {l.nume}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <span
                              className={`inline-block px-1.5 py-0.5 font-mono text-[11px] font-semibold border rounded ${meta.badgeClass}`}
                              title={meta.label}
                            >
                              {l.type}
                            </span>
                            <span className="font-mono text-xs text-slate-700 tabular-nums">
                              {l.startStr === l.endStr
                                ? l.startStr
                                : `${l.startStr} – ${l.endStr}`}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                          {l.daysCount} {l.daysCount === 1 ? 'zi' : 'zile'}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="font-mono text-xs text-slate-700 tabular-nums">
                            {totalAn} zile
                          </div>
                          {breakdown && (
                            <div className="font-mono text-[10px] text-slate-400 tabular-nums">
                              {breakdown}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                          {conflict ? (
                            <span className="text-red-600 font-medium">
                              Conflict cursă activă ({activeTrip.dataDesc})
                            </span>
                          ) : l.isActiveToday ? (
                            <span className="text-blue-700 font-medium">
                              Absent azi ({l.type})
                            </span>
                          ) : l.isUpcoming ? (
                            <span className="text-amber-700 font-medium">
                              Programat în 14 zile
                            </span>
                          ) : (
                            <span className="text-slate-500">Planificat / Efectuat</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SyncedScrollTable>
          )}
        </div>
      ) : viewMode === 'matrix' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {matrixRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Niciun șofer găsit în tabelul anual de concedii.
            </div>
          ) : (
            <SyncedScrollTable>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    {matrixHeaders.map((h, i) => (
                      <th
                        key={i}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3 whitespace-nowrap ${
                          i === 0
                            ? 'left-0 z-30 border-r border-slate-200'
                            : 'z-20'
                        }`}
                      >
                        {h || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {matrixRows.map((row, idx) => {
                    const driverName = String(row[0] || '').trim();
                    const baseLen = matrixHeaders.length - missingTypeCols.length;
                    const totInfo = driverTotals.get(normRo(driverName));

                    return (
                      <tr key={idx} className="group hover:bg-slate-50">
                        {matrixHeaders.map((_, colIdx) => {
                          const isExtraTypeCol = colIdx >= baseLen;
                          const extraType = isExtraTypeCol
                            ? missingTypeCols[colIdx - baseLen]
                            : null;
                          const val = extraType
                            ? String(totInfo?.byType[extraType] ?? 0)
                            : String(row[colIdx] || '').trim();
                          const isMonthCol = colIdx >= 1 && colIdx <= 12;

                          return (
                            <td
                              key={colIdx}
                              onClick={() => {
                                if (colIdx === 0) onAddLeave(driverName);
                                else if (isMonthCol)
                                  onAddLeave(driverName, colIdx - 1);
                              }}
                              title={
                                isMonthCol
                                  ? `Editează ${MONTHS_RO[colIdx - 1]} pentru ${driverName}`
                                  : isExtraTypeCol
                                    ? `Total ${extraType} calculat`
                                    : `Adaugă concediu pentru ${driverName}`
                              }
                              className={`py-2 px-3 whitespace-nowrap ${
                                colIdx === 0
                                  ? 'font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 cursor-pointer hover:text-blue-700'
                                  : isMonthCol
                                    ? `font-mono tabular-nums cursor-pointer hover:bg-blue-50 ${val ? 'text-slate-900 font-medium' : 'text-slate-300'}`
                                    : val && val !== '0'
                                      ? 'font-mono text-slate-800 font-medium tabular-nums'
                                      : 'font-mono text-slate-300 tabular-nums'
                              }`}
                            >
                              {val || '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SyncedScrollTable>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {uniqueDriversForTimeline.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Niciun șofer cu concediu de afișat.
            </div>
          ) : (
            <SyncedScrollTable>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 py-2 px-4 min-w-[180px]">
                      Șofer
                    </th>
                    {dayNumbers.map((d) => (
                      <th
                        key={d}
                        className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2 px-1 text-center font-mono text-[11px] min-w-[30px] tabular-nums"
                      >
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {uniqueDriversForTimeline.map((drv) => (
                    <tr key={drv.nume} className="group hover:bg-slate-50">
                      <td
                        onClick={() => onAddLeave(drv.nume, month)}
                        className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 cursor-pointer hover:text-blue-700"
                      >
                        {drv.nume}
                      </td>
                      {dayNumbers.map((d) => {
                        const cellDate = new Date(year, month, d);
                        const match = drv.periods.find(
                          (p) =>
                            p.startDate &&
                            p.endDate &&
                            cellDate >= p.startDate &&
                            cellDate <= p.endDate
                        );
                        const isWeekend =
                          cellDate.getDay() === 0 || cellDate.getDay() === 6;
                        const cellCls = match
                          ? `${LEAVE_TYPE_META[match.type].timelineClass} font-mono text-[10px] font-semibold`
                          : isWeekend
                            ? 'bg-slate-50/80 text-slate-300'
                            : '';
                        return (
                          <td
                            key={d}
                            onClick={() => onAddLeave(drv.nume, month)}
                            className={`p-1 text-center border-l border-slate-100 cursor-pointer ${cellCls}`}
                            title={
                              match
                                ? `${drv.nume} · ${d}.${month + 1}.${year} · ${match.type} (${LEAVE_TYPE_META[match.type].label})`
                                : `${drv.nume} · apasă pentru editare ${MONTHS_RO[month]}`
                            }
                          >
                            {match ? match.type : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncedScrollTable>
          )}
        </div>
      )}
    </div>
  );
}
