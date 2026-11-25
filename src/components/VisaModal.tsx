import { AlertCircle, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { VisaRecord } from '../types/fleet';
import { isoToRoDate, roToIsoDate } from '../utils/roDates';

interface VisaModalProps {
  open: boolean;
  visa: VisaRecord | null;
  headers: string[];
  flota: string[][];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: { row?: number; values: string[] }) => Promise<void>;
}

export function VisaModal({
  open,
  visa,
  headers,
  flota,
  saving,
  error,
  onClose,
  onSave,
}: VisaModalProps) {
  // doPost for kind='vize' writes columns B, C, D: [Nume, Document, Data expirare]
  const [nume, setNume] = useState('');
  const [doc, setDoc] = useState('');
  const [expIso, setExpIso] = useState('');

  useEffect(() => {
    if (!open) return;
    if (visa) {
      setNume(visa.cells[1] || '');
      setDoc(visa.cells[2] || '');
      setExpIso(roToIsoDate(visa.cells[3] || ''));
    } else {
      setNume('');
      setDoc('');
      setExpIso('');
    }
  }, [open, visa]);

  const driversList = useMemo(() => {
    const set = new Set<string>();
    for (let i = 1; i < flota.length; i++) {
      const d = String(flota[i]?.[2] || '').trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [flota]);

  if (!open) return null;

  const colB = headers[1]?.trim() || 'Nume șofer';
  const colC = headers[2]?.trim() || 'Document';
  const colD = headers[3]?.trim() || 'Data expirare';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      row: visa ? visa.rowIndex : undefined,
      values: [nume.trim(), doc.trim(), isoToRoDate(expIso)],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-md shadow-xl pb-[env(safe-area-inset-bottom)]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {visa ? `Editează viză (Rând ${visa.rowIndex})` : 'Adaugă viză / document'}
            </h2>
            <p className="text-xs text-slate-500">
              Actualizează coloanele B, C și D din foaia „vize medicale”
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {colB}
            </label>
            <input
              type="text"
              required
              list="visa-drivers-list"
              value={nume}
              onChange={(e) => setNume(e.target.value)}
              placeholder="Nume șofer"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
            <datalist id="visa-drivers-list">
              {driversList.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {colC}
            </label>
            <input
              type="text"
              required
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              placeholder="ex. Aviz medical, Psihologic, ADR"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {colD}
            </label>
            <input
              type="date"
              required
              value={expIso}
              onChange={(e) => setExpIso(e.target.value)}
              className="w-full px-3 py-2.5 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
