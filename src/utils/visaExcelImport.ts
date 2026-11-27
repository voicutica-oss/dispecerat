import * as XLSX from 'xlsx';
import { fmtRoDate, parseRoDate, plainRo } from './roDates';

export interface ImportedVisaRow {
  id: string;
  nume: string;
  doc: string;
  dataExp: string;
}

function isHeaderKeyword(cell: string): boolean {
  const p = plainRo(cell);
  return (
    p === 'nr' ||
    p === 'nr.' ||
    p === 'nr crt' ||
    p === 'crt' ||
    p === 'nume' ||
    p === 'nume sofer' ||
    p === 'sofer' ||
    p === 'document' ||
    p === 'doc' ||
    p === 'data' ||
    p === 'data expirare' ||
    p === 'data expirarii' ||
    p === 'expira' ||
    p === 'expirare'
  );
}

function isRowNumberCell(cell: string): boolean {
  return /^\d+[.)]?$/.test(cell.trim());
}

function formatExcelCellValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return fmtRoDate(
      new Date(raw.getFullYear(), raw.getMonth(), raw.getDate())
    );
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Possible Excel serial date (typically > 20000 and < 80000 for 1954..2119)
    if (raw > 20000 && raw < 80000) {
      const parsed = XLSX.SSF.parse_date_code(raw);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return fmtRoDate(new Date(parsed.y, parsed.m - 1, parsed.d));
      }
    }
    return String(raw);
  }
  const str = String(raw).replace(/\r?\n/g, ' ').trim();
  if (!str) return '';
  const parsedDate = parseRoDate(str);
  if (parsedDate) {
    return fmtRoDate(parsedDate);
  }
  return str;
}

