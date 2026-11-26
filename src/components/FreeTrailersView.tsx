import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMobileViewMode } from '../hooks/useMobileViewMode';
import {
  useResizableColumns,
  type TableColSpec,
} from '../hooks/useResizableColumns';
import type { FreeTrailer } from '../types/fleet';
import { isFlotaSwapTag, plainRo } from '../utils/roDates';
import { MobileViewToggle } from './MobileViewToggle';
import { ResizableTh } from './ResizableTh';
import { SyncedScrollTable } from './SyncedScrollTable';

interface FreeTrailersViewProps {
  freeTrailers: FreeTrailer[];
}

const FREE_COLS: TableColSpec[] = [
  { id: 'nr_crt', defaultWidth: 64, minWidth: 48, maxWidth: 120 },
  { id: 'remorca', defaultWidth: 124, minWidth: 96, maxWidth: 240 },
  { id: 'flota_d', defaultWidth: 112, minWidth: 76, maxWidth: 200 },
  { id: 'nefolosita', defaultWidth: 132, minWidth: 96, maxWidth: 240 },
  { id: 'sofer', defaultWidth: 196, minWidth: 110, maxWidth: 360 },
  { id: 'situatie', defaultWidth: 180, minWidth: 110, maxWidth: 400, flex: true },
];

const FREE_HEADERS = [
  'Nr. crt.',
  'Remorcă liberă',
  'Flotă (col. D)',
  'Nefolosită din',
  'Ultimul șofer',
  'Situație',
];

export function FreeTrailersView({ freeTrailers }: FreeTrailersViewProps) {
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useMobileViewMode('remorci_libere', 'cards');

  const {
    widths,
    resizingColId,
    getColWidth,
    totalMinWidth,
    hasCustomWidths,
    resetWidths,
    startResize,
  } = useResizableColumns('remorci_libere', FREE_COLS);

  const filtered = useMemo(() => {
    const q = plainRo(search);
    if (!q) return freeTrailers;
    return freeTrailers.filter(
      (f) =>
        plainRo(f.remorca).includes(q) ||
        plainRo(f.ultimulSofer).includes(q) ||
        plainRo(f.nefolositaDin).includes(q) ||
        plainRo(f.flotaNote).includes(q) ||
        plainRo(f.motiv).includes(q)
    );
  }, [freeTrailers, search]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută remorcă, șofer, SCHIMB, motiv..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 text-xs text-slate-500">
          <span>
            Orice remorcă fără dată descărcare, țară și localitate activă apare automat aici și în foaia{' '}
            <span className="font-mono text-slate-700">REMORCI LIBERE</span>
          </span>
          <div className="flex items-center gap-2.5 shrink-0">
            <MobileViewToggle mode={mobileView} onChange={setMobileView} />
            <span className="font-mono font-medium text-slate-700 tabular-nums shrink-0">
              {filtered.length} din {freeTrailers.length}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nu există remorci libere care să corespundă căutării.
          </div>
        ) : (
          <>
            {mobileView === 'cards' && (
              <div className="md:hidden divide-y divide-slate-200">
                {filtered.map((item, idx) => {
                  const isSwap = isFlotaSwapTag(item.flotaNote);
                  return (
                    <div key={item.remorca} className="p-4 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="font-mono text-xs text-slate-400 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-sm font-semibold text-slate-900">
                            {item.remorca}
                          </span>
                          {item.flotaNote && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${
                                isSwap
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.flotaNote}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs font-medium text-slate-700 tabular-nums shrink-0">
                          {item.nefolositaDin}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 truncate">
                          Șofer: {item.ultimulSofer || '—'}
                        </span>
                        <span className="text-slate-500 shrink-0">
                          {item.motiv || 'Fără cursă activă'}
                        </span>
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
                style={{ minWidth: `${totalMinWidth}px` }}
                className="w-full table-fixed text-left border-collapse"
              >
                <colgroup>
                  {FREE_COLS.map((col) => {
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
                    {FREE_COLS.map((col, i) => (
                      <ResizableTh
                        key={col.id}
                        colId={col.id}
                        width={getColWidth(col)}
                        minWidth={col.minWidth}
                        maxWidth={col.maxWidth}
                        isResizing={resizingColId === col.id}
                        onStartResize={startResize}
                        title={FREE_HEADERS[i]}
                        className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3 ${
                          i === 1
                            ? 'left-0 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
                            : 'z-20'
                        }`}
                      >
                        {FREE_HEADERS[i]}
                      </ResizableTh>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((item, idx) => {
                    const isSwap = isFlotaSwapTag(item.flotaNote);
                    return (
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
                        <td className="py-2.5 px-3 whitespace-nowrap truncate">
                          {item.flotaNote ? (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${
                                isSwap
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.flotaNote}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
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
