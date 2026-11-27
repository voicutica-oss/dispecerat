import {
  AlertTriangle,
  Edit3,
  FileDown,
  FileSpreadsheet,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMobileViewMode } from '../hooks/useMobileViewMode';
import {
  useResizableColumns,
  type TableColSpec,
} from '../hooks/useResizableColumns';
import { exportToCsv } from '../utils/excelExport';
import { exportTrailerHistoryPdf } from '../utils/pdfExport';
import { plainRo } from '../utils/roDates';
import { CountryFlag } from './CountryFlag';
import { MobileViewToggle } from './MobileViewToggle';
import { ResizableTh } from './ResizableTh';
import { SyncedScrollTable } from './SyncedScrollTable';

interface TrailerHistoryViewProps {
  istoricRemorci: string[][];
  mode: 'demo' | 'live';
  onOpenConnection: () => void;
  onSaveRow: (payload: { row: number; values: string[] }) => Promise<void> | void;
}

interface TrailerHistoryRowItem {
  rowIndex: number;
  cells: string[];
}

const DEFAULT_HEADERS = [
  'Nr crt',
  'Nr camion',
  'Remorcă predată',
  'Remorcă preluată',
  'Data preluării (ant.)',
  'Localitate predare',
  'Data predării',
  'Țara desc.',
  'Localitate desc.',
  'Data desc.',
  'Șofer predă',
  'Cap tractor preia',
  'Șofer preia',
  'Data preluării',
  'Țară (preluată)',
  'Localitate (preluată)',
  'Data desc. (preluată)',
  'Data înc. (predată)',
  'Data înc. (preluată)',
];

const TRAILER_HISTORY_COLS: TableColSpec[] = [
  { id: 'nr_crt', defaultWidth: 58, minWidth: 44, maxWidth: 110 },
  { id: 'nr_camion', defaultWidth: 114, minWidth: 88, maxWidth: 220 },
  { id: 'rem_predata', defaultWidth: 124, minWidth: 92, maxWidth: 240 },
  { id: 'rem_preluata', defaultWidth: 124, minWidth: 92, maxWidth: 240 },
  { id: 'data_preluarii_ant', defaultWidth: 132, minWidth: 94, maxWidth: 220 },
  { id: 'loc_predare', defaultWidth: 156, minWidth: 94, maxWidth: 300 },
  { id: 'data_predarii', defaultWidth: 114, minWidth: 84, maxWidth: 200 },
  { id: 'tara_desc', defaultWidth: 82, minWidth: 56, maxWidth: 150 },
  { id: 'loc_desc', defaultWidth: 156, minWidth: 94, maxWidth: 300 },
  { id: 'data_desc', defaultWidth: 114, minWidth: 84, maxWidth: 200 },
  { id: 'sofer_preda', defaultWidth: 170, minWidth: 96, maxWidth: 320 },
  { id: 'cap_preia', defaultWidth: 124, minWidth: 88, maxWidth: 220 },
  { id: 'sofer_preia', defaultWidth: 170, minWidth: 96, maxWidth: 320 },
  { id: 'data_preluarii', defaultWidth: 118, minWidth: 84, maxWidth: 200 },
  { id: 'tara_preluata', defaultWidth: 96, minWidth: 56, maxWidth: 160 },
  { id: 'loc_preluata', defaultWidth: 156, minWidth: 94, maxWidth: 300 },
  { id: 'data_desc_preluata', defaultWidth: 128, minWidth: 88, maxWidth: 220 },
  { id: 'data_inc_predata', defaultWidth: 128, minWidth: 88, maxWidth: 220 },
  { id: 'data_inc_preluata', defaultWidth: 128, minWidth: 88, maxWidth: 220 },
  { id: 'actiune', defaultWidth: 96, minWidth: 82, maxWidth: 140 },
];

const FIELD_SECTIONS: { title: string; indices: number[] }[] = [
  { title: 'Identificare & Remorci', indices: [0, 1, 2, 3, 4] },
  { title: 'Predare & Ultima cursă (predată)', indices: [5, 6, 17, 7, 8, 9, 10] },
  { title: 'Preluare de alt camion', indices: [11, 12, 13, 18, 14, 15, 16] },
];

