import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface SyncedScrollTableProps {
  children: ReactNode;
  className?: string;
  maxHeightClass?: string;
}

export function SyncedScrollTable({
  children,
  className = '',
  maxHeightClass = 'max-h-[calc(100dvh-250px)] min-h-[220px]',
}: SyncedScrollTableProps) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const syncingFromRef = useRef<'top' | 'body' | null>(null);

  const [metrics, setMetrics] = useState({
    scrollWidth: 0,
    clientWidth: 0,
  });

  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const sw = body.scrollWidth;
    const cw = body.clientWidth;
    setMetrics((prev) =>
      prev.scrollWidth === sw && prev.clientWidth === cw
        ? prev
        : { scrollWidth: sw, clientWidth: cw }
    );
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    measure();
    const rafId = requestAnimationFrame(measure);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null;

    if (resizeObserver) {
      resizeObserver.observe(body);
      if (body.firstElementChild) {
        resizeObserver.observe(body.firstElementChild);
      }
    }

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            requestAnimationFrame(measure);
          })
        : null;

    if (mutationObserver) {
      mutationObserver.observe(body, {
        childList: true,
        subtree: true,
        attributes: false,
      });
    }

    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const handleTopScroll = () => {
    if (syncingFromRef.current === 'body') return;
    const top = topRef.current;
    const body = bodyRef.current;
    if (!top || !body) return;
    syncingFromRef.current = 'top';
    body.scrollLeft = top.scrollLeft;
    requestAnimationFrame(() => {
      if (syncingFromRef.current === 'top') syncingFromRef.current = null;
    });
  };

  const handleBodyScroll = () => {
    if (syncingFromRef.current === 'top') return;
    const top = topRef.current;
    const body = bodyRef.current;
    if (!top || !body) return;
    syncingFromRef.current = 'body';
    top.scrollLeft = body.scrollLeft;
    requestAnimationFrame(() => {
      if (syncingFromRef.current === 'body') syncingFromRef.current = null;
    });
  };

  const hasHorizontalOverflow = metrics.scrollWidth > metrics.clientWidth + 1;

  useEffect(() => {
    if (hasHorizontalOverflow && topRef.current && bodyRef.current) {
      topRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  }, [hasHorizontalOverflow]);

  return (
    <div className={className}>
      {hasHorizontalOverflow && (
        <div
          ref={topRef}
          onScroll={handleTopScroll}
          aria-label="Derulare orizontală sus"
          className="always-scrollbar overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50/90"
        >
          <div
            style={{ width: `${metrics.scrollWidth}px`, height: '1px' }}
            aria-hidden="true"
          />
        </div>
      )}

      <div
        ref={bodyRef}
        onScroll={handleBodyScroll}
        className={`always-scrollbar overflow-auto ${maxHeightClass}`}
      >
        {children}
      </div>
    </div>
  );
}
