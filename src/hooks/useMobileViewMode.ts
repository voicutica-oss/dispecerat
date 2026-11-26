import { useCallback, useState } from 'react';

export type MobileViewMode = 'cards' | 'table';

const PREFIX = 'dispecerat_mobile_view_v1_';

export function useMobileViewMode(
  viewKey: string,
  defaultMode: MobileViewMode = 'cards'
) {
  const [mode, setModeState] = useState<MobileViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode;
    try {
      const saved = localStorage.getItem(`${PREFIX}${viewKey}`);
      return saved === 'table' || saved === 'cards' ? saved : defaultMode;
    } catch {
      return defaultMode;
    }
  });

  const setMode = useCallback(
    (next: MobileViewMode) => {
      setModeState(next);
      try {
        localStorage.setItem(`${PREFIX}${viewKey}`, next);
      } catch {
        // ignore storage errors
      }
    },
    [viewKey]
  );

  return [mode, setMode] as const;
}