export function parseVisaMatrixRows(grid: unknown[][]): ImportedVisaRow[] {
  const rows: string[][] = (grid || [])
    .map((r) => (Array.isArray(r) ? r.map(formatExcelCellValue) : []))
    .filter((r) => r.some((c) => c !== ''));

  if (rows.length === 0) return [];

  let headerIdx = -1;
  let nrCol = -1;
  let nameCol = -1;
  let docCol = -1;
  let dateCol = -1;

  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const r = rows[i];
    let nIdx = -1;
    let dIdx = -1;
    let dtIdx = -1;
    let cNr = -1;

    r.forEach((cell, idx) => {
      const p = plainRo(cell);
      if (!p) return;
      if (cNr === -1 && (p === 'nr' || p === 'nr.' || p === 'nr crt' || p === 'crt')) {
        cNr = idx;
      } else if (
        nIdx === -1 &&
        (p.includes('nume') || p.includes('sofer') || p.includes('angajat'))
      ) {
        nIdx = idx;
      } else if (
        dIdx === -1 &&
        (p.includes('doc') ||
          p.includes('tip') ||
          p.includes('viza') ||
          p.includes('aviz') ||
          p.includes('atestat') ||
          p.includes('fisa') ||
          p.includes('certif') ||
          p.includes('analiz'))
      ) {
        dIdx = idx;
      } else if (
        dtIdx === -1 &&
        (p.includes('expir') || p.includes('data') || p.includes('valab'))
      ) {
        dtIdx = idx;
      }
    });

    const hits = [nIdx, dIdx, dtIdx].filter((x) => x >= 0).length;
    if (hits >= 2) {
      headerIdx = i;
      nrCol = cNr;
      nameCol = nIdx;
      docCol = dIdx;
      dateCol = dtIdx;
      break;
    }

    // Matrix layout: Nume | Aviz medical | Psihologic | ADR ...
    if (nIdx >= 0 && dIdx === -1 && dtIdx === -1) {
      const nextSample = rows.slice(i + 1, i + 10);
      const hasMultiDateRow = nextSample.some(
        (sr) => sr.filter((c) => Boolean(parseRoDate(c))).length >= 2
      );
      if (hasMultiDateRow) {
        const out: ImportedVisaRow[] = [];
        let lastDriver = '';
        for (let rIdx = i + 1; rIdx < rows.length; rIdx++) {
          const mRow = rows[rIdx];
          const rawN = String(mRow[nIdx] || '').trim();
          if (rawN && !isRowNumberCell(rawN) && !isHeaderKeyword(rawN)) {
            lastDriver = rawN;
          }
          const effName =
            rawN && !isRowNumberCell(rawN) && !isHeaderKeyword(rawN)
              ? rawN
              : lastDriver;
          if (!effName) continue;
          for (let c = 0; c < mRow.length; c++) {
            if (c === nIdx || c === cNr) continue;
            const dateVal = String(mRow[c] || '').trim();
            const parsed = parseRoDate(dateVal);
            if (!parsed) continue;
            const docLabel = String(r[c] || '').trim() || `Document ${c + 1}`;
            out.push({
              id: `imp-${rIdx}-${c}`,
              nume: effName,
              doc: docLabel,
              dataExp: fmtRoDate(parsed),
            });
          }
        }
        return out;
      }
    }
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
  const sample = rows.slice(startRow, startRow + 15);

  if (nameCol === -1 || docCol === -1 || dateCol === -1) {
    const hasCol3Dates = sample.some((r) => Boolean(parseRoDate(r[3])));
    const hasCol2Dates = sample.some((r) => Boolean(parseRoDate(r[2])));
    const hasCol1Dates = sample.some((r) => Boolean(parseRoDate(r[1])));

    if (hasCol3Dates) {
      if (nrCol === -1) nrCol = 0;
      if (nameCol === -1) nameCol = 1;
      if (docCol === -1) docCol = 2;
      if (dateCol === -1) dateCol = 3;
    } else if (hasCol2Dates) {
      if (nameCol === -1) nameCol = 0;
      if (docCol === -1) docCol = 1;
      if (dateCol === -1) dateCol = 2;
    } else if (hasCol1Dates) {
      if (docCol === -1) docCol = 0;
      if (dateCol === -1) dateCol = 1;
      if (nameCol === -1) nameCol = 2;
    } else {
      const firstIsNr =
        sample.length > 0 && sample.every((r) => !r[0] || isRowNumberCell(r[0]));
      if (firstIsNr) {
        nrCol = 0;
        if (nameCol === -1) nameCol = 1;
        if (docCol === -1) docCol = 2;
        if (dateCol === -1) dateCol = 3;
      } else {
        if (nameCol === -1) nameCol = 0;
        if (docCol === -1) docCol = 1;
        if (dateCol === -1) dateCol = 2;
      }
    }
  }

  const result: ImportedVisaRow[] = [];
  let lastName = '';

  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    const rawName = nameCol >= 0 ? String(r[nameCol] || '').trim() : '';
    let rawDoc = docCol >= 0 ? String(r[docCol] || '').trim() : '';
    let rawDate = dateCol >= 0 ? String(r[dateCol] || '').trim() : '';

    if (isHeaderKeyword(rawName) || isHeaderKeyword(rawDoc) || isHeaderKeyword(rawDate)) {
      continue;
    }

    let candidateName =
      rawName && !isRowNumberCell(rawName) && !parseRoDate(rawName)
        ? rawName
        : '';

    if (!candidateName) {
      for (let c = 0; c < r.length; c++) {
        if (c === docCol || c === dateCol || c === nrCol) continue;
        const val = String(r[c] || '').trim();
        if (val && !isRowNumberCell(val) && !isHeaderKeyword(val) && !parseRoDate(val)) {
          candidateName = val;
          break;
        }
      }
    }

    if (candidateName) lastName = candidateName;

    let parsedDate = parseRoDate(rawDate);
    if (!parsedDate && rawDoc) {
      const maybeDate = parseRoDate(rawDoc);
      if (maybeDate) {
        parsedDate = maybeDate;
        rawDate = fmtRoDate(maybeDate);
        rawDoc = '';
      }
    }
    if (!parsedDate) {
      for (let c = 0; c < r.length; c++) {
        if (c === nameCol || c === nrCol) continue;
        const val = String(r[c] || '').trim();
        const d = parseRoDate(val);
        if (d) {
          parsedDate = d;
          rawDate = fmtRoDate(d);
          break;
        }
      }
    } else {
      rawDate = fmtRoDate(parsedDate);
    }

    if (!rawDoc && !rawDate) continue;

    result.push({
      id: `imp-${i}-${result.length}`,
      nume: candidateName || lastName,
      doc: rawDoc,
      dataExp: rawDate,
    });
  }

  return result;
}

export async function parseVisaExcelFile(file: File): Promise<ImportedVisaRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: '',
    });
    const parsed = parseVisaMatrixRows(grid);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

export function parseVisaPastedText(text: string): ImportedVisaRow[] {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const grid = lines.map((line) => {
    if (line.includes('\t')) {
      return line.split('\t').map((c) => c.trim());
    }
    if (line.includes(';')) {
      return line.split(';').map((c) => c.trim());
    }
    if (line.includes('|')) {
      return line.split('|').map((c) => c.trim());
    }
    return line.split(',').map((c) => c.trim());
  });

  return parseVisaMatrixRows(grid);
}
