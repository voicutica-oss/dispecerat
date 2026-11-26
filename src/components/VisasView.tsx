import { Edit3, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMobileViewMode } from '../hooks/useMobileViewMode';
import {
  useResizableColumns,
  type TableColSpec,
} from '../hooks/useResizableColumns';
import type { VisaRecord } from '../types/fleet';
import { plainRo, resolveVisaColHeaders } from '../utils/roDates';
import { MobileViewToggle } from './MobileViewToggle';
import { ResizableTh } from './ResizableTh';
import { SyncedScrollTable } from './SyncedScrollTable';

interface VisasViewProps {
  headers: string[];
  visas: VisaRecord[];
  onAddVisa: () => void;
  onEditVisa: (visa: VisaRecord) => void;
}

const VISA_COLS: TableColSpec[] = [
  { id: 'nr', defaultWidth: 64, minWidth: 46, maxWidth: 120 },
  { id: 'sofer', defaultWidth: 210, minWidth: 110, maxWidth: 380 },
  { id: 'document', defaultWidth: 185, minWidth: 100, maxWidth: 340 },
  { id: 'data_exp', defaultWidth: 128, minWidth: 94, maxWidth: 220 },
  { id: 'valabilitate', defaultWidth: 165, minWidth: 110, maxWidth: 320, flex: true },
  { id: 'actiune', defaultWidth: 108, minWidth: 84, maxWidth: 160 },
];

export function VisasView({
  headers,
  visas,
  onAddVisa,
  onEditVisa,
}: VisasViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'expired' | 'expiring' | 'valid'>('all');
  const [mobileView, setMobileView] = useMobileViewMode('vize', 'cards');

  const {
    widths,
    resizingColId,
    getColWidth,
    totalMinWidth,
    hasCustomWidths,
    resetWidths,
    startResize,
  } = useResizableColumns('vize', VISA_COLS);

  const colHeaders = useMemo(
    () => resolveVisaColHeaders(headers),
    [headers]
  );

  const allHeaders = [...colHeaders, 'Valabilitate', 'Acțiune'];

  const filtered = useMemo(() => {
    const q = plainRo(search);
    return visas
      .filter((v) => {
        if (filter !== 'all' && v.status !== filter) return false;
        if (!q) return true;
        return v.cells.some((c) => plainRo(c).includes(q));
      })
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  }, [visas, search, filter]);

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
              placeholder="Caută șofer sau document..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Toate' },
                { id: 'expired', label: 'Expirate' },
                { id: 'expiring', label: '≤ 30 zile' },
                { id: 'valid', label: 'Valabile' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-2.5">
          <MobileViewToggle mode={mobileView} onChange={setMobileView} />
          <button
            type="button"
            onClick={onAddVisa}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adaugă viză</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nu există vize medicale care să corespundă criteriilor selectate.
          </div>
        ) : (
          <>
            {mobileView === 'cards' && (
              <div className="md:hidden divide-y divide-slate-200">
                {filtered.map((visa) => (
                  <div
                    key={visa.rowIndex}
                    onClick={() => onEditVisa(visa)}
                    className="p-4 space-y-2 active:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-900 truncate">
                          {visa.cells[1] || '—'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {visa.cells[2] || '—'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-medium text-slate-900 tabular-nums">
                          {visa.cells[3] || '—'}
                        </div>
                        <div className="text-[11px] font-medium mt-0.5">
                          {visa.status === 'expired' ? (
                            <span className="text-red-600">
                              Expirată ({Math.abs(visa.daysLeft || 0)} zile)
                            </span>
                          ) : visa.status === 'expiring' ? (
                            <span className="text-amber-700">
                              {visa.daysLeft === 0
                                ? 'Expiră azi'
                                : `Expiră în ${visa.daysLeft} zile`}
                            </span>
                          ) : visa.status === 'valid' ? (
                            <span className="text-emerald-700">
                              Valabilă ({visa.daysLeft} zile)
                            </span>
                          ) : (
                            <span className="text-slate-400">Dată neidentificată</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-slate-400">
                        Nr. {visa.cells[0] || visa.rowIndex}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditVisa(visa);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Editează</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <SyncedScrollTable
              className={mobileView === 'table' ? 'block' : 'hidden md:block'}
              hasCustomWidths={hasCustomWidths}
              onResetWidths={resetWidths}
            >
              <table
                style={{ minWidth: `${totalMinWidth}px` }}
                className="w-full table-fixed text-left border-collapse"
              >
                <colgroup>
                  {VISA_COLS.map((col) => {
                    const useFlex = col.flex && widths[col.id] === undefined;
                    return (
                      <col
                        key={col.id}
                        style={
                          useFlex
                            ? { minWidth: `${col.defaultWidth}px` }
                            : { width: `${getColWidth(col)}px` }
                        }
                      />
                    );
                  })}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    {VISA_COLS.map((col, i) => (
                      <ResizableTh
                        key={col.id}
                        colId={col.id}
                        width={getColWidth(col)}
                        minWidth={col.minWidth}
                        maxWidth={col.maxWidth}
                        isResizing={resizingColId === col.id}
                        onStartResize={startResize}
                        title={allHeaders[i]}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3 ${
                          i === 0
                            ? 'left-0 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
                            : 'z-20'
                        } ${i === VISA_COLS.length - 1 ? 'text-right' : ''}`}
                      >
                        {allHeaders[i]}
                      </ResizableTh>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((visa) => (
                    <tr
                      key={visa.rowIndex}
                      onClick={() => onEditVisa(visa)}
                      className="group hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.06)] py-2.5 px-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap truncate">
                        {visa.cells[0] || visa.rowIndex}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-normal break-words leading-snug">
                        {visa.cells[1] || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-normal break-words leading-snug">
                        {visa.cells[2] || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums truncate">
                        {visa.cells[3] || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-medium whitespace-nowrap tabular-nums truncate">
                        {visa.status === 'expired' ? (
                          <span className="text-red-600">
                            Expirată ({Math.abs(visa.daysLeft || 0)} zile)
                          </span>
                        ) : visa.status === 'expiring' ? (
                          <span className="text-amber-700">
                            {visa.daysLeft === 0
                              ? 'Expiră azi'
                              : `Expiră în ${visa.daysLeft} zile`}
                          </span>
                        ) : visa.status === 'valid' ? (
                          <span className="text-emerald-700">
                            Valabilă ({visa.daysLeft} zile)
                          </span>
                        ) : (
                          <span className="text-slate-400">Dată neidentificată</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditVisa(visa);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editează</span>
                        </button>
                      </td>
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
