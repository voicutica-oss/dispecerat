import { Flame, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FLOTA_DEFAULT_HEADERS, isSheetCheckboxTrue } from '../utils/roDates';

interface FleetModalProps {
  open: boolean;
  onClose: () => void;
  row?: { rowIdx: number; cells: string[] } | null;
  flotaHeaders: string[];
  onSave: (payload: { row?: number; values: string[] }) => Promise<void>;
}

export function FleetModal({
  open,
  onClose,
  row,
  flotaHeaders,
  onSave,
}: FleetModalProps) {
  const [cells, setCells] = useState<string[]>(Array(12).fill(''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (row) {
      const padded = Array.from({ length: 12 }, (_, idx) =>
        String(row.cells[idx] || '')
      );
      setCells(padded);
    } else {
      const fresh = Array(12).fill('');
      fresh[10] = 'TRUE';
      fresh[11] = 'FALSE';
      setCells(fresh);
    }
  }, [open, row]);

  if (!open) return null;

  const labels = FLOTA_DEFAULT_HEADERS.map((def, idx) =>
    flotaHeaders[idx] && flotaHeaders[idx].trim() ? flotaHeaders[idx].trim() : def
  );

  const hasBifaK = isSheetCheckboxTrue(cells[10]);
  const hasAdrL = isSheetCheckboxTrue(cells[11]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cells[0].trim() && !cells[1].trim()) {
      setError('Introdu cel puțin numărul camionului sau al remorcii.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        row: row ? row.rowIdx : undefined,
        values: cells.map((c) => c.trim()),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la salvarea flotei.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900">
            {row ? `Modifică Vehicul / Șofer (Rând ${row.rowIdx})` : 'Adaugă Vehicul în Flotă'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {labels.map((lbl, idx) => (
              <div key={idx} className={idx < 2 ? 'sm:col-span-1' : ''}>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {lbl} {idx === 0 ? <span className="text-red-500">*</span> : ''}
                </label>
                <input
                  type="text"
                  value={cells[idx] || ''}
                  onChange={(e) => {
                    const next = [...cells];
                    next[idx] = e.target.value;
                    setCells(next);
                  }}
                  placeholder={`Introdu ${lbl.toLowerCase()}`}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
              <input
                type="checkbox"
                checked={hasBifaK}
                onChange={(e) => {
                  const next = [...cells];
                  next[10] = e.target.checked ? 'TRUE' : 'FALSE';
                  setCells(next);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-xs font-medium text-slate-800">
                Activ în Flotă (col. K)
              </span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-orange-200 bg-orange-50/60 cursor-pointer hover:bg-orange-50">
              <input
                type="checkbox"
                checked={hasAdrL}
                onChange={(e) => {
                  const next = [...cells];
                  next[11] = e.target.checked ? 'TRUE' : 'FALSE';
                  setCells(next);
                }}
                className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 h-4 w-4"
              />
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-900">
                <Flame className="h-3.5 w-3.5 text-orange-600" />
                Șofer cu ADR (col. L)
              </span>
            </label>
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
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
