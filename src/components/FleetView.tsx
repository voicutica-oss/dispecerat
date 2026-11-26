import { FileSpreadsheet, Flame, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useResizableColumns,
  type TableColSpec,
} from '../hooks/useResizableColumns';
import type { FreeTrailer, LeaveRecord, TripRecord } from '../types/fleet';
import { exportToCsv } from '../utils/excelExport';
import {
  FLOTA_DEFAULT_HEADERS,
  isSheetCheckboxTrue,
  normRemKey,
  normRo,
  plainRo,
} from '../utils/roDates';
import { FleetModal } from './FleetModal';
import { ResizableTh } from './ResizableTh';
import { SyncedScrollTable } from './SyncedScrollTable';

interface FleetViewProps {
  flota: string[][];
  freeTrailers: FreeTrailer[];
  trips: TripRecord[];
  leaves: LeaveRecord[];
  onlyCheckedBifa: boolean;
  onOnlyCheckedBifaChange: (checked: boolean) => void;
  onSaveFleet: (payload: { row?: number; values: string[] }) => Promise<void>;
}

const FLOTA_COLS: TableColSpec[] = [
  { id: 'nr_camion', defaultWidth: 114, minWidth: 94, maxWidth: 220 },
  { id: 'nr_remorca', defaultWidth: 108, minWidth: 84, maxWidth: 220 },
  { id: 'nume_sofer', defaultWidth: 184, minWidth: 110, maxWidth: 360 },
  { id: 'tip', defaultWidth: 76, minWidth: 52, maxWidth: 160 },
  { id: 'telefon', defaultWidth: 118, minWidth: 86, maxWidth: 220 },
  { id: 'telefon_rezerva', defaultWidth: 122, minWidth: 86, maxWidth: 220 },
  { id: 'an_fabricatie', defaultWidth: 96, minWidth: 68, maxWidth: 180 },
  { id: 'tip_auto', defaultWidth: 126, minWidth: 80, maxWidth: 240 },
  { id: 'situatie', defaultWidth: 210, minWidth: 120, maxWidth: 420, flex: true },
  { id: 'actiuni', defaultWidth: 98, minWidth: 84, maxWidth: 160 },
];

const FLOTA_LIBERE_COLS: TableColSpec[] = [
  { id: 'nr_crt', defaultWidth: 62, minWidth: 46, maxWidth: 120 },
  { id: 'remorca', defaultWidth: 122, minWidth: 96, maxWidth: 240 },
  { id: 'nefolosita', defaultWidth: 132, minWidth: 96, maxWidth: 240 },
  { id: 'sofer', defaultWidth: 188, minWidth: 100, maxWidth: 360 },
  { id: 'situatie', defaultWidth: 180, minWidth: 110, maxWidth: 400, flex: true },
];

