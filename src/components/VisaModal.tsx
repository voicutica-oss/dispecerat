import {
  AlertCircle,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VisaRecord } from '../types/fleet';
import {
  isoToRoDate,
  resolveVisaColHeaders,
  roToIsoDate,
} from '../utils/roDates';
import {
  parseVisaExcelFile,
  parseVisaPastedText,
  type ImportedVisaRow,
} from '../utils/visaExcelImport';

interface VisaModalProps {
  open: boolean;
  visa: VisaRecord | null;
  initialTab?: 'single' | 'excel';
  headers: string[];
  flota: string[][];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: { row?: number; values: string[] }) => Promise<void>;
  onSaveBatch?: (rows: string[][]) => Promise<void>;
}

export function VisaModal({
  open,
  visa,
  initialTab = 'single',
  headers,
  flota,
  saving,
  error,
  onClose,
  onSave,
  onSaveBatch,
}: VisaModalProps) {
  // doPost for kind='vize' writes columns B, C, D: [Nume, Document, Data expirare]
  const [tab, setTab] = useState<'single' | 'excel'>(initialTab);
  const [nume, setNume] = useState('');
  const [doc, setDoc] = useState('');
  const [expIso, setExpIso] = useState('');

  const [pasteText, setPasteText] = useState('');
  const [importedRows, setImportedRows] = useState<ImportedVisaRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setImportError(null);
    setPasteText('');
    setImportedRows([]);
    setFileName(null);
    if (visa) {
      setTab('single');
      setNume(visa.cells[1] || '');
      setDoc(visa.cells[2] || '');
      setExpIso(roToIsoDate(visa.cells[3] || ''));
    } else {
      setTab(initialTab);
      setNume('');
      setDoc('');
      setExpIso('');
    }
  }, [open, visa, initialTab]);

  const driversList = useMemo(() => {
    const set = new Set<string>();
    for (let i = 1; i < flota.length; i++) {
      const d = String(flota[i]?.[2] || '').trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [flota]);

  if (!open) return null;

  const [, colB, colC, colD] = resolveVisaColHeaders(headers);

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      row: visa ? visa.rowIndex : undefined,
      values: [nume.trim(), doc.trim(), isoToRoDate(expIso)],
    });
  };

  const handleExcelFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setFileName(file.name);
    try {
      const parsed = await parseVisaExcelFile(file);
      if (parsed.length === 0) {
        setImportError(
          'Nu s-au putut detecta rânduri cu vize în fișierul selectat. Verifică să existe coloanele Nume, Document și Data expirării.'
        );
      }
      setImportedRows(parsed);
    } catch {
      setImportError(
        'Fișierul nu a putut fi citit. Încearcă formatul .xlsx, .xls sau .csv.'
      );
      setImportedRows([]);
    }
    e.target.value = '';
  };

  const handlePasteChange = (raw: string) => {
    setPasteText(raw);
    setImportError(null);
    setFileName(null);
    if (!raw.trim()) {
      setImportedRows([]);
      return;
    }
    const parsed = parseVisaPastedText(raw);
    setImportedRows(parsed);
  };

  const updateImportedCell = (
    idx: number,
    field: 'nume' | 'doc' | 'dataExp',
    val: string
  ) => {
    setImportedRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const removeImportedRow = (idx: number) => {
    setImportedRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEmptyImportedRow = () => {
    setImportedRows((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, nume: '', doc: '', dataExp: '' },
    ]);
  };

  const validImportedRows = importedRows.filter(
    (r) => r.nume.trim() && r.doc.trim() && r.dataExp.trim()
  );

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    if (validImportedRows.length === 0) {
      setImportError(
        'Adaugă cel puțin un rând complet (Nume șofer, Document, Data expirare) înainte de salvare.'
      );
      return;
    }
    if (!onSaveBatch) return;
    await onSaveBatch(
      validImportedRows.map((r) => [
        r.nume.trim(),
        r.doc.trim(),
        r.dataExp.trim(),
      ])
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
      <div
        className={`bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full shadow-xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] flex flex-col ${
          !visa && tab === 'excel' ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {visa
                ? `Editează viză (Rând ${visa.rowIndex})`
                : tab === 'excel'
                  ? 'Import tabel Excel — Vize medicale'
                  : 'Adaugă viză / document'}
            </h2>
            <p className="text-xs text-slate-500">
              {tab === 'excel' && !visa
                ? 'Încarcă un fișier Excel (.xlsx/.csv) sau lipește tabelul direct din Excel'
                : 'Actualizează coloanele B, C și D din foaia „vize medicale”'}
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

        {!visa && (
          <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setTab('single')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                tab === 'single'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>O singură viză</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('excel')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                tab === 'excel'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import tabel Excel</span>
            </button>
          </div>
        )}

        {tab === 'single' || visa ? (
          <form onSubmit={handleSubmitSingle} className="p-6 space-y-4 overflow-y-auto">
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
        ) : (
          <form onSubmit={handleSubmitBatch} className="p-6 space-y-4 overflow-y-auto flex-1">
            {(error || importError) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{importError || error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-dashed border-emerald-300 bg-emerald-50/40 rounded-lg flex flex-col justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Varianta 1: Încarcă fișier Excel
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Acceptă <span className="font-mono">.xlsx, .xls, .csv</span> (tabel simplu cu 3–4 coloane sau tabel matrice cu documente pe coloane).
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.ods"
                  onChange={handleExcelFileChange}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Alege fișier Excel</span>
                  </button>
                  {fileName && (
                    <span className="text-[11px] font-medium text-emerald-800 truncate max-w-[180px]">
                      {fileName}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg space-y-2">
                <div className="text-xs font-semibold text-slate-900">
                  Varianta 2: Copiază (Ctrl+C) și lipește din Excel
                </div>
                <textarea
                  rows={3}
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder={`Lipește aici rândurile din Excel:\nPOPESCU ION\tAviz medical\t15.05.2027\nIONESCU DAN\tCard ADR\t20.08.2027`}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {importedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Previzualizare tabel ({validImportedRows.length} vize valide
                    {importedRows.length !== validImportedRows.length
                      ? ` / ${importedRows.length} total`
                      : ''}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={addEmptyImportedRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Adaugă rând</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <th className="py-2 px-2.5 w-10">#</th>
                        <th className="py-2 px-2.5">{colB}</th>
                        <th className="py-2 px-2.5">{colC}</th>
                        <th className="py-2 px-2.5 w-32">{colD}</th>
                        <th className="py-2 px-2.5 w-10 text-right" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importedRows.map((row, idx) => {
                        const rowInvalid =
                          !row.nume.trim() ||
                          !row.doc.trim() ||
                          !row.dataExp.trim();
                        return (
                          <tr
                            key={row.id}
                            className={rowInvalid ? 'bg-amber-50/60' : 'bg-white'}
                          >
                            <td className="py-1.5 px-2.5 font-mono text-slate-400 tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                list="visa-drivers-list"
                                value={row.nume}
                                onChange={(e) =>
                                  updateImportedCell(idx, 'nume', e.target.value)
                                }
                                placeholder="Nume șofer"
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-600"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.doc}
                                onChange={(e) =>
                                  updateImportedCell(idx, 'doc', e.target.value)
                                }
                                placeholder="Document"
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-600"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.dataExp}
                                onChange={(e) =>
                                  updateImportedCell(
                                    idx,
                                    'dataExp',
                                    e.target.value
                                  )
                                }
                                placeholder="zz.ll.aaaa"
                                className="w-full px-2 py-1 font-mono text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-600"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeImportedRow(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                                title="Elimină rândul"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <datalist id="visa-drivers-list">
                  {driversList.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
            )}

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
                disabled={saving || validImportedRows.length === 0}
                className="px-4 py-2.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving
                  ? 'Se importă...'
                  : `Adaugă toate (${validImportedRows.length} vize)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
