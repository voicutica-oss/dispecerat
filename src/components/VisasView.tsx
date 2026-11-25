import { Edit3, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { VisaRecord } from '../types/fleet';
import { plainRo } from '../utils/roDates';

interface VisasViewProps {
  headers: string[];
  visas: VisaRecord[];
  onAddVisa: () => void;
  onEditVisa: (visa: VisaRecord) => void;
}

export function VisasView({
  headers,
  visas,
  onAddVisa,
  onEditVisa,
}: VisasViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'expired' | 'expiring' | 'valid'>('all');

  const colHeaders = useMemo(() => {
    const defaults = ['Nr.', 'Nume șofer', 'Document', 'Data expirare'];
    return defaults.map((d, i) => (headers[i] && headers[i].trim() ? headers[i] : d));
  }, [headers]);

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

        <button
          type="button"
          onClick={onAddVisa}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap self-start lg:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Adaugă viză</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Nu există vize medicale care să corespundă criteriilor selectate.
          </div>
        ) : (
          <>
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

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">{colHeaders[0]}</th>
                    <th className="py-2.5 px-4">{colHeaders[1]}</th>
                    <th className="py-2.5 px-4">{colHeaders[2]}</th>
                    <th className="py-2.5 px-4">{colHeaders[3]}</th>
                    <th className="py-2.5 px-4">Valabilitate</th>
                    <th className="py-2.5 px-4 text-right">Acțiune</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((visa) => (
                    <tr
                      key={visa.rowIndex}
                      onClick={() => onEditVisa(visa)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        {visa.cells[0] || visa.rowIndex}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {visa.cells[1] || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {visa.cells[2] || '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                        {visa.cells[3] || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-medium whitespace-nowrap tabular-nums">
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
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
