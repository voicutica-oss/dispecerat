import { Check, FileSpreadsheet, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FreeTrailer, LeaveRecord, TripRecord } from '../types/fleet';
import { exportToCsv } from '../utils/excelExport';
import {
  FLOTA_DEFAULT_HEADERS,
  normRemKey,
  normRo,
  plainRo,
} from '../utils/roDates';
import { FleetModal } from './FleetModal';
import { SyncedScrollTable } from './SyncedScrollTable';

interface FleetViewProps {
  flota: string[][];
  freeTrailers: FreeTrailer[];
  trips: TripRecord[];
  leaves: LeaveRecord[];
  onSaveFleet: (payload: { row?: number; values: string[] }) => Promise<void>;
}

export function FleetView({
  flota,
  freeTrailers,
  trips,
  leaves,
  onSaveFleet,
}: FleetViewProps) {
  const [subTab, setSubTab] = useState<'flota' | 'libere'>('flota');
  const [search, setSearch] = useState('');
  const [onlyCheckedBifa, setOnlyCheckedBifa] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<{
    rowIdx: number;
    cells: string[];
  } | null>(null);

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
      const rowArr = flota[i] || [];
      const cells = Array.from({ length: 12 }, (_, idx) =>
        String(rowArr[idx] || '').trim()
      );
      if (cells.every((c) => !c)) continue;

      const checkVal = String(rowArr[10] || '').trim(); // col K (index 10)
      const hasBifa =
        checkVal !== '' && !/^(nu|false|0|-)$/i.test(checkVal);

      if (onlyCheckedBifa && !hasBifa && !q) continue;
      if (q && !cells.some((c) => plainRo(c).includes(q))) continue;
      out.push({ rowIdx: i + 1, cells });
    }
    return out;
  }, [flota, search, onlyCheckedBifa]);

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

  const handleExportFleetExcel = () => {
    exportToCsv(
      'flota-vehicule',
      [...headers, 'Situație cursă'],
      fleetRows.map((r) => {
        const remKey = normRemKey(r.cells[1]);
        const activeTrip = remKey ? activeTrailerSet.get(remKey) : undefined;
        const status = activeTrip
          ? `În cursă - ${activeTrip.tara} ${activeTrip.localitate}`
          : remKey
          ? 'Remorcă liberă'
          : '—';
        return [...r.cells.slice(0, 8), status];
      })
    );
  };

  const handleExportFreeExcel = () => {
    exportToCsv(
      'remorci-libere',
      ['Remorcă', 'Nr.', 'Nefolosită din', 'Ultimul șofer', 'Situație'],
      filteredFree.map((f, i) => [
        f.remorca,
        i + 1,
        f.nefolositaDin,
        f.ultimulSofer || '—',
        f.motiv || 'Fără cursă activă',
      ])
    );
  };

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
              Flotă ({fleetRows.length})
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
              Remorci libere ({filteredFree.length})
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

          {subTab === 'flota' && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100">
              <input
                type="checkbox"
                checked={onlyCheckedBifa}
                onChange={(e) => setOnlyCheckedBifa(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span>Doar cu bifa (col. K)</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'flota' ? (
            <>
              <button
                type="button"
                onClick={handleExportFleetExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingRow(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" />
                <span>Adaugă vehicul</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleExportFreeExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
          )}
        </div>
      </div>

      {subTab === 'flota' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {fleetRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nicio înregistrare găsită în foaia „flota” care să respecte filtrul cu bifa.
            </div>
          ) : (
            <SyncedScrollTable>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    {headers.slice(0, 8).map((h, i) => (
                      <th
                        key={i}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3.5 whitespace-nowrap ${
                          i === 0
                            ? 'left-0 z-30 border-r border-slate-200 w-20 sm:w-24 max-w-[100px]'
                            : 'z-20'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-3.5 whitespace-nowrap">
                      Situație cursă
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-3.5 text-right whitespace-nowrap">
                      Acțiuni
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
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-3.5 font-mono text-xs font-semibold text-slate-900 w-20 sm:w-24 max-w-[100px] whitespace-normal break-words">
                          {row.cells[0] || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          {row.cells[1] || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-normal break-words max-w-[180px]">
                          <span className="text-slate-900 font-medium">
                            {row.cells[2] || '—'}
                          </span>
                          {driverOnLeave && (
                            <span className="ml-2 text-xs text-amber-700 font-medium whitespace-nowrap">
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
                        <td className="py-2.5 px-3.5 font-mono text-xs text-slate-700 whitespace-normal break-words max-w-[150px]">
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
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRow(row);
                              setModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                          >
                            Modifică
                          </button>
                        </td>
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
          {filteredFree.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nu există remorci libere care să corespundă căutării.
            </div>
          ) : (
            <SyncedScrollTable>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 py-2.5 px-4 whitespace-nowrap w-24 sm:w-32 max-w-[120px]">
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
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-4 font-mono text-xs font-semibold text-slate-900 w-24 sm:w-32 max-w-[120px] whitespace-normal break-words">
                        {item.remorca}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                        {item.nefolositaDin}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-normal break-words max-w-[200px]">
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

      <FleetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        row={editingRow}
        flotaHeaders={headers}
        onSave={onSaveFleet}
      />
    </div>
  );
}
