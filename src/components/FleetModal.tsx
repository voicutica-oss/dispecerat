import { Flame, Trash2, Truck, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  FLOTA_DEFAULT_HEADERS,
  isSheetCheckboxTrue,
  normRo,
  splitDrivers,
} from '../utils/roDates';

export type FleetAddMode = 'driver' | 'vehicle' | 'full';

interface FleetModalProps {
  open: boolean;
  onClose: () => void;
  row?: { rowIdx: number; cells: string[] } | null;
  initialAddMode?: FleetAddMode;
  flota?: string[][];
  flotaHeaders: string[];
  onSave: (payload: {
    row?: number;
    values: string[];
    deleteRow?: boolean;
  }) => Promise<void>;
}

export function FleetModal({
  open,
  onClose,
  row,
  initialAddMode = 'full',
  flota = [],
  flotaHeaders,
  onSave,
}: FleetModalProps) {
  const [cells, setCells] = useState<string[]>(Array(12).fill(''));
  const [addMode, setAddMode] = useState<FleetAddMode>(initialAddMode);
  const [autoMatchedDriver, setAutoMatchedDriver] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const driverCatalog = useMemo(() => {
    const byKey = new Map<
      string,
      { name: string; telefon: string; rezerva: string; adr: boolean }
    >();
    const names = new Set<string>();

    for (let i = 1; i < flota.length; i++) {
      const r = flota[i] || [];
      const rowNum = i + 1;
      if (row && rowNum === row.rowIdx) continue;
      const rawDriver = String(r[2] || '').trim();
      if (!rawDriver || rawDriver === '-' || rawDriver === '—') continue;
      const tel = String(r[4] || '').trim();
      const rez = String(r[5] || '').trim();
      const adr = isSheetCheckboxTrue(r[11]);

      const fullKey = normRo(rawDriver);
      if (fullKey) {
        names.add(rawDriver);
        const existing = byKey.get(fullKey);
        if (!existing) {
          byKey.set(fullKey, {
            name: rawDriver,
            telefon: tel,
            rezerva: rez,
            adr,
          });
        } else {
          if (!existing.telefon && tel) existing.telefon = tel;
          if (!existing.rezerva && rez) existing.rezerva = rez;
          if (adr) existing.adr = true;
        }
      }

      const parts = splitDrivers(rawDriver);
      if (parts.length === 1) {
        names.add(parts[0]);
      } else {
        parts.forEach((p) => {
          names.add(p);
          const pk = normRo(p);
          if (!pk) return;
          const prev = byKey.get(pk);
          if (!prev) {
            byKey.set(pk, {
              name: p,
              telefon: tel,
              rezerva: rez,
              adr,
            });
          } else {
            if (!prev.telefon && tel) prev.telefon = tel;
            if (!prev.rezerva && rez) prev.rezerva = rez;
            if (adr) prev.adr = true;
          }
        });
      }
    }

    return {
      byKey,
      names: Array.from(names).sort((a, b) => a.localeCompare(b)),
    };
  }, [flota, row]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAutoMatchedDriver(null);
    if (row) {
      const padded = Array.from({ length: 12 }, (_, idx) =>
        String(row.cells[idx] || '')
      );
      setCells(padded);
      setAddMode('full');
    } else {
      const fresh = Array(12).fill('');
      fresh[10] = 'TRUE';
      fresh[11] = 'FALSE';
      setCells(fresh);
      setAddMode(initialAddMode);
    }
  }, [open, row, initialAddMode]);

  if (!open) return null;

  const labels = FLOTA_DEFAULT_HEADERS.map((def, idx) =>
    flotaHeaders[idx] && flotaHeaders[idx].trim() ? flotaHeaders[idx].trim() : def
  );

  const hasBifaK = isSheetCheckboxTrue(cells[10]);
  const hasAdrL = isSheetCheckboxTrue(cells[11]);

  const setField = (idx: number, val: string) => {
    if (idx === 2) {
      const trimmed = val.trim();
      const origDriverKey = row ? normRo(row.cells[2]) : '';
      const nextKey = normRo(trimmed);

      if (row && nextKey && nextKey === origDriverKey) {
        setAutoMatchedDriver(null);
        setCells((prev) => {
          const next = [...prev];
          next[2] = val;
          next[4] = String(row.cells[4] || '');
          next[5] = String(row.cells[5] || '');
          next[11] = isSheetCheckboxTrue(row.cells[11]) ? 'TRUE' : 'FALSE';
          return next;
        });
        return;
      }

      const exactFull = nextKey ? driverCatalog.byKey.get(nextKey) : undefined;
      const parts = splitDrivers(trimmed);
      const matchedParts = exactFull
        ? [exactFull]
        : parts
            .map((p) => driverCatalog.byKey.get(normRo(p)))
            .filter(
              (
                item
              ): item is {
                name: string;
                telefon: string;
                rezerva: string;
                adr: boolean;
              } => Boolean(item)
            );

      if (matchedParts.length > 0 && (!row || nextKey !== origDriverKey)) {
        const tels: string[] = [];
        const rezs: string[] = [];
        let hasAnyAdr = false;
        matchedParts.forEach((m) => {
          if (m.telefon && !tels.includes(m.telefon)) tels.push(m.telefon);
          if (m.rezerva && !rezs.includes(m.rezerva)) rezs.push(m.rezerva);
          if (m.adr) hasAnyAdr = true;
        });
        setAutoMatchedDriver(matchedParts.map((m) => m.name).join(', '));
        setCells((prev) => {
          const next = [...prev];
          next[2] = val;
          next[4] = tels.join(' / ');
          next[5] = rezs.join(' / ');
          next[11] = hasAnyAdr ? 'TRUE' : 'FALSE';
          return next;
        });
        return;
      }
      setAutoMatchedDriver(null);
    }

    setCells((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleClearDriver = () => {
    setAutoMatchedDriver(null);
    setCells((prev) => {
      const next = [...prev];
      next[2] = '';
      next[4] = '';
      next[5] = '';
      next[11] = 'FALSE';
      return next;
    });
  };

  const handleClearTruck = () => {
    setCells((prev) => {
      const next = [...prev];
      next[0] = '';
      next[6] = '';
      return next;
    });
  };

  const handleClearTrailer = () => {
    setCells((prev) => {
      const next = [...prev];
      next[1] = '';
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cells.map((c) => c.trim());

    if (!row && addMode === 'driver') {
      if (!cleaned[2]) {
        setError('Introdu numele șoferului.');
        return;
      }
      cleaned[0] = '';
      cleaned[1] = '';
      cleaned[3] = '';
      cleaned[6] = '';
      cleaned[7] = '';
    } else if (!row && addMode === 'vehicle') {
      if (!cleaned[0] && !cleaned[1]) {
        setError('Introdu cel puțin numărul camionului sau al remorcii.');
        return;
      }
    } else {
      if (!cleaned[0] && !cleaned[1] && !cleaned[2]) {
        setError(
          'Introdu cel puțin un camion, o remorcă sau numele unui șofer.'
        );
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        row: row ? row.rowIdx : undefined,
        values: cleaned,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Eroare la salvarea flotei.'
      );
    } finally {
      setSaving(false);
    }
  };

  const showVehicleSection = Boolean(row) || addMode !== 'driver';
  const showDriverSection = Boolean(row) || addMode !== 'vehicle';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] pb-[env(safe-area-inset-bottom)]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {row
                ? `Modifică Rând Flotă (Rând ${row.rowIdx})`
                : addMode === 'driver'
                  ? 'Adaugă Șofer Nou (Rând nou)'
                  : addMode === 'vehicle'
                    ? 'Adaugă Camion / Remorcă (Rând nou)'
                    : 'Adaugă în Flotă (Rând nou)'}
            </h3>
            {!row && (
              <p className="text-xs text-slate-500 mt-0.5">
                Se creează automat un rând nou în foaia „flota”, fără să fii obligat să completezi și celălalt câmp.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!row && (
          <div className="px-6 pt-3 pb-1 border-b border-slate-100 flex flex-wrap gap-1.5 bg-white">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAddMode('driver');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                addMode === 'driver'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Doar șofer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAddMode('vehicle');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                addMode === 'vehicle'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Doar camion / remorcă</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAddMode('full');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                addMode === 'full'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Complet (Vehicul + Șofer)</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {showVehicleSection && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Camion &amp; Remorcă (opțional oricare)
                </span>
                {row && (cells[0].trim() || cells[1].trim()) && (
                  <div className="flex items-center gap-2">
                    {cells[0].trim() && (
                      <button
                        type="button"
                        onClick={handleClearTruck}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Golește camion</span>
                      </button>
                    )}
                    {cells[1].trim() && (
                      <button
                        type="button"
                        onClick={handleClearTrailer}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Golește remorcă</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 3, 6, 7].map((idx) => (
                  <div key={idx} className={idx === 7 ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {labels[idx]}
                    </label>
                    <input
                      type="text"
                      value={cells[idx] || ''}
                      onChange={(e) => setField(idx, e.target.value)}
                      placeholder={`Introdu ${labels[idx].toLowerCase()}`}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {showDriverSection && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    Date Șofer {!row && addMode === 'driver' ? '*' : '(opțional)'}
                  </span>
                  {autoMatchedDriver && (
                    <span className="ml-2 text-[11px] font-medium text-emerald-700">
                      ✓ Preluat automat ({autoMatchedDriver}): telefon +{' '}
                      {hasAdrL ? 'cu ADR' : 'fără ADR'}
                    </span>
                  )}
                </div>
                {row && (cells[2].trim() || cells[4].trim() || cells[5].trim()) && (
                  <button
                    type="button"
                    onClick={handleClearDriver}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Golește doar șoferul</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[2, 4, 5].map((idx) => (
                  <div key={idx} className={idx === 2 ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {labels[idx]}{' '}
                      {!row && addMode === 'driver' && idx === 2 && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      list={idx === 2 ? 'fleet-modal-drivers-list' : undefined}
                      value={cells[idx] || ''}
                      onChange={(e) => setField(idx, e.target.value)}
                      placeholder={`Introdu ${labels[idx].toLowerCase()}`}
                      className={`w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 ${
                        idx !== 2 ? 'font-mono' : ''
                      }`}
                    />
                  </div>
                ))}
              </div>
              <datalist id="fleet-modal-drivers-list">
                {driverCatalog.names.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
              <input
                type="checkbox"
                checked={hasBifaK}
                onChange={(e) =>
                  setField(10, e.target.checked ? 'TRUE' : 'FALSE')
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-xs font-medium text-slate-800">
                Activ în Flotă (col. K)
              </span>
            </label>

            {showDriverSection && (
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-orange-200 bg-orange-50/60 cursor-pointer hover:bg-orange-50">
                <input
                  type="checkbox"
                  checked={hasAdrL}
                  onChange={(e) =>
                    setField(11, e.target.checked ? 'TRUE' : 'FALSE')
                  }
                  className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 h-4 w-4"
                />
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-900">
                  <Flame className="h-3.5 w-3.5 text-orange-600" />
                  Șofer cu ADR (col. L)
                </span>
              </label>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Se salvează...' : row ? 'Salvează modificările' : 'Adaugă rând nou'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
