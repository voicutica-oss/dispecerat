import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { plainRo } from '../utils/roDates';

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

export function TrailerHistoryView({
  istoricRemorci,
  mode,
  onOpenConnection,
}: TrailerHistoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>(
    'all'
  );

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

        <span className="text-xs text-slate-500 tabular-nums">
          {rows.length} înregistrări
        </span>
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
                          <div>
                            Desc. predată: {[r[7], r[8], r[9]].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {r[10] && <div>Șofer predă: {r[10]}</div>}
                      </div>
                    )}

                    {capPreia && (
                      <div className="pt-1 border-t border-slate-100 text-slate-600">
                        Preluat de <strong className="font-mono text-slate-800">{capPreia}</strong>
                        {r[12] ? ` (${r[12]})` : ''}
                        {r[13] ? ` · ${r[13]}` : ''}
                        {(r[14] || r[15] || r[16]) &&
                          ` · ${[r[14], r[15], r[16]].filter(Boolean).join(' / ')}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                    {headers.map((h, idx) => (
                      <th
                        key={idx}
                        className={`py-2.5 px-3 whitespace-nowrap ${
                          idx === 0
                            ? 'sticky left-0 bg-slate-50 z-10 border-r border-slate-200'
                            : idx === 1
                              ? 'sticky left-[58px] bg-slate-50 z-10 border-r border-slate-200'
                              : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rows.map((r, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50">
                      {DEFAULT_HEADERS.map((_, colIdx) => {
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
                            key={colIdx}
                            className={`py-2 px-3 whitespace-nowrap ${
                              isMono ? 'font-mono tabular-nums' : ''
                            } ${
                              colIdx === 0
                                ? 'text-slate-400 sticky left-0 bg-white z-10 border-r border-slate-200'
                                : colIdx === 1
                                  ? 'font-semibold text-slate-900 sticky left-[58px] bg-white z-10 border-r border-slate-200'
                                  : colIdx === 2 && val
                                    ? 'font-medium text-amber-800'
                                    : colIdx === 3 && val
                                      ? 'font-medium text-blue-800'
                                      : colIdx === 11 && val
                                        ? 'font-medium text-emerald-800'
                                        : 'text-slate-700'
                            }`}
                          >
                            {val || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
