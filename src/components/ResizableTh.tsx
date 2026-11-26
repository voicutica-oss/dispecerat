import { useRef, type ReactNode } from 'react';

interface ResizableThProps {
  colId: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  isResizing?: boolean;
  onStartResize: (
    colId: string,
    clientX: number,
    initialWidth: number,
    minWidth?: number,
    maxWidth?: number
  ) => void;
  className?: string;
  children: ReactNode;
  title?: string;
}

export function ResizableTh({
  colId,
  width,
  minWidth = 44,
  maxWidth = 640,
  isResizing = false,
  onStartResize,
  className = '',
  children,
  title,
}: ResizableThProps) {
  const thRef = useRef<HTMLTableCellElement | null>(null);

  return (
    <th ref={thRef} title={title} className={`group/th ${className}`}>
      <div className="pr-2 truncate">{children}</div>
      {isResizing && (
        <span className="pointer-events-none absolute right-1.5 top-1 z-50 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white shadow">
          {width}px
        </span>
      )}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionează coloana"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const measured = thRef.current?.getBoundingClientRect().width ?? width;
          onStartResize(colId, e.clientX, measured, minWidth, maxWidth);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 bottom-0 w-5 sm:w-3 flex items-center justify-end pr-0.5 cursor-col-resize touch-none select-none z-40"
      >
        <span
          className={`block rounded-full transition-colors ${
            isResizing
              ? 'w-[3px] h-full bg-blue-600'
              : 'w-[2px] h-4 bg-slate-300/90 group-hover/th:bg-blue-500'
          }`}
        />
      </div>
    </th>
  );
}
