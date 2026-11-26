import { Edit3, FileDown, FileSpreadsheet, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TripRecord, TripStatusType } from '../types/fleet';
import { formatCountryOption } from '../utils/countryFlags';
import { exportToCsv } from '../utils/excelExport';
import { exportTripsPdf } from '../utils/pdfExport';
import {
  computeFleetAutoFill,
  isFlotaSwapTag,
  normRemKey,
  plainRo,
  SHEET1_DEFAULT_HEADERS,
} from '../utils/roDates';
import { CountryFlag } from './CountryFlag';
import { SyncedScrollTable } from './SyncedScrollTable';

interface TripsViewProps {
  headers: string[];
  trips: TripRecord[];
  flota?: string[][];
  onAddTrip: () => void;
  onEditTrip: (trip: TripRecord) => void;
}

type FilterMode = 'all' | 'active' | 'yard_wait' | 'swap' | 'done';

const STATUS_LABELS: Record<TripStatusType, { label: string; cls: string }> = {
  active: { label: 'Activă', cls: 'text-emerald-700' },
  done: { label: 'Finalizată', cls: 'text-slate-500' },
  yard: { label: 'În curte', cls: 'text-amber-700' },
  driver_wait: { label: 'Așteaptă șofer', cls: 'text-amber-700' },
  swap: { label: 'Schimb remorcă', cls: 'text-blue-700' },
  unknown: { label: 'Fără descărcare', cls: 'text-slate-400' },
};

