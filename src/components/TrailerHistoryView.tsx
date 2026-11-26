import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMobileViewMode } from '../hooks/useMobileViewMode';
import {
  useResizableColumns,
  type TableColSpec,
} from '../hooks/useResizableColumns';
import { plainRo } from '../utils/roDates';
import { CountryFlag } from './CountryFlag';
import { MobileViewToggle } from './MobileViewToggle';
import { ResizableTh } from './ResizableTh';
import { SyncedScrollTable } from './SyncedScrollTable';

interface TrailerHistoryViewProps {
  istoricRemorci: string[][];
  mode: 'demo' | 'live';
  onOpenConnection: () => void;
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
];

export function TrailerHistoryView({
  istoricRemorci,
  mode,
  onOpenConnection,
}: TrailerHistoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>(
    'all'
  );
  const [mobileView, setMobileView] = useMobileViewMode('istoric_remorci', 'cards');

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

  const rows = useMemo(() => {
    const q = plainRo(search);
    const hasHeader =
      istoricRemorci.length > 0 &&
      (plainRo(istoricRemorci[0]?.[0]).includes('nr') ||
        plainRo(istoricRemorci[0]?.[1]).includes('camion'));
    const dataRows = hasHeader ? istoricRemorci.slice(1) : istoricRemorci;

    return dataRows
      .filter(
        (r) =>
          Array.isArray(r) && r.some((cell) => String(cell || '').trim() !== '')
      )
      .reverse()
      .filter((r) => {
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

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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

        <div className="flex items-center justify-between lg:justify-end gap-2.5 shrink-0">
          <MobileViewToggle mode={mobileView} onChange={setMobileView} />
          <span className="text-xs text-slate-500 tabular-nums">
            {rows.length} înregistrări
          </span>
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
                  scriptul Code.gs la versiunea 2.4
                </button>{' '}
                și publică <strong>New version</strong> în Apps Script.
              </p>
            )}
          </div>
        ) : (
          <>
            {mobileView === 'cards' && (
              <div className="md:hidden divide-y divide-slate-200">
                {rows.map((r, i) => {
                  const predata = String(r[2] || '').trim();
                  const preluata = String(r[3] || '').trim();
                  const capPreia = String(r[11] || '').trim();
                  const isPending = Boolean(predata && !capPreia);
                  return (
                    <div key={i} className="p-4 space-y-2 text-xs">
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
                        <div className="text-right shrink-0">
                          <div className="font-mono text-slate-500 tabular-nums">
                            #{r[0] || i + 1} · {r[6] || r[13] || '—'}
                          </div>
                          {isPending ? (
                            <span className="text-amber-700 font-medium">
                              Nepreluată
                            </span>
                          ) : capPreia ? (
                            <span className="text-emerald-700 font-medium">
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
                          {(r[7] || r[8] || r[9]) && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span>Desc. predată:</span>
                              {r[7] && <CountryFlag code={r[7]} className="w-3.5 h-2.5" />}
                              <span>{[r[7], r[8], r[9]].filter(Boolean).join(' · ')}</span>
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
                          {(r[14] || r[15] || r[16]) && (
                            <span className="inline-flex items-center gap-1">
                              <span>·</span>
                              {r[14] && <CountryFlag code={r[14]} className="w-3.5 h-2.5" />}
                              <span>{[r[14], r[15], r[16]].filter(Boolean).join(' / ')}</span>
                            </span>
                          )}
                        </div>
                      )}
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
                    {TRAILER_HISTORY_COLS.map((col, idx) => (
                      <ResizableTh
                        key={col.id}
                        colId={col.id}
                        width={getColWidth(col)}
                        minWidth={col.minWidth}
                        maxWidth={col.maxWidth}
                        isResizing={resizingColId === col.id}
                        onStartResize={startResize}
                        title={headers[idx]}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-2.5 ${
                          idx === 1
                            ? 'left-0 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
                            : 'z-20'
                        }`}
                      >
                        {headers[idx]}
                      </ResizableTh>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rows.map((r, rowIdx) => (
                    <tr key={rowIdx} className="group hover:bg-slate-50">
                      {TRAILER_HISTORY_COLS.map((col, colIdx) => {
                        const val = String(r[colIdx] || '').trim();
                        const isMono =
                          colIdx <= 4 ||
                          colIdx === 6 ||
                          colIdx === 9 ||
                          colIdx === 11 ||
                          colIdx === 13 ||
                          colIdx === 16;
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
                  ))}
                </tbody>
              </table>
            </SyncedScrollTable>
          </>
        )}
      </div>
    </div>
  );
}
