import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface TableColSpec {
  id: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: boolean;
}

const STORAGE_PREFIX = 'dispecerat_col_widths_v1_';

function loadSavedWidths(tableKey: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 20) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function useResizableColumns(
  tableKey: string,
  columns: TableColSpec[]
) {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    loadSavedWidths(tableKey)
  );
  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    setWidths(loadSavedWidths(tableKey));
  }, [tableKey]);

  const persistWidths = useCallback(
    (next: Record<string, number>) => {
      try {
        if (Object.keys(next).length === 0) {
          localStorage.removeItem(`${STORAGE_PREFIX}${tableKey}`);
        } else {
          localStorage.setItem(`${STORAGE_PREFIX}${tableKey}`, JSON.stringify(next));
        }
      } catch {
        // ignore storage quota errors
      }
    },
    [tableKey]
  );

  const getColWidth = useCallback(
    (col: TableColSpec): number => {
      const minW = col.minWidth ?? 44;
      const maxW = col.maxWidth ?? 640;
      const saved = widths[col.id];
      const base = typeof saved === 'number' ? saved : col.defaultWidth;
      return Math.max(minW, Math.min(maxW, Math.round(base)));
    },
    [widths]
  );

  const totalMinWidth = useMemo(
    () => columns.reduce((sum, col) => sum + getColWidth(col), 0),
    [columns, getColWidth]
  );

  const hasCustomWidths = useMemo(
    () => Object.keys(widths).length > 0,
    [widths]
  );

  const resetWidths = useCallback(() => {
    setWidths({});
    persistWidths({});
  }, [persistWidths]);

  const startResize = useCallback(
    (
      colId: string,
      startClientX: number,
      initialElementWidth: number,
      minWidth = 44,
      maxWidth = 640
    ) => {
      setResizingColId(colId);
      const baseW = Math.max(minWidth, Math.min(maxWidth, Math.round(initialElementWidth)));

      const handleMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startClientX;
        const nextW = Math.max(minWidth, Math.min(maxWidth, Math.round(baseW + delta)));
        setWidths((prev) => {
          if (prev[colId] === nextW) return prev;
          const next = { ...prev, [colId]: nextW };
          widthsRef.current = next;
          return next;
        });
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        setResizingColId(null);
        persistWidths(widthsRef.current);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [persistWidths]
  );

  return {
    widths,
    resizingColId,
    getColWidth,
    totalMinWidth,
    hasCustomWidths,
    resetWidths,
    startResize,
  };
}
