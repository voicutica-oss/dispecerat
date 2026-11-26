import { saveBlobFile } from './fileDownload';
import { asciiRo } from './pdfExport';

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.map((h) => `"${asciiRo(String(h || '')).replace(/"/g, '""')}"`).join(';'),
    ...rows.map((row) =>
      row
        .map((cell) => `"${asciiRo(String(cell || '')).replace(/"/g, '""')}"`)
        .join(';')
    ),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveBlobFile(blob, `${filename}.csv`);
}
