import { FileDown, FileSpreadsheet, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { exportToCsv } from '../utils/excelExport';
import { exportHistoryPdf } from '../utils/pdfExport';
import { plainRo } from '../utils/roDates';
import { SyncedScrollTable } from './SyncedScrollTable';

interface HistoryViewProps {
  istoric: string[][];
}

export function HistoryView({ istoric }: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<'ALL' | 'Curse' | 'Vize' | 'Concediu'>('ALL');

  const rows = useMemo(() => {
    const q = plainRo(search);
    return [...istoric]
      .filter(
        (r) =>
          Array.isArray(r) &&
          r.some((cell) => String(cell || '').trim() !== '') &&
          !(plainRo(r[0]) === 'data si ora' && plainRo(r[1]) === 'utilizator')
      )
      .reverse()
      .filter((r) => {
        if (tabFilter !== 'ALL') {
          const tabName = plainRo(r[2]);
          if (tabFilter === 'Curse') {
            if (
              tabName !== 'curse' &&
              tabName !== 'sheet 1' &&
              tabName !== 'sheet1' &&
              !tabName.includes('remorc')
            ) {
              return false;
            }
          } else if (tabFilter === 'Vize') {
            if (!tabName.includes('vize') && !tabName.includes('viza')) {
              return false;
            }
          } else if (tabFilter === 'Concediu') {
            if (!tabName.includes('concediu')) {
              return false;
            }
          }
        }
        if (!q) return true;
        return r.some((cell) => plainRo(cell).includes(q));
      });
  }, [istoric, search, tabFilter]);

  const handleExportPdf = () => {
    const parts: string[] = [];
    if (tabFilter !== 'ALL') parts.push(`Tab: ${tabFilter}`);
    if (search.trim()) parts.push(`Cautare: "${search.trim()}"`);
    exportHistoryPdf(rows, parts.join(', '));
  };

  const handleExportExcel = () => {
    exportToCsv(
      'istoric-modificari',
      ['Data și ora', 'Utilizator', 'Tab', 'Rând', 'Acțiune', 'Înainte', 'După'],
      rows
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută utilizator, rând, valoare..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'Curse', 'Vize', 'Concediu'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTabFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tabFilter === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'ALL' ? 'Toate' : t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          <span className="text-xs text-slate-500 tabular-nums">
            Ultimele {rows.length} înregistrări
          </span>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
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
          <div className="p-10 text-center text-sm text-slate-500">
            Nu există modificări înregistrate în foaia „istoric”.
          </div>
        ) : (
          <SyncedScrollTable>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 py-2.5 px-4 whitespace-nowrap w-24 sm:w-28 max-w-[110px]">
                    Data și ora
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                    Utilizator
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                    Tab
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                    Rând
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                    Acțiune
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                    Înainte
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                    După
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {rows.map((r, i) => (
                  <tr key={i} className="group hover:bg-slate-50 align-top">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-4 font-mono text-slate-600 w-24 sm:w-28 max-w-[110px] whitespace-normal break-words">
                      {r[0] || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {r[1] || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {r[2] || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">
                      {r[3] || '—'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          r[4] === 'Ștergere'
                            ? 'text-red-600'
                            : r[4] === 'Adăugare'
                              ? 'text-emerald-700'
                              : 'text-blue-700'
                        }`}
                      >
                        {r[4] || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-[260px] whitespace-normal break-words">
                      {r[5] || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 max-w-[260px] whitespace-normal break-words">
                      {r[6] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SyncedScrollTable>
        )}
      </div>
    </div>
  );
}
