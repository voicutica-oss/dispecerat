import { Calendar, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useResizableColumns,
  type TableColSpec,
} from '../hooks/useResizableColumns';
import type { TripRecord } from '../types/fleet';
import { exportToCsv } from '../utils/excelExport';
import { asciiRo, savePdfDoc } from '../utils/pdfExport';
import { computeTruckWorkedDays, todayRo } from '../utils/roDates';
import { ResizableTh } from './ResizableTh';
import { SyncedScrollTable } from './SyncedScrollTable';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ZileCurseViewProps {
  zileCurse: string[][];
  trips: TripRecord[];
  flota: string[][];
}

const DEFAULT_HEADERS = [
  'Nr camion',
  'Ian',
  'Feb',
  'Mar',
  'Apr',
  'Mai',
  'Iun',
  'Iul',
  'Aug',
  'Sep',
  'Oct',
  'Noi',
  'Dec',
  'TOTAL AN',
];

export function ZileCurseView({ zileCurse, trips, flota }: ZileCurseViewProps) {
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    todayRo().getFullYear()
  );

  const computed = useMemo(
    () => computeTruckWorkedDays(trips, flota, selectedYear),
    [trips, flota, selectedYear]
  );

  const useLiveCalculation = trips.length > 0;

  const headers = useMemo(() => {
    if (useLiveCalculation) return DEFAULT_HEADERS;
    if (!zileCurse || zileCurse.length === 0) return DEFAULT_HEADERS;
    return (zileCurse[0] || []).map(
      (h, i) => String(h || '').trim() || `Col ${i + 1}`
    );
  }, [useLiveCalculation, zileCurse]);

  const cols = useMemo<TableColSpec[]>(
    () =>
      headers.map((h, i) =>
        i === 0
          ? { id: 'camion', defaultWidth: 114, minWidth: 88, maxWidth: 240 }
          : i === headers.length - 1 || h.toUpperCase().includes('TOTAL')
            ? { id: `col-${i}`, defaultWidth: 92, minWidth: 64, maxWidth: 160 }
            : { id: `col-${i}`, defaultWidth: 66, minWidth: 46, maxWidth: 140 }
      ),
    [headers]
  );

  const {
    resizingColId,
    getColWidth,
    totalMinWidth,
    hasCustomWidths,
    resetWidths,
    startResize,
  } = useResizableColumns('zile_curse', cols);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sourceRows = useLiveCalculation
      ? computed.rows
      : (zileCurse || []).slice(1);
    const out: string[][] = [];
    for (const r of sourceRows) {
      const cam = String(r?.[0] || '').trim();
      if (!cam) continue;
      if (q && !cam.toLowerCase().includes(q)) continue;
      out.push(r);
    }
    return out;
  }, [useLiveCalculation, computed.rows, zileCurse, search]);

  const totalWorkedDays = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const val = parseInt(String(r[headers.length - 1] || '0'), 10);
        return sum + (Number.isNaN(val) ? 0 : val);
      }, 0),
    [rows, headers.length]
  );

  const handleExportExcel = () => {
    exportToCsv(`zile-curse-camioane-${selectedYear}`, headers, rows);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Zile Curse Camioane pe Luni (${selectedYear}) - Dispecerat Flota`,
      12,
      13
    );

    const head = [headers.map((h) => asciiRo(h))];
    const body = rows.map((r) => r.map((c) => asciiRo(c)));

    autoTable(doc, {
      startY: 18,
      head,
      body,
      margin: { top: 12, right: 10, bottom: 12, left: 10 },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [29, 78, 216],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    savePdfDoc(doc, `zile-curse-camioane-${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după număr camion..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 font-mono"
            />
          </div>

          {useLiveCalculation && computed.availableYears.length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Selectează anul"
                className="bg-transparent font-mono font-semibold text-slate-800 focus:outline-none"
              >
                {computed.availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs text-slate-500 tabular-nums">
            {rows.length} camioane ·{' '}
            <span className="font-semibold text-slate-800">
              {totalWorkedDays} zile lucrate
            </span>{' '}
            în {selectedYear}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-blue-50/70 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-950">
        Calcul automat din <strong>Data încărcării (col. P)</strong> până la{' '}
        <strong>Data descărcării (col. C)</strong> în zile calendaristice unice pe camion (fără dublare dacă un camion descarcă și încarcă în aceeași zi). Cursele fără dată de încărcare se numără ca 1 zi la descărcare.
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Nicio înregistrare găsită pentru calculul zilelor pe camioane.
          </div>
        ) : (
          <SyncedScrollTable
            hasCustomWidths={hasCustomWidths}
            onResetWidths={resetWidths}
          >
            <table
              style={{ width: `${totalMinWidth}px`, minWidth: '100%' }}
              className="table-fixed text-left border-collapse"
            >
              <colgroup>
                {cols.map((col) => (
                  <col key={col.id} style={{ width: `${getColWidth(col)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  {cols.map((col, i) => (
                    <ResizableTh
                      key={col.id}
                      colId={col.id}
                      width={getColWidth(col)}
                      minWidth={col.minWidth}
                      maxWidth={col.maxWidth}
                      isResizing={resizingColId === col.id}
                      onStartResize={startResize}
                      title={headers[i]}
                      className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3 ${
                        i === 0
                          ? 'left-0 z-30 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]'
                          : 'z-20 text-center'
                      }`}
                    >
                      {headers[i]}
                    </ResizableTh>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.map((r, rIdx) => (
                  <tr key={rIdx} className="group hover:bg-slate-50">
                    {headers.map((_, cIdx) => {
                      const val = r[cIdx];
                      const isTotal = cIdx === headers.length - 1;
                      const numVal = Number(val || 0);
                      return (
                        <td
                          key={cIdx}
                          className={`${
                            cIdx === 0
                              ? 'sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.06)] font-mono text-xs font-semibold text-slate-900 whitespace-nowrap truncate px-3 py-2.5'
                              : `font-mono text-xs text-center px-2.5 py-2.5 tabular-nums whitespace-nowrap truncate ${
                                  isTotal
                                    ? 'font-semibold text-blue-800 bg-blue-50/40'
                                    : numVal > 0
                                      ? 'text-slate-900 font-medium'
                                      : 'text-slate-300'
                                }`
                          }`}
                        >
                          {cIdx === 0
                            ? val || '—'
                            : numVal > 0
                              ? val
                              : '0'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </SyncedScrollTable>
        )}
      </div>
    </div>
  );
}
