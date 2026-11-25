import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FreeTrailer, LeaveRecord, TripRecord } from '../types/fleet';
import { normRo, plainRo } from '../utils/roDates';

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
    return [
      h[0] || 'Camion',
      h[1] || 'Remorcă',
      h[2] || 'Șofer titular',
      h[3] || 'Observații',
    ];
  }, [flota]);

  const normRemKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

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
      const cells = Array.from({ length: 4 }, (_, idx) =>
        String(flota[i]?.[idx] || '')
      );
      if (cells.every((c) => !c.trim())) continue;
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
        plainRo(f.nefolositaDin).includes(q)
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
              placeholder="Caută camion, remorcă, șofer..."
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">{headers[0]}</th>
                    <th className="py-2.5 px-4">{headers[1]}</th>
                    <th className="py-2.5 px-4">{headers[2]}</th>
                    <th className="py-2.5 px-4">{headers[3]}</th>
                    <th className="py-2.5 px-4">Situație cursă</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {fleetRows.map((row) => {
                    const remKey = normRemKey(row.cells[1]);
                    const activeTrip = remKey
                      ? activeTrailerSet.get(remKey)
                      : undefined;
                    const driverOnLeave =
                      row.cells[2].trim() &&
                      activeLeaveDrivers.has(normRo(row.cells[2]));

                    return (
                      <tr key={row.rowIdx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          {row.cells[0] || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          {row.cells[1] || '—'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="text-slate-900 font-medium">
                            {row.cells[2] || '—'}
                          </span>
                          {driverOnLeave && (
                            <span className="ml-2 text-xs text-amber-700 font-medium">
                              · În concediu azi
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {row.cells[3] || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-xs whitespace-nowrap">
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
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {filteredFree.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nu există remorci libere care să corespundă căutării.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Nr.</th>
                    <th className="py-2.5 px-4">Remorcă</th>
                    <th className="py-2.5 px-4">Nefolosită din</th>
                    <th className="py-2.5 px-4">Ultimul șofer</th>
                    <th className="py-2.5 px-4">Situație</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredFree.map((item, idx) => (
                    <tr key={item.remorca} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {item.remorca}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
