import {
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Flame,
  Search,
  Trash2,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useResizableColumns,
  type TableColSpec,
} from '../hooks/useResizableColumns';
import type {
  FreeTrailer,
  LeaveRecord,
  TripRecord,
  VisaRecord,
} from '../types/fleet';
import { exportToCsv } from '../utils/excelExport';
import { exportFleetPdf, exportFreeTrailersPdf } from '../utils/pdfExport';
import {
  FLOTA_DEFAULT_HEADERS,
  isSheetCheckboxTrue,
  normRemKey,
  normRo,
  plainRo,
  splitDrivers,
} from '../utils/roDates';
import { FleetModal, type FleetAddMode } from './FleetModal';
import { ResizableTh } from './ResizableTh';
import { SyncedScrollTable } from './SyncedScrollTable';

interface FleetViewProps {
  flota: string[][];
  freeTrailers: FreeTrailer[];
  trips: TripRecord[];
  leaves: LeaveRecord[];
  visas?: VisaRecord[];
  onlyCheckedBifa: boolean;
  onOnlyCheckedBifaChange: (checked: boolean) => void;
  onSaveFleet: (payload: {
    row?: number;
    values: string[];
    deleteRow?: boolean;
    deleteDriverVisas?: string;
  }) => Promise<void>;
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
  { id: 'actiuni', defaultWidth: 158, minWidth: 138, maxWidth: 210 },
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
  visas = [],
  onlyCheckedBifa,
  onOnlyCheckedBifaChange,
  onSaveFleet,
}: FleetViewProps) {
  const [subTab, setSubTab] = useState<'flota' | 'libere'>('flota');
  const [search, setSearch] = useState('');
  const [adrFilter, setAdrFilter] = useState<'all' | 'with' | 'without'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<FleetAddMode>('full');
  const [editingRow, setEditingRow] = useState<{
    rowIdx: number;
    cells: string[];
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    rowIdx: number;
    cells: string[];
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const getFleetRowStatus = (cells: string[]) => {
    const remKey = normRemKey(cells[1]);
    const activeTrip = remKey ? activeTrailerSet.get(remKey) : undefined;
    return activeTrip
      ? `În cursă - ${activeTrip.tara} ${activeTrip.localitate}`
      : remKey
        ? 'Remorcă liberă'
        : cells[2] && !cells[0]
          ? 'Șofer fără vehicul'
          : '—';
  };

  const handleExportFleetExcel = () => {
    exportToCsv(
      'flota-vehicule',
      [...headers, 'ADR', 'Situație cursă'],
      fleetRows.map((r) => {
        const adr = isSheetCheckboxTrue(r.cells[11]) ? 'ADR' : '';
        return [...r.cells.slice(0, 8), adr, getFleetRowStatus(r.cells)];
      })
    );
  };

  const buildFleetFilterSummary = () => {
    const parts: string[] = [];
    if (onlyCheckedBifa) parts.push('Doar cu bifa (col. K)');
    if (adrFilter === 'with') parts.push('Cu ADR');
    else if (adrFilter === 'without') parts.push('Fara ADR');
    if (search.trim()) parts.push(`Cautare: "${search.trim()}"`);
    return parts.join(' | ');
  };

  const handleExportFleetPdf = () => {
    exportFleetPdf(
      fleetRows.map((r) => ({
        cells: r.cells,
        status: getFleetRowStatus(r.cells),
      })),
      headers,
      buildFleetFilterSummary()
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

  const handleExportFreePdf = () => {
    exportFreeTrailersPdf(
      filteredFree,
      search.trim() ? `Cautare: "${search.trim()}"` : ''
    );
  };

  const openAddModal = (mode: FleetAddMode) => {
    setEditingRow(null);
    setAddMode(mode);
    setModalOpen(true);
  };

  const applyDeleteAction = async (
    action: 'driver' | 'truck' | 'trailer' | 'vehicle' | 'row'
  ) => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const next = [...deleteTarget.cells];
      const targetDriverName = deleteTarget.cells[2].trim();
      if (action === 'row') {
        await onSaveFleet({
          row: deleteTarget.rowIdx,
          values: [],
          deleteRow: true,
          deleteDriverVisas: targetDriverName || undefined,
        });
        setDeleteTarget(null);
        return;
      }

      if (action === 'driver') {
        next[2] = '';
        next[4] = '';
        next[5] = '';
        next[11] = 'FALSE';
      } else if (action === 'truck') {
        next[0] = '';
        next[6] = '';
      } else if (action === 'trailer') {
        next[1] = '';
      } else if (action === 'vehicle') {
        next[0] = '';
        next[1] = '';
        next[3] = '';
        next[6] = '';
        next[7] = '';
      }

      const hasAnyEntity = Boolean(
        next[0].trim() || next[1].trim() || next[2].trim()
      );
      if (!hasAnyEntity) {
        await onSaveFleet({
          row: deleteTarget.rowIdx,
          values: [],
          deleteRow: true,
          deleteDriverVisas:
            action === 'driver' && targetDriverName ? targetDriverName : undefined,
        });
      } else {
        await onSaveFleet({
          row: deleteTarget.rowIdx,
          values: next,
          deleteDriverVisas:
            action === 'driver' && targetDriverName ? targetDriverName : undefined,
        });
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const flotaHeaderLabels = [...headers.slice(0, 8), 'Situație cursă', 'Acțiuni'];
  const libereHeaderLabels = [
    'Nr. crt.',
    'Remorcă liberă',
    'Nefolosită din',
    'Ultimul șofer',
    'Situație',
  ];

  const deleteHasTruck = Boolean(deleteTarget?.cells[0]?.trim());
  const deleteHasTrailer = Boolean(deleteTarget?.cells[1]?.trim());
  const deleteHasVehicle = deleteHasTruck || deleteHasTrailer;
  const deleteHasDriver = Boolean(deleteTarget?.cells[2]?.trim());
  const deleteDriverVisasCount = useMemo(() => {
    const rawDrv = deleteTarget?.cells[2]?.trim() || '';
    if (!rawDrv) return 0;
    const keys = new Set([normRo(rawDrv), ...splitDrivers(rawDrv).map(normRo)].filter(Boolean));
    return visas.filter((v) => {
      const vName = String(v.cells[1] || '').trim();
      if (!vName) return false;
      if (keys.has(normRo(vName))) return true;
      return splitDrivers(vName).some((p) => keys.has(normRo(p)));
    }).length;
  }, [deleteTarget, visas]);

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

        <div className="flex flex-wrap items-center gap-2">
          {subTab === 'flota' ? (
            <>
              <button
                type="button"
                onClick={handleExportFleetExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportFleetPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 whitespace-nowrap"
              >
                <FileText className="h-4 w-4" />
                <span>Export PDF</span>
              </button>
              <button
                type="button"
                onClick={() => openAddModal('driver')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap"
              >
                <UserPlus className="h-4 w-4" />
                <span>Adaugă șofer</span>
              </button>
              <button
                type="button"
                onClick={() => openAddModal('vehicle')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
              >
                <Truck className="h-4 w-4" />
                <span>Adaugă camion / remorcă</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleExportFreeExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportFreePdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 whitespace-nowrap"
              >
                <FileText className="h-4 w-4" />
                <span>Export PDF</span>
              </button>
            </>
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
                          ) : row.cells[2] && !row.cells[0] ? (
                            <span className="text-slate-500">
                              Șofer fără vehicul
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow(row);
                                setAddMode('full');
                                setModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                            >
                              Modifică
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                              title="Șterge șofer, camion, remorcă sau rând"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Șterge</span>
                            </button>
                          </div>
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Ce dorești să ștergi (Rând {deleteTarget.rowIdx})?
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Poți șterge separat doar șoferul, doar camionul/remorca sau tot rândul.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                aria-label="Închide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
              {deleteHasTruck && (
                <div>
                  Camion: <strong className="font-mono">{deleteTarget.cells[0]}</strong>
                </div>
              )}
              {deleteHasTrailer && (
                <div>
                  Remorcă: <strong className="font-mono">{deleteTarget.cells[1]}</strong>
                </div>
              )}
              {deleteHasDriver && (
                <div>
                  Șofer: <strong>{deleteTarget.cells[2]}</strong>
                </div>
              )}
              {deleteHasDriver && (
                <div className="pt-1 text-[11px] text-amber-800 font-medium">
                  {deleteDriverVisasCount > 0
                    ? `Atenție: la ștergerea șoferului sau a rândului se vor șterge automat și cele ${deleteDriverVisasCount} vize medicale ale acestui șofer.`
                    : 'La ștergerea șoferului se șterg automat și eventualele vize medicale asociate.'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {deleteHasDriver && deleteHasVehicle && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => applyDeleteAction('driver')}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-900 transition-colors disabled:opacity-50"
                >
                  <div>Șterge doar șoferul („{deleteTarget.cells[2]}”)</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Camionul și remorca rămân neschimbate pe acest rând.
                  </div>
                </button>
              )}

              {deleteHasTruck && (deleteHasTrailer || deleteHasDriver) && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => applyDeleteAction('truck')}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-900 transition-colors disabled:opacity-50"
                >
                  <div>Șterge doar camionul („{deleteTarget.cells[0]}”)</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Remorca și șoferul rămân păstrate.
                  </div>
                </button>
              )}

              {deleteHasTrailer && (deleteHasTruck || deleteHasDriver) && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => applyDeleteAction('trailer')}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-900 transition-colors disabled:opacity-50"
                >
                  <div>Șterge doar remorca („{deleteTarget.cells[1]}”)</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Camionul și șoferul rămân păstrate.
                  </div>
                </button>
              )}

              {deleteHasVehicle && deleteHasDriver && deleteHasTruck && deleteHasTrailer && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => applyDeleteAction('vehicle')}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-900 transition-colors disabled:opacity-50"
                >
                  <div>Șterge camionul și remorca împreună</div>
                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Șoferul („{deleteTarget.cells[2]}”) rămâne salvat pe acest rând.
                  </div>
                </button>
              )}

              <button
                type="button"
                disabled={deleting}
                onClick={() => applyDeleteAction('row')}
                className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <div>Șterge tot rândul complet</div>
                <div className="text-[11px] text-red-600 font-normal mt-0.5">
                  Elimină întregul rând {deleteTarget.rowIdx} din foaia „flota”.
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}

      <FleetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        row={editingRow}
        initialAddMode={addMode}
        flota={flota}
        flotaHeaders={headers}
        onSave={onSaveFleet}
      />
    </div>
  );
}
