import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FreeTrailer } from '../types/fleet';
import { isFlotaSwapTag, plainRo } from '../utils/roDates';

interface FreeTrailersViewProps {
  freeTrailers: FreeTrailer[];
}

export function FreeTrailersView({ freeTrailers }: FreeTrailersViewProps) {
  const [search, setSearch] = useState('');

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
          <span className="font-mono font-medium text-slate-700 tabular-nums shrink-0">
            {filtered.length} din {freeTrailers.length}
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nu există remorci libere care să corespundă căutării.
          </div>
        ) : (
          <>
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

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Nr.</th>
                    <th className="py-2.5 px-4">Remorcă liberă</th>
                    <th className="py-2.5 px-4">Flotă (col. D)</th>
                    <th className="py-2.5 px-4">Nefolosită din</th>
                    <th className="py-2.5 px-4">Ultimul șofer</th>
                    <th className="py-2.5 px-4">Situație</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((item, idx) => {
                    const isSwap = isFlotaSwapTag(item.flotaNote);
                    return (
                      <tr key={item.remorca} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {item.remorca}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
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
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {item.nefolositaDin}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                          {item.ultimulSofer || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {item.motiv || 'Fără cursă activă'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
