import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FreeTrailer, TripRecord, TripStatusType } from '../types/fleet';
import { saveBlobFile } from './fileDownload';
import { fmtRoDateTime, isSheetCheckboxTrue } from './roDates';

const STATUS_ASCII: Record<TripStatusType, string> = {
  active: 'Activa',
  done: 'Finalizata',
  yard: 'In curte',
  driver_wait: 'Asteapta sofer',
  swap: 'Schimb remorca',
  unknown: 'Fara descarcare',
};

export function asciiRo(s: string | undefined | null): string {
  return String(s || '')
    .replace(/ă/g, 'a')
    .replace(/Ă/g, 'A')
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/[șş]/g, 's')
    .replace(/[ȘŞ]/g, 'S')
    .replace(/[țţ]/g, 't')
    .replace(/[ȚŢ]/g, 'T')
    .replace(/[–—]/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function fileDateStamp(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function savePdfDoc(doc: jsPDF, filename: string) {
  try {
    const blob = doc.output('blob');
    saveBlobFile(blob, filename);
  } catch {
    doc.save(filename);
  }
}

function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Pagina ${i} / ${totalPages}`,
      pageWidth - 12,
      pageHeight - 7,
      { align: 'right' }
    );
  }
}

export function exportTripsPdf(
  trips: TripRecord[],
  resolvedCellsMap: Map<number, string[]>,
  filterSummary: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const generatedAt = fmtRoDateTime(new Date());
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Raport Curse - Dispecerat Flota', 12, 13);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    asciiRo(
      `Generat la: ${generatedAt}  |  Curse afisate: ${trips.length}${
        filterSummary ? `  |  ${filterSummary}` : ''
      }`
    ),
    12,
    19
  );

  const head = [
    [
      '#',
      'Nr camion / remorca',
      'Data inc.',
      'Data desc.',
      'Tara',
      'Localitatea',
      'Detalii',
      'Observatii',
      'Nume sofer',
      'Telefon',
      'Tip auto',
      'Stare',
    ],
  ];

  const body = trips.map((t, idx) => {
    const c = resolvedCellsMap.get(t.rowIndex) || t.cells;
    return [
      String(idx + 1),
      asciiRo(c[1] || '-'),
      asciiRo(c[15] || '-'),
      asciiRo(c[2] || '-'),
      asciiRo(c[3] || '-'),
      asciiRo(c[4] || '-'),
      asciiRo(c[5] || '-'),
      asciiRo(c[6] || '-'),
      asciiRo(c[7] || '-'),
      asciiRo(c[8] || '-'),
      asciiRo(c[10] || '-'),
      STATUS_ASCII[t.statusType] || '-',
    ];
  });

  autoTable(doc, {
    startY: 23,
    head,
    body,
    margin: { top: 14, right: 10, bottom: 12, left: 10 },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'right' },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 18 },
      4: { cellWidth: 11, halign: 'center' },
      5: { cellWidth: 30 },
      6: { cellWidth: 30 },
      7: { cellWidth: 36 },
      8: { cellWidth: 32 },
      9: { cellWidth: 23 },
      10: { cellWidth: 22 },
      11: { cellWidth: 21 },
    },
  });

  addPageNumbers(doc);
  savePdfDoc(doc, `raport-curse-${fileDateStamp()}.pdf`);
}

export function exportHistoryPdf(rows: string[][], filterSummary: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const generatedAt = fmtRoDateTime(new Date());
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Raport Istoric Modificari - Dispecerat Flota', 12, 13);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    asciiRo(
      `Generat la: ${generatedAt}  |  Inregistrari afisate: ${rows.length}${
        filterSummary ? `  |  ${filterSummary}` : ''
      }`
    ),
    12,
    19
  );

  const head = [
    ['Data si ora', 'Utilizator', 'Tab', 'Rand', 'Actiune', 'Inainte', 'Dupa'],
  ];

  const body = rows.map((r) => [
    asciiRo(r[0] || '-'),
    asciiRo(r[1] || '-'),
    asciiRo(r[2] || '-'),
    asciiRo(r[3] || '-'),
    asciiRo(r[4] || '-'),
    asciiRo(r[5] || '-'),
    asciiRo(r[6] || '-'),
  ]);

  autoTable(doc, {
    startY: 23,
    head,
    body,
    margin: { top: 14, right: 10, bottom: 12, left: 10 },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 13, halign: 'right' },
      4: { cellWidth: 22 },
      5: { cellWidth: 82 },
      6: { cellWidth: 82 },
    },
  });

  addPageNumbers(doc);
  savePdfDoc(doc, `raport-istoric-${fileDateStamp()}.pdf`);
}

export function exportTrailerHistoryPdf(rows: string[][], filterSummary: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const generatedAt = fmtRoDateTime(new Date());
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Raport Istoric Remorci - Dispecerat Flota', 10, 13);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    asciiRo(
      `Generat la: ${generatedAt}  |  Inregistrari afisate: ${rows.length}${
        filterSummary ? `  |  ${filterSummary}` : ''
      }`
    ),
    10,
    19
  );

  const head = [
    [
      '#',
      'Camion',
      'Rem. predata',
      'Rem. preluata',
      'Data prel. ant.',
      'Predare (Loc / Data)',
      'Desc. predata',
      'Sofer preda',
      'Preia (Cap / Sofer)',
      'Data preluarii',
      'Dest. preluata',
    ],
  ];

  const body = rows.map((r, idx) => {
    const predLocData = [r[5], r[6]].filter(Boolean).join(' / ');
    const descPred = [r[7], r[8], r[9]].filter(Boolean).join(' / ');
    const capSoferPreia = [r[11], r[12]].filter(Boolean).join('\n');
    const destPreluata = [r[14], r[15], r[16]].filter(Boolean).join(' / ');
    return [
      asciiRo(r[0] || String(idx + 1)),
      asciiRo(r[1] || '-'),
      asciiRo(r[2] || '-'),
      asciiRo(r[3] || '-'),
      asciiRo(r[4] || '-'),
      asciiRo(predLocData || '-'),
      asciiRo(descPred || '-'),
      asciiRo(r[10] || '-'),
      asciiRo(capSoferPreia || '-'),
      asciiRo(r[13] || '-'),
      asciiRo(destPreluata || '-'),
    ];
  });

  autoTable(doc, {
    startY: 23,
    head,
    body,
    margin: { top: 14, right: 7, bottom: 12, left: 7 },
    styles: {
      fontSize: 7,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'right' },
      1: { cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 20 },
      5: { cellWidth: 32 },
      6: { cellWidth: 34 },
      7: { cellWidth: 28 },
      8: { cellWidth: 34 },
      9: { cellWidth: 20 },
      10: { cellWidth: 41 },
    },
  });

  addPageNumbers(doc);
  savePdfDoc(doc, `raport-istoric-remorci-${fileDateStamp()}.pdf`);
}

export function exportFleetPdf(
  rows: { cells: string[]; status: string }[],
  headers: string[],
  filterSummary: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const generatedAt = fmtRoDateTime(new Date());
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Raport Flota & Vehicule - Dispecerat Flota', 10, 13);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    asciiRo(
      `Generat la: ${generatedAt}  |  Randuri afisate: ${rows.length}${
        filterSummary ? `  |  ${filterSummary}` : ''
      }`
    ),
    10,
    19
  );

  const head = [
    [
      '#',
      asciiRo(headers[0] || 'Nr camion'),
      asciiRo(headers[1] || 'Nr remorca'),
      asciiRo(headers[2] || 'Nume sofer'),
      asciiRo(headers[3] || 'Tip'),
      asciiRo(headers[4] || 'Telefon'),
      asciiRo(headers[5] || 'Tel. rezerva'),
      asciiRo(headers[6] || 'An fab.'),
      asciiRo(headers[7] || 'Tip auto'),
      'ADR',
      'Situatie cursa',
    ],
  ];

  const body = rows.map((r, idx) => [
    String(idx + 1),
    asciiRo(r.cells[0] || '-'),
    asciiRo(r.cells[1] || '-'),
    asciiRo(r.cells[2] || '-'),
    asciiRo(r.cells[3] || '-'),
    asciiRo(r.cells[4] || '-'),
    asciiRo(r.cells[5] || '-'),
    asciiRo(r.cells[6] || '-'),
    asciiRo(r.cells[7] || '-'),
    isSheetCheckboxTrue(r.cells[11]) ? 'DA' : '-',
    asciiRo(r.status || '-'),
  ]);

  autoTable(doc, {
    startY: 23,
    head,
    body,
    margin: { top: 14, right: 8, bottom: 12, left: 8 },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.7,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'right' },
      1: { cellWidth: 23, fontStyle: 'bold' },
      2: { cellWidth: 23 },
      3: { cellWidth: 42 },
      4: { cellWidth: 20 },
      5: { cellWidth: 26 },
      6: { cellWidth: 26 },
      7: { cellWidth: 15, halign: 'center' },
      8: { cellWidth: 30 },
      9: { cellWidth: 11, halign: 'center' },
      10: { cellWidth: 57 },
    },
  });

  addPageNumbers(doc);
  savePdfDoc(doc, `raport-flota-${fileDateStamp()}.pdf`);
}

export function exportFreeTrailersPdf(
  items: FreeTrailer[],
  filterSummary: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const generatedAt = fmtRoDateTime(new Date());
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Raport Remorci Libere - Dispecerat Flota', 12, 13);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    asciiRo(
      `Generat la: ${generatedAt}  |  Remorci libere: ${items.length}${
        filterSummary ? `  |  ${filterSummary}` : ''
      }`
    ),
    12,
    19
  );

  const head = [
    ['Nr.', 'Remorca libera', 'Nefolosita din', 'Ultimul sofer', 'Situatie'],
  ];

  const body = items.map((f, idx) => [
    String(idx + 1),
    asciiRo(f.remorca || '-'),
    asciiRo(f.nefolositaDin || '-'),
    asciiRo(f.ultimulSofer || '-'),
    asciiRo(f.motiv || 'Fara cursa activa'),
  ]);

  autoTable(doc, {
    startY: 23,
    head,
    body,
    margin: { top: 14, right: 12, bottom: 12, left: 12 },
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'right' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 55 },
      4: { cellWidth: 55 },
    },
  });

  addPageNumbers(doc);
  savePdfDoc(doc, `raport-remorci-libere-${fileDateStamp()}.pdf`);
}
