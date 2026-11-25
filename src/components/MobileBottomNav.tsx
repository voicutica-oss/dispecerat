import {
  CalendarDays,
  FileCheck2,
  LayoutDashboard,
  Route,
  Truck,
} from 'lucide-react';
import type { NavTab } from '../types/fleet';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const MOBILE_TABS: {
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'overview', label: 'Panou', icon: LayoutDashboard },
  { id: 'curse', label: 'Curse', icon: Route },
  { id: 'flota', label: 'Flotă', icon: Truck },
  { id: 'vize', label: 'Vize', icon: FileCheck2 },
  { id: 'concedii', label: 'Concedii', icon: CalendarDays },
];

export function MobileBottomNav({
  activeTab,
  onSelectTab,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Navigare mobilă"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] gap-0.5 transition-colors ${
                active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-[11px] font-medium leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
