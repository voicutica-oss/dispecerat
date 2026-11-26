import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { exportToCsv } from '../utils/excelExport';
import { asciiRo } from '../utils/pdfExport';
import { SyncedScrollTable } from './SyncedScrollTable';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ZileCurseViewProps {
  zileCurse: string[][];
}

export function ZileCurseView({ zileCurse }: ZileCurseViewProps) {
  const [search, setSearch] = useState('');

  const headers = useMemo(() => {
    if (!zileCurse || zileCurse.length === 0) {
      return ['Nr camion', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec', 'TOTAL AN'];
    }
    return (zileCurse[0] || []).map((h, i) => String(h || '').trim() || `Col ${i + 1}`);
  }, [zileCurse]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: string[][] = [];
    for (let i = 1; i < (zileCurse?.length || 0); i++) {
      const r = zileCurse[i] || [];
      const cam = String(r[0] || '').trim();
      if (!cam) continue;
      if (q && !cam.toLowerCase().includes(q)) continue;
      out.push(r);
    }
    return out;
  }, [zileCurse, search]);

  const handleExportExcel = () => {
    exportToCsv('zile-curse-camioane-luni', headers, rows);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Zile Curse Camioane pe Luni - Dispecerat Flota', 12, 13);

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

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zile-curse-camioane-luni.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] sm:w-80">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după număr camion..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 font-mono"
            />
          </div>
          <div className="text-xs text-slate-500">
            Total camioane: {rows.length}
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

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Nicio înregistrare în foaia „zile curse camion”. Asigură-te că scriptul Google Apps Script este actualizat și a rulat calculul.
          </div>
        ) : (
          <SyncedScrollTable>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className={`sticky top-0 bg-slate-50 border-b border-slate-200 py-2.5 px-3.5 whitespace-nowrap ${
                        i === 0
                          ? 'left-0 z-30 border-r border-slate-200 w-20 sm:w-28'
                          : 'z-20 text-center'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.map((r, rIdx) => (
                  <tr key={rIdx} className="group hover:bg-slate-50">
                    {r.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`${
                          cIdx === 0
                            ? 'sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap w-20 sm:w-28 px-3.5 py-2.5'
                            : 'font-mono text-xs text-slate-700 text-center px-3.5 py-2.5 tabular-nums whitespace-nowrap'
                        }`}
                      >
                        {cell || '—'}
                      </td>
                    ))}
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
