import { Menu, Plus, RefreshCw } from 'lucide-react';
import type { NavTab } from '../types/fleet';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: NavTab;
  mode: 'demo' | 'live';
  userName: string;
  lastSyncedAt: string | null;
  syncing: boolean;
  pendingSaves?: number;
  onSync: () => void;
  onAddTrip?: () => void;
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Panou General',
  curse: 'Curse (Sheet 1)',
  flota: 'Flotă & Remorci',
  remorci_libere: 'Remorci Libere',
  zile_curse: 'Zile Curse pe Luni',
  vize: 'Vize Medicale',
  concedii: 'Concedii Șoferi',
  istoric_remorci: 'Istoric Remorci',
  istoric: 'Istoric Modificări',
};

export function TopBar({
  activeTab,
  mode,
  userName,
  lastSyncedAt,
  syncing,
  pendingSaves = 0,
  onSync,
  onAddTrip,
  onOpenMobileMenu,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 min-h-14 pt-[env(safe-area-inset-top)] bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 py-2">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label="Deschide meniul"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <img
            src="/logo-camion.png"
            alt="Sigla Dispecerat"
            referrerPolicy="no-referrer"
            className="lg:hidden h-7 w-7 rounded-md object-cover shrink-0 ring-1 ring-slate-200"
          />
          <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
            Dispecerat
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0 py-2">
        <div className="hidden xl:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
          <span className={mode === 'live' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
            {mode === 'live' ? 'Google Sheets Live' : 'Mod Demo Local'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Dispecer: {userName || 'Dispecer'}</span>
          {pendingSaves > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-blue-700 tabular-nums">
                Se salvează în Sheets ({pendingSaves})...
              </span>
            </>
          ) : (
            lastSyncedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Sincronizat {lastSyncedAt}</span>
              </>
            )
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            aria-label="Sincronizează"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizează</span>
          </button>
          {onAddTrip && <button
            type="button"
            onClick={onAddTrip}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Adaugă cursă</span>
            <span className="sm:hidden">Cursă</span>
          </button>}
        </div>
      </div>
    </header>
  );
}