export function TripsView({
  headers,
  trips,
  flota = [],
  onAddTrip,
  onEditTrip,
}: TripsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterMode>('all');
  const [countryFilter, setCountryFilter] = useState('ALL');

  const trailerColDMap = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 1; i < flota.length; i++) {
      const rem = String(flota[i]?.[1] || '').trim();
      const note = String(flota[i]?.[3] || '').trim();
      if (!rem || !note) continue;
      const k = normRemKey(rem);
      if (k) map.set(k, note);
    }
    return map;
  }, [flota]);

  const getTrailerColD = (trip: TripRecord) => {
    const remKey = normRemKey(trip.remorca);
    if (remKey && trailerColDMap.has(remKey)) {
      return trailerColDMap.get(remKey) || '';
    }
    if (!trip.remorca || /^schimb/i.test(trip.remorca)) {
      const camKey = normRemKey(trip.camion);
      if (camKey && trailerColDMap.has(camKey)) {
        return trailerColDMap.get(camKey) || '';
      }
    }
    return '';
  };

  const resolvedCellsMap = useMemo(() => {
    const map = new Map<number, string[]>();
    trips.forEach((t) => {
      const auto = computeFleetAutoFill(
        { camion: t.camion, remorca: t.remorca, soferi: t.sofer },
        flota
      );
      const next = [...t.cells];
      while (next.length < 15) next.push('');
      if (!next[8]) next[8] = auto.telefon;
      if (!next[9]) next[9] = auto.rezerva;
      if (!next[10]) next[10] = auto.tipAuto;
      if (!next[11]) next[11] = auto.anFabricatie;
      if (!next[14]) next[14] = auto.camioaneOriginal;
      map.set(t.rowIndex, next);
    });
    return map;
  }, [trips, flota]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      if (t.tara) set.add(t.tara.toUpperCase());
    });
    return Array.from(set).sort();
  }, [trips]);

  const filtered = useMemo(() => {
    const q = plainRo(search);
    return trips.filter((t) => {
      if (statusFilter === 'active' && t.statusType !== 'active') return false;
      if (statusFilter === 'done' && t.statusType !== 'done') return false;
      if (
        statusFilter === 'yard_wait' &&
        t.statusType !== 'yard' &&
        t.statusType !== 'driver_wait'
      ) {
        return false;
      }
      if (statusFilter === 'swap' && t.statusType !== 'swap') return false;
      if (countryFilter !== 'ALL' && t.tara.toUpperCase() !== countryFilter) {
        return false;
      }
      if (!q) return true;
      const colD = getTrailerColD(t);
      const dispCells = resolvedCellsMap.get(t.rowIndex) || t.cells;
      return (
        dispCells.some((cell) => plainRo(cell).includes(q)) ||
        (colD ? plainRo(colD).includes(q) : false)
      );
    });
  }, [trips, search, statusFilter, countryFilter, trailerColDMap, resolvedCellsMap]);

  const totalWithTractor = useMemo(
    () => trips.filter((t) => Boolean(t.camion.trim())).length,
    [trips]
  );
  const filteredWithTractor = useMemo(
    () => filtered.filter((t) => Boolean(t.camion.trim())).length,
    [filtered]
  );

  const colHeaders = useMemo(() => {
    return SHEET1_DEFAULT_HEADERS.map((d, i) =>
      headers[i] && headers[i].trim() ? headers[i].trim() : d
    );
  }, [headers]);

  const handleExportPdf = () => {
    const filterParts: string[] = [];
    const statusMap: Record<FilterMode, string> = {
      all: 'Toate',
      active: 'Active',
      yard_wait: 'Curte / Sofer',
      swap: 'Schimburi',
      done: 'Finalizate',
    };
    if (statusFilter !== 'all') filterParts.push(`Stare: ${statusMap[statusFilter]}`);
    if (countryFilter !== 'ALL') filterParts.push(`Tara: ${countryFilter}`);
    if (search.trim()) filterParts.push(`Cautare: "${search.trim()}"`);
    exportTripsPdf(filtered, resolvedCellsMap, filterParts.join(', '));
  };

  const handleExportExcel = () => {
    const headers = [...colHeaders, 'Stare'];
    const dataRows = filtered.map((t) => {
      const c = resolvedCellsMap.get(t.rowIndex) || t.cells;
      const stLabel = STATUS_LABELS[t.statusType]?.label || '';
      return [c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11], c[12], c[13], c[14], stLabel];
    });
    exportToCsv('raport-curse', headers, dataRows);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută camion, remorcă, șofer, telefon, tip auto..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
            {(
              [
                { id: 'all', label: 'Toate' },
                { id: 'active', label: 'Active' },
                { id: 'yard_wait', label: 'Curte / Șofer' },
                { id: 'swap', label: 'Schimburi' },
                { id: 'done', label: 'Finalizate' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            aria-label="Filtrează după țară"
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">Toate țările</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {formatCountryOption(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5 shrink-0">
          <span className="text-xs text-slate-500 tabular-nums">
            {filteredWithTractor} din {totalWithTractor} camioane
          </span>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5 text-slate-500" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={onAddTrip}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Cursă nouă</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-600">
              Nicio cursă nu corespunde filtrelor selectate.
            </p>
            <button
              type="button"
              onClick={onAddTrip}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adaugă prima cursă</span>
            </button>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-200">
              {filtered.map((trip) => {
                const st = STATUS_LABELS[trip.statusType];
                const trailerFlag = getTrailerColD(trip);
                const isSwapFlag = isFlotaSwapTag(trailerFlag);
                const cells = resolvedCellsMap.get(trip.rowIndex) || trip.cells;
                return (
                  <div
                    key={trip.rowIndex}
                    onClick={() => onEditTrip(trip)}
                    className="p-4 space-y-2 active:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-semibold text-slate-900 truncate">
                            {cells[1] || '—'}
                          </span>
                          {trailerFlag && (
                            <span
                              title={`Flotă col. D: ${trailerFlag}`}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${
                                isSwapFlag
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {trailerFlag}
                            </span>
                          )}
                          {cells[10] && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {cells[10]}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {cells[7] || 'Fără șofer'}
                          {cells[8] ? ` · ${cells[8]}` : ''}
                          {cells[9] ? ` / ${cells[9]}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-medium text-slate-900 tabular-nums">
                          {cells[2] || '—'}
                        </div>
                        <div className={`text-[11px] font-medium ${st.cls}`}>
                          {st.label}
                        </div>
                      </div>
                    </div>

                    {(cells[3] || cells[4]) && (
                      <div className="text-xs text-slate-700 truncate flex items-center gap-1.5">
                        {cells[3] && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-900 shrink-0">
                            <CountryFlag code={cells[3]} className="w-3.5 h-2.5" />
                            <span>{cells[3]}</span>
                          </span>
                        )}
                        {cells[3] && cells[4] ? <span className="text-slate-400">·</span> : null}
                        <span className="truncate">{cells[4]}</span>
                      </div>
                    )}

                    {(cells[5] || cells[6]) && (
                      <div className="text-xs text-slate-500 line-clamp-2">
                        {[cells[5], cells[6]].filter(Boolean).join(' · ')}
                      </div>
                    )}

                    {(cells[11] || cells[12] || cells[13] || cells[14]) && (
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
                        {cells[11] && <span>An: {cells[11]}</span>}
                        {cells[12] && <span>Est: {cells[12]}</span>}
                        {cells[13] && <span>Garaj: {cells[13]}</span>}
                        {cells[14] && <span>Orig: {cells[14]}</span>}
                      </div>
                    )}

                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-slate-400">
                        Rând {trip.rowIndex}
                        {cells[0] ? ` · ID ${cells[0]}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTrip(trip);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Editează</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <SyncedScrollTable className="hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    {colHeaders.map((h, i) => (
                      <th
                        key={i}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3 ${
                          i === 0
                            ? 'left-0 z-30 border-r border-slate-200 w-16 sm:w-20 max-w-[80px] whitespace-normal break-words'
                            : 'z-20 whitespace-nowrap'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-3 whitespace-nowrap">
                      Stare
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-3 text-right whitespace-nowrap">
                      Acțiune
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((trip) => {
                    const st = STATUS_LABELS[trip.statusType];
                    const trailerFlag = getTrailerColD(trip);
                    const isSwapFlag = isFlotaSwapTag(trailerFlag);
                    const cells = resolvedCellsMap.get(trip.rowIndex) || trip.cells;
                    return (
                      <tr
                        key={trip.rowIndex}
                        onClick={() => onEditTrip(trip)}
                        title={`Rând ${trip.rowIndex}`}
                        className="group hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-3 font-mono text-xs text-slate-700 w-16 sm:w-20 max-w-[80px] whitespace-normal break-words tabular-nums">
                          {cells[0] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span>{cells[1] || '—'}</span>
                            {trailerFlag && (
                              <span
                                title={`Flotă col. D: ${trailerFlag}`}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded font-sans text-[10px] font-semibold uppercase tracking-wide border ${
                                  isSwapFlag
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {trailerFlag}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {cells[2] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {cells[3] ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CountryFlag code={cells[3]} className="w-4 h-3" />
                              <span>{cells[3]}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-700 max-w-[230px] truncate"
                          title={cells[4]}
                        >
                          {cells[4] || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate"
                          title={cells[5]}
                        >
                          {cells[5] || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-600 max-w-[240px] truncate"
                          title={cells[6]}
                        >
                          {cells[6] || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-900 font-medium max-w-[220px] truncate"
                          title={cells[7]}
                        >
                          {cells[7] || (
                            <span className="text-slate-400 text-xs font-normal">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {cells[8] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                          {cells[9] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {cells[10] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {cells[11] || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-nowrap">
                          {cells[12] || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-nowrap">
                          {cells[13] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {cells[14] || '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`text-xs font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTrip(trip);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Editează</span>
                          </button>
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
    </div>
  );
}
