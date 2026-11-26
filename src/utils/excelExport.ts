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
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
