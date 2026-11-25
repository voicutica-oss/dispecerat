import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FreeTrailer, LeaveRecord, TripRecord } from '../types/fleet';
import {
  FLOTA_DEFAULT_HEADERS,
  normRemKey,
  normRo,
  plainRo,
} from '../utils/roDates';
import { SyncedScrollTable } from './SyncedScrollTable';

interface FleetViewProps {
  flota: string[][];
  freeTrailers: FreeTrailer[];
  trips: TripRecord[];
  leaves: LeaveRecord[];
}

export function FleetView({
  flota,
  freeTrailers,
  trips,
  leaves,
}: FleetViewProps) {
  const [subTab, setSubTab] = useState<'flota' | 'libere'>('flota');
  const [search, setSearch] = useState('');

  const headers = useMemo(() => {
    const h = flota[0] || [];
    return FLOTA_DEFAULT_HEADERS.map((def, idx) =>
      h[idx] && String(h[idx]).trim() ? String(h[idx]).trim() : def
    );
  }, [flota]);

  const activeTrailerSet = useMemo(() => {
    const map = new Map<string, TripRecord>();
    trips.forEach((t) => {
      if (t.isActive && t.remorca && t.tara.trim() && t.localitate.trim()) {
        map.set(normRemKey(t.remorca), t);
      }
    });
    return map;
  }, [trips]);

  const activeLeaveDrivers = useMemo(() => {
    const set = new Set<string>();
    leaves.forEach((l) => {
      if (l.isActiveToday) set.add(normRo(l.nume));
    });
    return set;
  }, [leaves]);

  const fleetRows = useMemo(() => {
    const q = plainRo(search);
    const out: { rowIdx: number; cells: string[] }[] = [];
    for (let i = 1; i < flota.length; i++) {
      const cells = Array.from({ length: 8 }, (_, idx) =>
        String(flota[i]?.[idx] || '').trim()
      );
      if (cells.every((c) => !c)) continue;
      if (q && !cells.some((c) => plainRo(c).includes(q))) continue;
      out.push({ rowIdx: i + 1, cells });
    }
    return out;
  }, [flota, search]);

  const filteredFree = useMemo(() => {
    const q = plainRo(search);
    if (!q) return freeTrailers;
    return freeTrailers.filter(
      (f) =>
        plainRo(f.remorca).includes(q) ||
        plainRo(f.ultimulSofer).includes(q) ||
        plainRo(f.nefolositaDin).includes(q) ||
        plainRo(f.flotaNote).includes(q)
    );
  }, [freeTrailers, search]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('flota')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'flota'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flotă ({Math.max(flota.length - 1, 0)})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('libere')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'libere'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Remorci libere ({freeTrailers.length})
            </button>
          </div>

          <div className="relative min-w-[220px] sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută camion, remorcă, șofer, telefon..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Calculat live din flotă, curse și istoric remorci
        </div>
      </div>

      {subTab === 'flota' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {fleetRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nicio înregistrare găsită în foaia „flota”.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-200">
                {fleetRows.map((row) => {
                  const remKey = normRemKey(row.cells[1]);
                  const activeTrip = remKey
                    ? activeTrailerSet.get(remKey)
                    : undefined;
                  const driverOnLeave =
                    row.cells[2] && activeLeaveDrivers.has(normRo(row.cells[2]));

                  return (
                    <div key={row.rowIdx} className="p-4 space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-mono text-sm font-semibold text-slate-900">
                          {[row.cells[0], row.cells[1]].filter(Boolean).join('/') || '—'}
                        </div>
                        {row.cells[3] && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold uppercase text-slate-700">
                            {row.cells[3]}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-800 font-medium">
                        {row.cells[2] || 'Fără șofer'}
                        {driverOnLeave && (
                          <span className="ml-2 text-amber-700">· În concediu azi</span>
                        )}
                      </div>
                      {(row.cells[4] || row.cells[5]) && (
                        <div className="font-mono text-slate-600">
                          Tel: {row.cells[4] || '—'}
                          {row.cells[5] ? ` · Rezervă: ${row.cells[5]}` : ''}
                        </div>
                      )}
                      {(row.cells[6] || row.cells[7]) && (
                        <div className="font-mono text-slate-500">
                          {row.cells[6] ? `An: ${row.cells[6]}` : ''}
                          {row.cells[6] && row.cells[7] ? ' · ' : ''}
                          {row.cells[7] ? row.cells[7] : ''}
                        </div>
                      )}
                      <div>
                        {activeTrip ? (
                          <span className="text-emerald-700 font-medium">
                            În cursă · {activeTrip.tara} {activeTrip.localitate} ({activeTrip.dataDesc})
                          </span>
                        ) : remKey ? (
                          <span className="text-slate-500">Remorcă liberă</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <SyncedScrollTable className="hidden md:block">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3.5 whitespace-nowrap ${
                            i === 0
                              ? 'left-0 z-30 border-r border-slate-200'
                              : 'z-20'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                      <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-3.5 whitespace-nowrap">
                        Situație cursă
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {fleetRows.map((row) => {
                      const remKey = normRemKey(row.cells[1]);
                      const activeTrip = remKey
                        ? activeTrailerSet.get(remKey)
                        : undefined;
                      const driverOnLeave =
                        row.cells[2] &&
                        activeLeaveDrivers.has(normRo(row.cells[2]));

                      return (
                        <tr key={row.rowIdx} className="group hover:bg-slate-50">
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-3.5 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                            {row.cells[0] || '—'}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                            {row.cells[1] || '—'}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className="text-slate-900 font-medium">
                              {row.cells[2] || '—'}
                            </span>
                            {driverOnLeave && (
                              <span className="ml-2 text-xs text-amber-700 font-medium">
                                · În concediu azi
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                            {row.cells[3] || '—'}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                            {row.cells[4] || '—'}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                            {row.cells[5] || '—'}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                            {row.cells[6] || '—'}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                            {row.cells[7] || '—'}
                          </td>
                          <td className="py-2.5 px-3.5 text-xs whitespace-nowrap">
                            {activeTrip ? (
                              <span className="text-emerald-700 font-medium">
                                În cursă · {activeTrip.tara}{' '}
                                {activeTrip.localitate} ({activeTrip.dataDesc})
                              </span>
                            ) : remKey ? (
                              <span className="text-slate-500">
                                Remorcă liberă
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </SyncedScrollTable>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {filteredFree.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nu există remorci libere care să corespundă căutării.
            </div>
          ) : (
            <SyncedScrollTable>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Remorcă
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Nr.
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Nefolosită din
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Ultimul șofer
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Situație
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredFree.map((item, idx) => (
                    <tr key={item.remorca} className="group hover:bg-slate-50">
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {item.remorca}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                        {item.nefolositaDin}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {item.ultimulSofer || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {item.motiv || 'Fără cursă activă'}
                      </td>
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
