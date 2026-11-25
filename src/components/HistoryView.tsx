import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { plainRo } from '../utils/roDates';

interface HistoryViewProps {
  istoric: string[][];
}

export function HistoryView({ istoric }: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<'ALL' | 'Curse' | 'Vize' | 'Concediu'>('ALL');

  const rows = useMemo(() => {
    const q = plainRo(search);
    // Display newest first
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

        <span className="text-xs text-slate-500 tabular-nums">
          Ultimele {rows.length} înregistrări
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nu există modificări înregistrate în foaia „istoric”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4 whitespace-nowrap">Data și ora</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Utilizator</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Tab</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Rând</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Acțiune</th>
                  <th className="py-2.5 px-4">Înainte</th>
                  <th className="py-2.5 px-4">După</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 align-top">
                    <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap tabular-nums">
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
                    <td className="py-2.5 px-4 text-slate-500 max-w-[260px] break-words">
                      {r[5] || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 max-w-[260px] break-words">
                      {r[6] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
