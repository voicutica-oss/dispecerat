import { LayoutGrid, Table2 } from 'lucide-react';
import type { MobileViewMode } from '../hooks/useMobileViewMode';

interface MobileViewToggleProps {
  mode: MobileViewMode;
  onChange: (mode: MobileViewMode) => void;
}

export function MobileViewToggle({ mode, onChange }: MobileViewToggleProps) {
  return (
    <div
      className="md:hidden inline-flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0"
      role="group"
      aria-label="Mod afișare mobil"
    >
      <button
        type="button"
        onClick={() => onChange('cards')}
        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
          mode === 'cards'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <LayoutGrid className="h-3 w-3" />
        <span>Carduri</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
          mode === 'table'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <Table2 className="h-3 w-3" />
        <span>Tabel</span>
      </button>
    </div>
  );
}
