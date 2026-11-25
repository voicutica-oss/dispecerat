import { Edit3, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TripRecord, TripStatusType } from '../types/fleet';
import { isFlotaSwapTag, normRemKey, plainRo } from '../utils/roDates';

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
  unknown: { label: '—', cls: 'text-slate-400' },
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
      return (
        t.cells.some((cell) => plainRo(cell).includes(q)) ||
        (colD ? plainRo(colD).includes(q) : false)
      );
    });
  }, [trips, search, statusFilter, countryFilter, trailerColDMap]);

  const colHeaders = useMemo(() => {
    const defaults = [
      'id',
      'Nr camion',
      'data descarcarii',
      'tara',
      'localitatea',
      'detalii',
      'observații',
      'nume sofer',
    ];
    return defaults.map((d, i) =>
      headers[i] && headers[i].trim() ? headers[i].trim() : d
    );
  }, [headers]);

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
              placeholder="Caută camion, remorcă, șofer, localitate, detalii..."
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
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between xl:justify-end gap-3 shrink-0">
          <span className="text-xs text-slate-500 tabular-nums">
            {filtered.length} din {trips.length} rânduri
          </span>
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
                            {trip.cells[1] || '—'}
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
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {trip.cells[7] || 'Fără șofer'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-medium text-slate-900 tabular-nums">
                          {trip.cells[2] || '—'}
                        </div>
                        <div className={`text-[11px] font-medium ${st.cls}`}>
                          {st.label}
                        </div>
                      </div>
                    </div>

                    {(trip.cells[3] || trip.cells[4]) && (
                      <div className="text-xs text-slate-700 truncate">
                        <span className="font-medium text-slate-900">
                          {trip.cells[3]}
                        </span>
                        {trip.cells[3] && trip.cells[4] ? ' · ' : ''}
                        <span>{trip.cells[4]}</span>
                      </div>
                    )}

                    {(trip.cells[5] || trip.cells[6]) && (
                      <div className="text-xs text-slate-500 line-clamp-2">
                        {[trip.cells[5], trip.cells[6]].filter(Boolean).join(' · ')}
                      </div>
                    )}

                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-slate-400">
                        Rând {trip.rowIndex}
                        {trip.cells[0] ? ` · ID ${trip.cells[0]}` : ''}
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

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-3 whitespace-nowrap">Rând</th>
                    {colHeaders.map((h, i) => (
                      <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 whitespace-nowrap">Stare</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Acțiune</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((trip) => {
                    const st = STATUS_LABELS[trip.statusType];
                    const trailerFlag = getTrailerColD(trip);
                    const isSwapFlag = isFlotaSwapTag(trailerFlag);
                    return (
                      <tr
                        key={trip.rowIndex}
                        onClick={() => onEditTrip(trip)}
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-400 tabular-nums">
                          {trip.rowIndex}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {trip.cells[0] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span>{trip.cells[1] || '—'}</span>
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
                          {trip.cells[2] || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {trip.cells[3] || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-700 max-w-[230px] truncate"
                          title={trip.cells[4]}
                        >
                          {trip.cells[4] || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate"
                          title={trip.cells[5]}
                        >
                          {trip.cells[5] || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-600 max-w-[240px] truncate"
                          title={trip.cells[6]}
                        >
                          {trip.cells[6] || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-900 font-medium max-w-[220px] truncate"
                          title={trip.cells[7]}
                        >
                          {trip.cells[7] || (
                            <span className="text-slate-400 text-xs font-normal">
                              —
                            </span>
                          )}
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
