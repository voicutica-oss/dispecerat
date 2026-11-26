import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  Container,
  FileCheck2,
  History,
  LayoutDashboard,
  Link2,
  Route,
  Truck,
  X,
} from 'lucide-react';
import type { NavTab } from '../types/fleet';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenConnection: () => void;
  mode: 'demo' | 'live';
  counts: {
    activeTrips: number;
    fleetCount: number;
    fleetTrucks: number;
    fleetTrailers: number;
    fleetOnlyCheckedBifa: boolean;
    freeTrailers: number;
    visaAlerts: number;
    activeLeaves: number;
    trailerHistoryCount: number;
    historyCount: number;
  };
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
  countKey?: keyof SidebarProps['counts'];
}[] = [
  { id: 'overview', label: 'Panou General', icon: LayoutDashboard },
  { id: 'curse', label: 'Curse', icon: Route, countKey: 'activeTrips' },
  { id: 'flota', label: 'Flotă & Remorci', icon: Truck, countKey: 'fleetCount' },
  { id: 'remorci_libere', label: 'Remorci Libere', icon: Container, countKey: 'freeTrailers' },
  { id: 'zile_curse', label: 'Zile Curse Luni', icon: BarChart3 },
  { id: 'vize', label: 'Vize Medicale', icon: FileCheck2, countKey: 'visaAlerts' },
  { id: 'concedii', label: 'Concedii', icon: CalendarDays, countKey: 'activeLeaves' },
  { id: 'istoric_remorci', label: 'Istoric Remorci', icon: ArrowLeftRight, countKey: 'trailerHistoryCount' },
  { id: 'istoric', label: 'Istoric Modificări', icon: History, countKey: 'historyCount' },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  onOpenConnection,
  mode,
  counts,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div>
        <div className="flex h-14 items-center justify-between px-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo-camion.png"
              alt="Sigla Dispecerat Transport"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-lg object-cover shrink-0 shadow-xs ring-1 ring-slate-200"
            />
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
              Dispecerat Transport
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
            aria-label="Închide meniul"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5" aria-label="Navigare principală">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isFleet = item.id === 'flota';
            const rawCount = item.countKey ? counts[item.countKey] : null;
            const count = typeof rawCount === 'number' ? rawCount : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                title={
                  isFleet
                    ? `${counts.fleetTrucks} capete · ${counts.fleetTrailers} remorci (${
                        counts.fleetOnlyCheckedBifa ? 'doar cu bifă col. K' : 'toată flota'
                      })`
                    : undefined
                }
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {isFleet ? (
                  <span
                    className={`font-mono text-xs tabular-nums shrink-0 ${
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {counts.fleetTrucks}/{counts.fleetTrailers}
                  </span>
                ) : (
                  count !== null &&
                  count > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums shrink-0 ${
                        isActive ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-slate-200 space-y-2">
        <PWAInstallButton />
        <button
          type="button"
          onClick={() => {
            onOpenConnection();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap"
        >
          <span className="flex items-center gap-2.5">
            <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Google Apps Script</span>
          </span>
          <span
            className={`text-xs font-medium ${
              mode === 'live' ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {mode === 'live' ? 'Live' : 'Demo'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[274px] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