export function TrailerHistoryView({
  istoricRemorci,
  mode,
  onOpenConnection,
  onSaveRow,
}: TrailerHistoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>(
    'all'
  );
  const [mobileView, setMobileView] = useMobileViewMode('istoric_remorci', 'cards');
  const [confirmRow, setConfirmRow] = useState<TrailerHistoryRowItem | null>(null);
  const [editingRow, setEditingRow] = useState<TrailerHistoryRowItem | null>(null);
  const [formValues, setFormValues] = useState<string[]>(() =>
    Array.from({ length: 19 }, () => '')
  );
  const [saving, setSaving] = useState(false);

  const {
    resizingColId,
    getColWidth,
    totalMinWidth,
    hasCustomWidths,
    resetWidths,
    startResize,
  } = useResizableColumns('istoric_remorci', TRAILER_HISTORY_COLS);

  const headers = useMemo(() => {
    const first = istoricRemorci[0] || [];
    return DEFAULT_HEADERS.map((def, idx) =>
      first[idx] && String(first[idx]).trim() ? String(first[idx]).trim() : def
    );
  }, [istoricRemorci]);

  const rows = useMemo<TrailerHistoryRowItem[]>(() => {
    const q = plainRo(search);
    const hasHeader =
      istoricRemorci.length > 0 &&
      (plainRo(istoricRemorci[0]?.[0]).includes('nr') ||
        plainRo(istoricRemorci[0]?.[1]).includes('camion'));
    const startIdx = hasHeader ? 1 : 0;

    const indexed: TrailerHistoryRowItem[] = [];
    for (let idx = startIdx; idx < istoricRemorci.length; idx++) {
      const r = istoricRemorci[idx];
      if (
        Array.isArray(r) &&
        r.some((cell) => String(cell || '').trim() !== '')
      ) {
        indexed.push({
          rowIndex: idx + 1,
          cells: Array.from({ length: 19 }, (_, c) => String(r[c] ?? '')),
        });
      }
    }

    return indexed.reverse().filter(({ cells: r }) => {
      const hasHandover = Boolean(String(r[2] || '').trim());
      const hasPickupTruck = Boolean(String(r[11] || '').trim());
      if (filterMode === 'pending' && !(hasHandover && !hasPickupTruck)) {
        return false;
      }
      if (filterMode === 'completed' && !hasPickupTruck) {
        return false;
      }
      if (!q) return true;
      return r.some((cell) => plainRo(cell).includes(q));
    });
  }, [istoricRemorci, search, filterMode]);

  const handleExportExcel = () => {
    exportToCsv(
      'istoric-remorci',
      headers,
      rows.map((item) => item.cells)
    );
  };

  const handleExportPdf = () => {
    const parts: string[] = [];
    if (filterMode === 'pending') parts.push('Filtru: Nepreluate');
    if (filterMode === 'completed') parts.push('Filtru: Preluate');
    if (search.trim()) parts.push(`Cautare: "${search.trim()}"`);
    exportTrailerHistoryPdf(
      rows.map((item) => item.cells),
      parts.join(', ')
    );
  };

  const handleRequestEdit = (item: TrailerHistoryRowItem) => {
    setConfirmRow(item);
  };

  const handleConfirmEdit = () => {
    if (!confirmRow) return;
    setFormValues(Array.from({ length: 19 }, (_, i) => String(confirmRow.cells[i] || '')));
    setEditingRow(confirmRow);
    setConfirmRow(null);
  };

  const handleFieldChange = (colIdx: number, val: string) => {
    setFormValues((prev) => {
      const next = [...prev];
      next[colIdx] = val;
      return next;
    });
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow || saving) return;
    setSaving(true);
    try {
      await onSaveRow({
        row: editingRow.rowIndex,
        values: formValues.map((v) => v.trim()),
      });
      setEditingRow(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută camion, remorcă, șofer, localitate..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Toate' },
                { id: 'pending', label: 'Nepreluate' },
                { id: 'completed', label: 'Preluate' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterMode(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterMode === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 shrink-0">
          <MobileViewToggle mode={mobileView} onChange={setMobileView} />
          <span className="text-xs text-slate-500 tabular-nums">
            {rows.length} înregistrări
          </span>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5 text-slate-500" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-slate-500">
              Nu există înregistrări în foaia „istoric remorci” care să corespundă căutării.
            </p>
            {mode === 'live' && istoricRemorci.length === 0 && (
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Pentru a citi foaia <code className="font-mono">istoric remorci</code> direct aici, actualizează{' '}
                <button
                  type="button"
                  onClick={onOpenConnection}
                  className="text-blue-700 underline font-medium"
                >
                  scriptul Code.gs la versiunea 3.7
                </button>{' '}
                și publică <strong>Versiune nouă</strong> în Apps Script.
              </p>
            )}
          </div>
        ) : (
          <>
            {mobileView === 'cards' && (
              <div className="md:hidden divide-y divide-slate-200">
                {rows.map((item, i) => {
                  const r = item.cells;
                  const predata = String(r[2] || '').trim();
                  const preluata = String(r[3] || '').trim();
                  const capPreia = String(r[11] || '').trim();
                  const isPending = Boolean(predata && !capPreia);
                  return (
                    <div key={item.rowIndex} className="p-4 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-sm font-semibold text-slate-900">
                            {r[1] || '—'}
                          </div>
                          <div className="text-slate-600 mt-0.5">
                            {predata ? (
                              <>
                                Predat: <strong className="font-mono">{predata}</strong>
                              </>
                            ) : (
                              'Fără predare'
                            )}
                            {preluata && (
                              <>
                                {' · '}Preluat: <strong className="font-mono">{preluata}</strong>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="font-mono text-slate-500 tabular-nums">
                            #{r[0] || i + 1} · {r[6] || r[13] || '—'}
                          </div>
                          {isPending ? (
                            <span className="inline-block text-amber-700 font-medium">
                              Nepreluată
                            </span>
                          ) : capPreia ? (
                            <span className="inline-block text-emerald-700 font-medium">
                              Preluată de {capPreia}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {(r[5] || r[8] || r[10]) && (
                        <div className="text-slate-600 space-y-0.5">
                          {r[5] && (
                            <div>
                              Localitate predare: <strong className="text-slate-800">{r[5]}</strong>
                            </div>
                          )}
                          {(r[7] || r[8] || r[9] || r[17]) && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span>Cursă predată:</span>
                              {r[7] && <CountryFlag code={r[7]} className="w-3.5 h-2.5" />}
                              <span>
                                {[
                                  r[7],
                                  r[8],
                                  r[17] ? `Înc: ${r[17]}` : '',
                                  r[9] ? `Desc: ${r[9]}` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </div>
                          )}
                          {r[10] && <div>Șofer predă: {r[10]}</div>}
                        </div>
                      )}

                      {capPreia && (
                        <div className="pt-1 border-t border-slate-100 text-slate-600 flex flex-wrap items-center gap-1">
                          <span>
                            Preluat de <strong className="font-mono text-slate-800">{capPreia}</strong>
                            {r[12] ? ` (${r[12]})` : ''}
                            {r[13] ? ` · ${r[13]}` : ''}
                          </span>
                          {(r[14] || r[15] || r[16] || r[18]) && (
                            <span className="inline-flex items-center gap-1">
                              <span>·</span>
                              {r[14] && <CountryFlag code={r[14]} className="w-3.5 h-2.5" />}
                              <span>
                                {[
                                  r[14],
                                  r[15],
                                  r[18] ? `Înc: ${r[18]}` : '',
                                  r[16] ? `Desc: ${r[16]}` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' / ')}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRequestEdit(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editează</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <SyncedScrollTable
              className={mobileView === 'table' ? 'block' : 'hidden md:block'}
              hasCustomWidths={hasCustomWidths}
              onResetWidths={resetWidths}
            >
              <table
                style={{ width: `${totalMinWidth}px`, minWidth: '100%' }}
                className="table-fixed text-left border-collapse"
              >
                <colgroup>
                  {TRAILER_HISTORY_COLS.map((col) => (
                    <col key={col.id} style={{ width: `${getColWidth(col)}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500">
                    {TRAILER_HISTORY_COLS.map((col, idx) => {
                      const label = idx < headers.length ? headers[idx] : 'Acțiune';
                      return (
                        <ResizableTh
                          key={col.id}
                          colId={col.id}
                          width={getColWidth(col)}
                          minWidth={col.minWidth}
                          maxWidth={col.maxWidth}
                          isResizing={resizingColId === col.id}
                          onStartResize={startResize}
                          title={label}
                          className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-2.5 ${
                            idx === 1
                              ? 'left-0 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
                              : 'z-20'
                          }`}
                        >
                          {label}
                        </ResizableTh>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rows.map((item) => {
                    const r = item.cells;
                    return (
                      <tr key={item.rowIndex} className="group hover:bg-slate-50">
                        {TRAILER_HISTORY_COLS.map((col, colIdx) => {
                          if (col.id === 'actiune') {
                            return (
                              <td
                                key={col.id}
                                className="py-1.5 px-2.5 whitespace-nowrap"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleRequestEdit(item)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  <span>Editează</span>
                                </button>
                              </td>
                            );
                          }

                          const val = String(r[colIdx] || '').trim();
                          const isMono =
                            colIdx <= 4 ||
                            colIdx === 6 ||
                            colIdx === 9 ||
                            colIdx === 11 ||
                            colIdx === 13 ||
                            colIdx === 16 ||
                            colIdx === 17 ||
                            colIdx === 18;
                          return (
                            <td
                              key={col.id}
                              title={val}
                              className={`py-2 px-2.5 whitespace-nowrap truncate ${
                                isMono ? 'font-mono tabular-nums' : ''
                              } ${
                                colIdx === 0
                                  ? 'text-slate-400'
                                  : colIdx === 1
                                    ? 'font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.06)]'
                                    : colIdx === 2 && val
                                      ? 'font-medium text-amber-800'
                                      : colIdx === 3 && val
                                        ? 'font-medium text-blue-800'
                                        : colIdx === 11 && val
                                          ? 'font-medium text-emerald-800'
                                          : 'text-slate-700'
                              }`}
                            >
                              {(colIdx === 7 || colIdx === 14) && val ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <CountryFlag code={val} className="w-4 h-3 shrink-0" />
                                  <span>{val}</span>
                                </span>
                              ) : (
                                val || '—'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SyncedScrollTable>
          </>
        )}
      </div>

      {confirmRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Ești sigur că vrei să editezi?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Vei modifica înregistrarea din <strong>Istoric Remorci</strong> (rând{' '}
                  <span className="font-mono">{confirmRow.rowIndex}</span>):
                </p>
                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-0.5">
                  <div>
                    Camion: <strong className="font-mono">{confirmRow.cells[1] || '—'}</strong>
                    {confirmRow.cells[0] ? ` (#${confirmRow.cells[0]})` : ''}
                  </div>
                  {(confirmRow.cells[2] || confirmRow.cells[3]) && (
                    <div>
                      {confirmRow.cells[2] ? `Predat: ${confirmRow.cells[2]}` : ''}
                      {confirmRow.cells[2] && confirmRow.cells[3] ? ' · ' : ''}
                      {confirmRow.cells[3] ? `Preluat: ${confirmRow.cells[3]}` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmRow(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Nu, anulează
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
              >
                Da, editează
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-xl pb-[env(safe-area-inset-bottom)]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Editare Istoric Remorcă (Rând {editingRow.rowIndex})
                </h2>
                <p className="text-xs text-slate-500">
                  Modificările se salvează în foaia „istoric remorci” și în istoricul modificărilor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                aria-label="Închide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-5">
              {FIELD_SECTIONS.map((section) => (
                <div
                  key={section.title}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                >
                  <div className="text-xs font-semibold text-slate-800">
                    {section.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {section.indices.map((colIdx) => (
                      <div key={colIdx}>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          {headers[colIdx]}
                        </label>
                        <input
                          type="text"
                          value={formValues[colIdx] || ''}
                          onChange={(e) => handleFieldChange(colIdx, e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving ? 'Se salvează...' : 'Salvează modificările'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