export function FleetView({
  flota,
  freeTrailers,
  trips,
  leaves,
  onlyCheckedBifa,
  onOnlyCheckedBifaChange,
  onSaveFleet,
}: FleetViewProps) {
  const [subTab, setSubTab] = useState<'flota' | 'libere'>('flota');
  const [search, setSearch] = useState('');
  const [adrFilter, setAdrFilter] = useState<'all' | 'with' | 'without'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<{
    rowIdx: number;
    cells: string[];
  } | null>(null);

  const flotaResize = useResizableColumns('flota', FLOTA_COLS);
  const libereResize = useResizableColumns('flota_libere', FLOTA_LIBERE_COLS);

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

      const hasDriver = Boolean(
        cells[2] && cells[2] !== '-' && cells[2] !== '—'
      );
      const hasAdr = isSheetCheckboxTrue(cells[11]); // col L (index 11)
      if (adrFilter === 'with' && !hasAdr) continue;
      if (adrFilter === 'without' && (!hasDriver || hasAdr)) continue;

      out.push({ rowIdx: i + 1, cells });
    }
    return out;
  }, [flota, search, onlyCheckedBifa, adrFilter]);

  const visibleFleetUnits = useMemo(() => {
    const truckSet = new Set<string>();
    const trailerSet = new Set<string>();
    fleetRows.forEach((r) => {
      const tKey = normRemKey(r.cells[0]);
      const rKey = normRemKey(r.cells[1]);
      if (tKey) truckSet.add(tKey);
      if (rKey) trailerSet.add(rKey);
    });
    return { trucks: truckSet.size, trailers: trailerSet.size };
  }, [fleetRows]);

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
      [...headers, 'ADR', 'Situație cursă'],
      fleetRows.map((r) => {
        const remKey = normRemKey(r.cells[1]);
        const activeTrip = remKey ? activeTrailerSet.get(remKey) : undefined;
        const status = activeTrip
          ? `În cursă - ${activeTrip.tara} ${activeTrip.localitate}`
          : remKey
          ? 'Remorcă liberă'
          : '—';
        const adr = isSheetCheckboxTrue(r.cells[11]) ? 'ADR' : '';
        return [...r.cells.slice(0, 8), adr, status];
      })
    );
  };

  const handleExportFreeExcel = () => {
    exportToCsv(
      'remorci-libere',
      ['Nr. crt.', 'Remorcă liberă', 'Nefolosită din', 'Ultimul șofer', 'Situație'],
      filteredFree.map((f, i) => [
        i + 1,
        f.remorca,
        f.nefolositaDin,
        f.ultimulSofer || '—',
        f.motiv || 'Fără cursă activă',
      ])
    );
  };

  const flotaHeaderLabels = [...headers.slice(0, 8), 'Situație cursă', 'Acțiuni'];
  const libereHeaderLabels = [
    'Nr. crt.',
    'Remorcă liberă',
    'Nefolosită din',
    'Ultimul șofer',
    'Situație',
  ];

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
              Flotă ({visibleFleetUnits.trucks} cap · {visibleFleetUnits.trailers} rem)
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
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyCheckedBifa}
                  onChange={(e) => onOnlyCheckedBifaChange(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Doar cu bifa (col. K)</span>
              </label>

              <label
                className={`inline-flex items-center gap-2 text-xs font-medium cursor-pointer border px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  adrFilter === 'with'
                    ? 'bg-orange-50 border-orange-300 text-orange-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={adrFilter === 'with'}
                  onChange={(e) =>
                    setAdrFilter(e.target.checked ? 'with' : 'all')
                  }
                  className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 h-4 w-4"
                />
                <Flame className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                <span>Șoferi cu ADR</span>
              </label>

              <label
                className={`inline-flex items-center gap-2 text-xs font-medium cursor-pointer border px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  adrFilter === 'without'
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={adrFilter === 'without'}
                  onChange={(e) =>
                    setAdrFilter(e.target.checked ? 'without' : 'all')
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Șoferi fără ADR</span>
              </label>
            </div>
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
              Nicio înregistrare găsită în foaia „flota” care să respecte filtrele selectate.
            </div>
          ) : (
            <SyncedScrollTable
              hasCustomWidths={flotaResize.hasCustomWidths}
              onResetWidths={flotaResize.resetWidths}
            >
              <table
                style={{ minWidth: `${flotaResize.totalMinWidth}px` }}
                className="w-full table-fixed text-left border-collapse"
              >
                <colgroup>
                  {FLOTA_COLS.map((col) => {
                    const useFlex =
                      col.flex && flotaResize.widths[col.id] === undefined;
                    return (
                      <col
                        key={col.id}
                        style={
                          useFlex
                            ? { minWidth: `${col.defaultWidth}px` }
                            : { width: `${flotaResize.getColWidth(col)}px` }
                        }
                      />
                    );
                  })}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    {FLOTA_COLS.map((col, i) => (
                      <ResizableTh
                        key={col.id}
                        colId={col.id}
                        width={flotaResize.getColWidth(col)}
                        minWidth={col.minWidth}
                        maxWidth={col.maxWidth}
                        isResizing={flotaResize.resizingColId === col.id}
                        onStartResize={flotaResize.startResize}
                        title={flotaHeaderLabels[i]}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3 ${
                          i === 0
                            ? 'left-0 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
                            : 'z-20'
                        } ${i === FLOTA_COLS.length - 1 ? 'text-right' : ''}`}
                      >
                        {flotaHeaderLabels[i]}
                      </ResizableTh>
                    ))}
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

                    const driverAdr = isSheetCheckboxTrue(row.cells[11]);

                    return (
                      <tr key={row.rowIdx} className="group hover:bg-slate-50">
                        <td
                          title={row.cells[0] || ''}
                          className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.06)] py-2.5 px-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap truncate"
                        >
                          {row.cells[0] || '—'}
                        </td>
                        <td
                          title={row.cells[1] || ''}
                          className="py-2.5 px-3 font-mono text-xs font-medium text-slate-900 whitespace-nowrap truncate"
                        >
                          {row.cells[1] || '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-normal break-words leading-snug">
                          <span className="text-slate-900 font-medium">
                            {row.cells[2] || '—'}
                          </span>
                          {driverAdr && (
                            <span
                              title="Șofer cu atestat ADR (Flotă col. L)"
                              className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 text-[10px] font-bold tracking-wide align-middle"
                            >
                              <Flame className="h-3 w-3 text-orange-600" />
                              ADR
                            </span>
                          )}
                          {driverOnLeave && (
                            <span className="ml-1.5 text-xs text-amber-700 font-medium whitespace-nowrap">
                              · În concediu azi
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap truncate">
                          {row.cells[3] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums truncate">
                          {row.cells[4] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums truncate">
                          {row.cells[5] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums truncate">
                          {row.cells[6] || '—'}
                        </td>
                        <td
                          title={row.cells[7] || ''}
                          className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-normal break-words leading-snug"
                        >
                          {row.cells[7] || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-xs whitespace-nowrap truncate">
                          {activeTrip ? (
                            <span
                              title={`În cursă · ${activeTrip.tara} ${activeTrip.localitate} (${activeTrip.dataDesc})`}
                              className="text-emerald-700 font-medium"
                            >
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
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
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
            <SyncedScrollTable
              hasCustomWidths={libereResize.hasCustomWidths}
              onResetWidths={libereResize.resetWidths}
            >
              <table
                style={{ minWidth: `${libereResize.totalMinWidth}px` }}
                className="w-full table-fixed text-left border-collapse"
              >
                <colgroup>
                  {FLOTA_LIBERE_COLS.map((col) => {
                    const useFlex =
                      col.flex && libereResize.widths[col.id] === undefined;
                    return (
                      <col
                        key={col.id}
                        style={
                          useFlex
                            ? { minWidth: `${col.defaultWidth}px` }
                            : { width: `${libereResize.getColWidth(col)}px` }
                        }
                      />
                    );
                  })}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    {FLOTA_LIBERE_COLS.map((col, i) => (
                      <ResizableTh
                        key={col.id}
                        colId={col.id}
                        width={libereResize.getColWidth(col)}
                        minWidth={col.minWidth}
                        maxWidth={col.maxWidth}
                        isResizing={libereResize.resizingColId === col.id}
                        onStartResize={libereResize.startResize}
                        title={libereHeaderLabels[i]}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3 ${
                          i === 1
                            ? 'left-0 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
                            : 'z-20'
                        }`}
                      >
                        {libereHeaderLabels[i]}
                      </ResizableTh>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredFree.map((item, idx) => (
                    <tr key={item.remorca} className="group hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {idx + 1}
                      </td>
                      <td
                        title={item.remorca}
                        className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.06)] py-2.5 px-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap truncate"
                      >
                        {item.remorca}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums truncate">
                        {item.nefolositaDin}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-normal break-words leading-snug">
                        {item.ultimulSofer || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap truncate">
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
