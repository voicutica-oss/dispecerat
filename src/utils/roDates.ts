import type {
  FreeTrailer,
  LeaveRecord,
  LeaveType,
  TripRecord,
  TripStatusType,
  VisaRecord,
} from '../types/fleet';

export const LEAVE_TYPES: LeaveType[] = ['CO', 'CM', 'L', 'CFP'];

export const LEAVE_TYPE_META: Record<
  LeaveType,
  {
    code: LeaveType;
    label: string;
    badgeClass: string;
    timelineClass: string;
    borderClass: string;
  }
> = {
  CO: {
    code: 'CO',
    label: 'Concediu Odihnă',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    timelineClass: 'bg-blue-600 text-white',
    borderClass: 'border-blue-200 bg-blue-50/40',
  },
  CM: {
    code: 'CM',
    label: 'Concediu Medical',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    timelineClass: 'bg-rose-600 text-white',
    borderClass: 'border-rose-200 bg-rose-50/40',
  },
  L: {
    code: 'L',
    label: 'Liber',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    timelineClass: 'bg-emerald-600 text-white',
    borderClass: 'border-emerald-200 bg-emerald-50/40',
  },
  CFP: {
    code: 'CFP',
    label: 'Concediu Fără Plată',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    timelineClass: 'bg-amber-600 text-white',
    borderClass: 'border-amber-200 bg-amber-50/40',
  },
};

export function plainRo(s: string | undefined | null): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normRo(s: string | undefined | null): string {
  return plainRo(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

export function parseRoDate(s: string | undefined | null): Date | null {
  const m = String(s || '').match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const anyM = String(s || '').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (anyM) {
    const d = new Date(Number(anyM[3]), Number(anyM[2]) - 1, Number(anyM[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function fmtRoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function roToIsoDate(s: string | undefined | null): string {
  const d = parseRoDate(s);
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoToRoDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function fmtRoDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fmtRoDate(d)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function todayRo(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysBetweenInclusive(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function diffDaysFromToday(target: Date): number {
  const azi = todayRo();
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((t.getTime() - azi.getTime()) / 86400000);
}

export function parteNr(s: string | undefined | null): {
  camion: string;
  remorca: string;
} {
  const p = String(s || '').split('/');
  return {
    camion: (p[0] || '').trim(),
    remorca: (p[1] || '').trim(),
  };
}

/**
 * Splits drivers by comma (",") or slash ("/") to support both
 * "CRAINIC ANDREI-GABRIEL, TOMUS ELENA" and "SOFER 1/SOFER 2".
 */
export function splitDrivers(s: string | undefined | null): string[] {
  return String(s || '')
    .split(/[,/]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function isSwapRow(nrCamion: string): boolean {
  const { remorca } = parteNr(nrCamion);
  return /^schimb/i.test(remorca);
}

export function normRemKey(s: string | undefined | null): string {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isFlotaSwapTag(note: string | undefined | null): boolean {
  const p = plainRo(note);
  if (!p) return false;
  if (p.includes('ulei')) return false;
  return /\bschim(?:b)?\b/.test(p);
}

/**
 * Computes free trailers from `flota`, `sheet 1` (`curse`), and `istoric remorci`:
 * a trailer is considered active ONLY when it has an active/future discharge date (>= azi)
 * AND both country (`tara`) and locality (`localitatea`) filled in `sheet 1`.
 * Any trailer missing discharge date, country, or locality automatically appears in Remorci libere.
 */
export function computeFreeTrailers(
  flota: string[][],
  curse: string[][],
  istoricRemorci: string[][] = []
): FreeTrailer[] {
  const azi = todayRo();
  const normKey = normRemKey;
  const isSwapName = (s: string) => /^schimb/i.test(s.trim());

  const displayNames: Record<string, string> = {};
  const ultima: Record<string, Date> = {};
  const activa: Record<string, boolean> = {};
  const sofer: Record<string, string> = {};
  const flotaNotes: Record<string, string> = {};
  const missingDestInCurse: Record<string, boolean> = {};
  const yardOrWaitInCurse: Record<string, boolean> = {};

  const registerTrailer = (raw: string, preferName = false) => {
    const clean = String(raw || '').trim();
    if (!clean || isSwapName(clean)) return '';
    const k = normKey(clean);
    if (!k) return '';
    if (preferName || !displayNames[k]) {
      displayNames[k] = clean;
    }
    return k;
  };

  for (let i = 1; i < (flota?.length || 0); i++) {
    const k = registerTrailer(String(flota[i]?.[1] || ''), true);
    const note = String(flota[i]?.[3] || '').trim();
    if (k && note) {
      flotaNotes[k] = note;
    }
  }

  for (let i = 1; i < (curse?.length || 0); i++) {
    const r = curse[i] || [];
    const { remorca } = parteNr(r[1]);
    const k = registerTrailer(remorca);
    if (!k) continue;
    const drv = String(r[7] || '').trim();
    const dataPlain = plainRo(r[2]);
    const d = parseRoDate(r[2]);
    const hasTara = Boolean(String(r[3] || '').trim());
    const hasLoc = Boolean(String(r[4] || '').trim());

    if (dataPlain === 'curte' || dataPlain === 'sofer') {
      yardOrWaitInCurse[k] = true;
    } else if (d && d >= azi && hasTara && hasLoc) {
      activa[k] = true;
    } else if (!hasTara || !hasLoc) {
      missingDestInCurse[k] = true;
    }

    if (d && ((hasTara && hasLoc) || d < azi)) {
      if (!ultima[k] || d >= ultima[k]) {
        ultima[k] = d;
        if (drv) sofer[k] = drv;
      }
    } else if (drv && !sofer[k]) {
      sofer[k] = drv;
    }
  }

  for (let i = 1; i < (istoricRemorci?.length || 0); i++) {
    const row = istoricRemorci[i] || [];
    const kPred = registerTrailer(String(row[2] || ''));
    if (kPred) {
      const dPred = parseRoDate(row[6]) || parseRoDate(row[9]);
      const sofPred = String(row[10] || '').trim();
      if (dPred && (!ultima[kPred] || dPred >= ultima[kPred])) {
        ultima[kPred] = dPred;
        if (sofPred) sofer[kPred] = sofPred;
      } else if (sofPred && !sofer[kPred]) {
        sofer[kPred] = sofPred;
      }
    }
    const kPrel = registerTrailer(String(row[3] || ''));
    if (kPrel) {
      const dPrel = parseRoDate(row[16]) || parseRoDate(row[13]);
      const sofPrel = String(row[12] || '').trim();
      if (dPrel && (!ultima[kPrel] || dPrel >= ultima[kPrel])) {
        ultima[kPrel] = dPrel;
        if (sofPrel) sofer[kPrel] = sofPrel;
      } else if (sofPrel && !sofer[kPrel]) {
        sofer[kPrel] = sofPrel;
      }
    }
  }

  const lista: {
    rem: string;
    d: Date | null;
    sof: string;
    flotaNote: string;
    motiv: string;
  }[] = [];
  Object.keys(displayNames).forEach((k) => {
    if (!activa[k]) {
      const d = ultima[k] || null;
      const motiv = missingDestInCurse[k]
        ? 'Fără țară / localitate descărcare'
        : yardOrWaitInCurse[k]
          ? 'În curte / așteaptă șofer'
          : d
            ? 'Cursă finalizată'
            : 'Fără cursă activă';
      lista.push({
        rem: displayNames[k],
        d,
        sof: sofer[k] || '',
        flotaNote: flotaNotes[k] || '',
        motiv,
      });
    }
  });

  lista.sort((a, b) => (a.d ? a.d.getTime() : 0) - (b.d ? b.d.getTime() : 0));

  return lista.map((x) => ({
    remorca: x.rem,
    nefolositaDin: x.d ? fmtRoDate(x.d) : 'fără curse',
    timestamp: x.d ? x.d.getTime() : 0,
    ultimulSofer: x.sof,
    flotaNote: x.flotaNote || undefined,
    motiv: x.motiv,
  }));
}

export const SHEET1_DEFAULT_HEADERS = [
  'id',
  'Nr camion',
  'data descarcarii',
  'tara',
  'localitatea',
  'detalii',
  'observații',
  'nume sofer',
  'TELEFON',
  'REZERVA',
  'TIP AUTO',
  'AN FABRICATIE',
  'PERIOADA ESTIMATA',
  'GARAJ DIN',
  'CAMIOANE original',
] as const;

export const FLOTA_DEFAULT_HEADERS = [
  'Nr camion',
  'Nr remorca',
  'nume sofer',
  'TIP',
  'NR TELEFON',
  'TELEFON REZERVA',
  'AN FABRICATIE CAP TRACTOR',
  'TIP AUTO',
] as const;

export interface FleetAutoFillResult {
  telefon: string;
  rezerva: string;
  tipAuto: string;
  anFabricatie: string;
  camioaneOriginal: string;
}

export function computeFleetAutoFill(
  params: { camion?: string; remorca?: string; soferi?: string },
  flota: string[][]
): FleetAutoFillResult {
  const byCamion = new Map<
    string,
    { a: string; b: string; g: string; h: string }
  >();
  const byRemorca = new Map<
    string,
    { a: string; b: string; g: string; h: string }
  >();
  const bySofer = new Map<string, { e: string; f: string }>();

  for (let i = 1; i < (flota?.length || 0); i++) {
    const r = flota[i] || [];
    const a = String(r[0] || '').trim();
    const b = String(r[1] || '').trim();
    const c = String(r[2] || '').trim();
    const e = String(r[4] || '').trim();
    const f = String(r[5] || '').trim();
    const g = String(r[6] || '').trim();
    const h = String(r[7] || '').trim();

    const kCam = normRemKey(a);
    if (kCam && !byCamion.has(kCam)) {
      byCamion.set(kCam, { a, b, g, h });
    }
    const kRem = normRemKey(b);
    if (kRem && !byRemorca.has(kRem)) {
      byRemorca.set(kRem, { a, b, g, h });
    }
    const kSof = normRo(c);
    if (kSof) {
      const existing = bySofer.get(kSof);
      if (!existing) {
        bySofer.set(kSof, { e, f });
      } else {
        if (!existing.e && e) existing.e = e;
        if (!existing.f && f) existing.f = f;
      }
    }
  }

  const kCamTarget = normRemKey(params.camion);
  const camRow = kCamTarget ? byCamion.get(kCamTarget) : undefined;
  const anFabricatie = camRow ? camRow.g : '';
  const camioaneOriginal = camRow
    ? camRow.b
      ? `${camRow.a}/${camRow.b}`
      : camRow.a
    : '';

  const remClean = String(params.remorca || '').trim();
  const kRemTarget =
    remClean && !/^schimb/i.test(remClean) ? normRemKey(remClean) : '';
  const remRow = kRemTarget ? byRemorca.get(kRemTarget) : undefined;
  const tipAuto = remRow ? remRow.h : '';

  const tels: string[] = [];
  const rezs: string[] = [];
  for (const drv of splitDrivers(params.soferi)) {
    const sofRow = bySofer.get(normRo(drv));
    if (!sofRow) continue;
    if (sofRow.e && !tels.includes(sofRow.e)) tels.push(sofRow.e);
    if (sofRow.f && !rezs.includes(sofRow.f)) rezs.push(sofRow.f);
  }

  return {
    telefon: tels.join(' / '),
    rezerva: rezs.join(' / '),
    tipAuto,
    anFabricatie,
    camioaneOriginal,
  };
}

export function parseTrips(curse: string[][]): TripRecord[] {
  if (!curse || curse.length < 2) return [];
  const azi = todayRo();
  const rows: TripRecord[] = [];
  for (let i = 1; i < curse.length; i++) {
    const row = curse[i] || [];
    const cells = Array.from({ length: 15 }, (_, idx) =>
      String(row[idx] || '').replace(/\r?\n/g, ' ').trim()
    );
    if (cells.every((c) => !c)) continue;

    const { camion, remorca } = parteNr(cells[1]);
    const dataStr = cells[2];
    const dataPlain = plainRo(dataStr);
    const d = parseRoDate(dataStr);
    const hasTara = Boolean(cells[3]);
    const hasLoc = Boolean(cells[4]);
    const hasUnloadingDest = hasTara && hasLoc;

    let statusType: TripStatusType = 'unknown';
    if (isSwapRow(cells[1])) {
      statusType = 'swap';
    } else if (dataPlain === 'curte') {
      statusType = 'yard';
    } else if (dataPlain === 'sofer') {
      statusType = 'driver_wait';
    } else if (d) {
      if (d >= azi) {
        statusType = hasUnloadingDest ? 'active' : 'unknown';
      } else {
        statusType = 'done';
      }
    }

    const hasCapTractor = Boolean(camion);

    rows.push({
      rowIndex: i + 1,
      cells,
      camion,
      remorca,
      dataDesc: dataStr,
      dataDescDate: d,
      tara: cells[3],
      localitate: cells[4],
      sofer: cells[7],
      isActive: statusType === 'active' && hasUnloadingDest && hasCapTractor,
      statusType,
    });
  }
  return rows;
}

/**
 * Parses `vize medicale` rows flexibly across common Google Sheet layouts:
 * - Standard 4-column (`Nr. | Nume | Document | Data expirare`) with merged/blank names or numeric Nr.
 * - 3-column (`Nume | Document | Data expirare`)
 * - Reordered columns detected via header row, or driver-name section header rows above documents.
 * Normalizes output cells to `[nr, effectiveName, document, dateStr]`.
 */
export function parseVisas(vize: string[][]): VisaRecord[] {
  if (!vize || vize.length === 0) return [];
  const rows: VisaRecord[] = [];
  const isRowNum = (s: string) => /^\d+[.)]?$/.test(s.trim());
  const isHeaderWord = (s: string) => {
    const p = plainRo(s);
    return (
      p === 'nr' ||
      p === 'nr.' ||
      p === 'nr crt' ||
      p === 'crt' ||
      p === 'nume' ||
      p === 'nume sofer' ||
      p === 'sofer' ||
      p === 'document' ||
      p === 'data' ||
      p === 'data expirare' ||
      p === 'expira' ||
      p === 'expirare'
    );
  };

  let headerIdx = -1;
  let nameCol = -1;
  let docCol = -1;
  let dateCol = -1;
  let nrCol = -1;

  for (let i = 0; i < Math.min(3, vize.length); i++) {
    const r = vize[i] || [];
    let nIdx = -1;
    let dIdx = -1;
    let dtIdx = -1;
    let nrIdx = -1;
    r.forEach((cell, cIdx) => {
      const p = plainRo(cell);
      if (!p) return;
      if (nrIdx === -1 && (p === 'nr' || p === 'nr.' || p === 'nr crt' || p === 'crt')) {
        nrIdx = cIdx;
      } else if (
        nIdx === -1 &&
        (p.includes('nume') || p.includes('sofer') || p.includes('angajat'))
      ) {
        nIdx = cIdx;
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
        dIdx = cIdx;
      } else if (
        dtIdx === -1 &&
        (p.includes('expir') || p.includes('data') || p.includes('valab'))
      ) {
        dtIdx = cIdx;
      }
    });
    const hits = [nIdx, dIdx, dtIdx].filter((x) => x >= 0).length;
    if (hits >= 2) {
      headerIdx = i;
      nameCol = nIdx;
      docCol = dIdx;
      dateCol = dtIdx;
      nrCol = nrIdx;
      break;
    }
    if (nIdx >= 0 && dIdx === -1 && dtIdx === -1) {
      const nextRows = vize.slice(i + 1, i + 10);
      const multiDateRow = nextRows.some(
        (nr) => (nr || []).filter((c) => Boolean(parseRoDate(c))).length >= 2
      );
      if (multiDateRow) {
        const hdr = vize[i] || [];
        let lastMatrixName = '';
        for (let rIdx = i + 1; rIdx < vize.length; rIdx++) {
          const mRow = vize[rIdx] || [];
          const rawN = String(mRow[nIdx] || '').trim();
          if (rawN && !isRowNum(rawN) && !isHeaderWord(rawN)) {
            lastMatrixName = rawN;
          }
          const effName =
            rawN && !isRowNum(rawN) && !isHeaderWord(rawN) ? rawN : lastMatrixName;
          const rawNrVal = nrIdx >= 0 ? String(mRow[nrIdx] || '').trim() : '';
          for (let c = 0; c < mRow.length; c++) {
            if (c === nIdx || c === nrIdx) continue;
            const cellDateStr = String(mRow[c] || '').trim();
            const parsed = parseRoDate(cellDateStr);
            if (!parsed) continue;
            const docLabel = String(hdr[c] || '').trim() || `Document ${c + 1}`;
            const daysLeft = diffDaysFromToday(parsed);
            const status: VisaRecord['status'] =
              daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring' : 'valid';
            rows.push({
              rowIndex: rIdx + 1,
              cells: [isRowNum(rawNrVal) ? rawNrVal : '', effName, docLabel, cellDateStr],
              expiryDate: parsed,
              daysLeft,
              status,
            });
          }
        }
        return rows;
      }
    }
  }

  const startRow = headerIdx >= 0 ? headerIdx + 1 : 1;

  if (nameCol === -1 || docCol === -1 || dateCol === -1) {
    const sampleRows = vize.slice(startRow, startRow + 15);
    const hasCol3Dates = sampleRows.some((r) => Boolean(parseRoDate(r?.[3])));
    const hasCol2Dates = sampleRows.some((r) => Boolean(parseRoDate(r?.[2])));
    const hasCol1Dates = sampleRows.some((r) => Boolean(parseRoDate(r?.[1])));

    if (!hasCol3Dates && hasCol2Dates) {
      if (nameCol === -1) nameCol = 0;
      if (docCol === -1) docCol = 1;
      if (dateCol === -1) dateCol = 2;
    } else if (!hasCol3Dates && !hasCol2Dates && hasCol1Dates) {
      if (docCol === -1) docCol = 0;
      if (dateCol === -1) dateCol = 1;
      if (nameCol === -1) nameCol = 2;
    } else {
      if (nrCol === -1) nrCol = 0;
      if (nameCol === -1) nameCol = 1;
      if (docCol === -1) docCol = 2;
      if (dateCol === -1) dateCol = 3;
    }
  }

  let lastName = '';

  for (let i = startRow; i < vize.length; i++) {
    const row = vize[i] || [];
    const get = (idx: number) => (idx >= 0 ? String(row[idx] || '').trim() : '');

    const rawNr = get(nrCol);
    const rawName = get(nameCol);
    let rawDoc = get(docCol);
    let rawDate = get(dateCol);

    let candidateName =
      rawName && !isRowNum(rawName) && !isHeaderWord(rawName) && !parseRoDate(rawName)
        ? rawName
        : '';

    if (!candidateName) {
      for (let c = 0; c < row.length; c++) {
        if (c === docCol || c === dateCol) continue;
        const val = String(row[c] || '').trim();
        if (val && !isRowNum(val) && !isHeaderWord(val) && !parseRoDate(val)) {
          candidateName = val;
          break;
        }
      }
    }

    if (candidateName) {
      lastName = candidateName;
    }

    let parsed = parseRoDate(rawDate);
    if (!parsed && rawDoc) {
      const maybeDate = parseRoDate(rawDoc);
      if (maybeDate) {
        parsed = maybeDate;
        rawDate = rawDoc;
        rawDoc = '';
      }
    }
    if (!parsed) {
      for (let c = 0; c < row.length; c++) {
        if (c === nameCol || c === nrCol) continue;
        const val = String(row[c] || '').trim();
        const d = parseRoDate(val);
        if (d) {
          parsed = d;
          rawDate = val;
          break;
        }
      }
    }

    if (!rawDoc && !rawDate) continue;
    if (isHeaderWord(rawDoc) || isHeaderWord(rawDate)) continue;

    const effectiveName = candidateName || lastName;
    const nrDisplay = isRowNum(rawNr) ? rawNr : '';
    const normalizedCells = [nrDisplay, effectiveName, rawDoc, rawDate];

    let daysLeft: number | null = null;
    let status: VisaRecord['status'] = 'unknown';
    if (parsed) {
      daysLeft = diffDaysFromToday(parsed);
      if (daysLeft < 0) status = 'expired';
      else if (daysLeft <= 30) status = 'expiring';
      else status = 'valid';
    }

    rows.push({
      rowIndex: i + 1,
      cells: normalizedCells,
      expiryDate: parsed,
      daysLeft,
      status,
    });
  }
  return rows;
}

const MONTH_PREFIXES = [
  'ian',
  'feb',
  'mar',
  'apr',
  'mai',
  'iun',
  'iul',
  'aug',
  'sep',
  'oct',
  'noi',
  'dec',
] as const;

function matchMonthHeader(cell: string): number {
  const p = plainRo(cell);
  if (!p) return -1;
  if (p.startsWith('nov')) return 10;
  for (let m = 0; m < MONTH_PREFIXES.length; m++) {
    if (p.startsWith(MONTH_PREFIXES[m])) return m;
  }
  return -1;
}

function parseLeaveTokenDate(
  part: string,
  defaultMonth: number,
  defaultYear: number
): { date: Date; hasYear: boolean; hasMonth: boolean } | null {
  const clean = part.trim();
  if (!clean) return null;

  const full = clean.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (full) {
    const d = new Date(Number(full[3]), Number(full[2]) - 1, Number(full[1]));
    return Number.isNaN(d.getTime())
      ? null
      : { date: d, hasYear: true, hasMonth: true };
  }

  const dm = clean.match(/(\d{1,2})[./-](\d{1,2})/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const d = new Date(defaultYear, month, day);
      return Number.isNaN(d.getTime())
        ? null
        : { date: d, hasYear: false, hasMonth: true };
    }
  }

  const dayOnly = clean.match(/\b(\d{1,2})\b/);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(defaultYear, defaultMonth, day);
      return Number.isNaN(d.getTime())
        ? null
        : { date: d, hasYear: false, hasMonth: false };
    }
  }

  return null;
}

function detectLeavePrefix(raw: string): {
  type: LeaveType | null;
  rest: string;
} {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { type: null, rest: '' };
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const m = normalized.match(
    /^(concediu\s+fara\s+plata|fara\s+plata|cfp|fp|concediu\s+medical|medical|cm|concediu\s+odihna|odihna|co|libere|liber|l)(?:\b|(?=\d))[\s:.-]*(.*)$/i
  );
  if (!m) return { type: null, rest: trimmed };
  const kw = m[1].toLowerCase().replace(/\s+/g, ' ');
  let type: LeaveType = 'CO';
  if (kw === 'cfp' || kw === 'fp' || kw.includes('fara plata')) type = 'CFP';
  else if (kw === 'cm' || kw.includes('medical')) type = 'CM';
  else if (kw === 'l' || kw.startsWith('liber')) type = 'L';
  else type = 'CO';
  return { type, rest: m[2].trim() };
}

export function extractMonthTypeInputs(
  cell: string
): Record<LeaveType, string> {
  const buckets: Record<LeaveType, string[]> = {
    CO: [],
    CM: [],
    L: [],
    CFP: [],
  };
  const clauses = String(cell || '')
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    // Split mid-clause only where a new explicit type prefix starts after a comma
    const subParts = clause
      .split(/,(?=\s*(?:concediu\s+fara\s+plata|fara\s+plata|cfp|fp|concediu\s+medical|medical|cm|concediu\s+odihna|odihna|co|libere|liber|l)(?:\b|(?=\d)))/i)
      .map((s) => s.trim())
      .filter(Boolean);

    let activeType: LeaveType = 'CO';
    for (const part of subParts) {
      const detected = detectLeavePrefix(part);
      if (detected.type) activeType = detected.type;
      if (detected.rest) buckets[activeType].push(detected.rest);
    }
  }

  return {
    CO: buckets.CO.join('; '),
    CM: buckets.CM.join('; '),
    L: buckets.L.join('; '),
    CFP: buckets.CFP.join('; '),
  };
}

export function buildMonthCellText(byType: Record<LeaveType, string>): string {
  const parts: string[] = [];
  for (const t of LEAVE_TYPES) {
    const val = String(byType[t] || '').trim();
    if (val) parts.push(`${t} ${val}`);
  }
  return parts.join('; ');
}

export function parseMonthLeaveCell(
  cell: string,
  monthIdx: number,
  year: number
): { start: Date; end: Date; type: LeaveType }[] {
  const out: { start: Date; end: Date; type: LeaveType }[] = [];
  const clauses = String(cell || '')
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    let activeType: LeaveType = 'CO';
    const commaParts = clause
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const rawSeg of commaParts) {
      const detected = detectLeavePrefix(rawSeg);
      if (detected.type) activeType = detected.type;
      const cleaned = detected.rest.replace(/^[a-zA-Z.\s]+(?=\d)/, '').trim();
      if (!cleaned) continue;

      const fullDates = cleaned.match(/\d{1,2}[./-]\d{1,2}[./-]\d{4}/g);
      if (fullDates && fullDates.length >= 2) {
        const s = parseRoDate(fullDates[0]);
        const e = parseRoDate(fullDates[fullDates.length - 1]);
        if (s && e) {
          out.push(
            e >= s
              ? { start: s, end: e, type: activeType }
              : { start: e, end: s, type: activeType }
          );
          continue;
        }
      } else if (fullDates && fullDates.length === 1) {
        const s = parseRoDate(fullDates[0]);
        if (s) {
          out.push({ start: s, end: s, type: activeType });
          continue;
        }
      }

      const rangeParts = cleaned.split(/\s*[-–—]+\s*/).filter(Boolean);
      if (rangeParts.length >= 2) {
        const sParsed = parseLeaveTokenDate(rangeParts[0], monthIdx, year);
        const eParsed = parseLeaveTokenDate(
          rangeParts[rangeParts.length - 1],
          sParsed ? sParsed.date.getMonth() : monthIdx,
          year
        );
        if (sParsed && eParsed) {
          let end = eParsed.date;
          if (end < sParsed.date) {
            if (!eParsed.hasMonth) {
              end = new Date(
                sParsed.date.getFullYear(),
                sParsed.date.getMonth() + 1,
                end.getDate()
              );
            } else if (!eParsed.hasYear) {
              end = new Date(
                sParsed.date.getFullYear() + 1,
                end.getMonth(),
                end.getDate()
              );
            }
          }
          out.push({ start: sParsed.date, end, type: activeType });
          continue;
        }
      }

      const single = parseLeaveTokenDate(cleaned, monthIdx, year);
      if (single) {
        out.push({ start: single.date, end: single.date, type: activeType });
      }
    }
  }

  return out;
}

export function countUniqueLeaveDays(
  periods: { start: Date; end: Date }[]
): number {
  const days = new Set<string>();
  for (const p of periods) {
    const start = new Date(
      p.start.getFullYear(),
      p.start.getMonth(),
      p.start.getDate()
    );
    const end = new Date(
      p.end.getFullYear(),
      p.end.getMonth(),
      p.end.getDate()
    );
    if (end < start) continue;
    for (
      let d = new Date(start.getTime());
      d <= end;
      d.setDate(d.getDate() + 1)
    ) {
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  return days.size;
}

export function countLeaveDaysByType(
  periods: { start: Date; end: Date; type: LeaveType }[]
): Record<LeaveType | 'total', number> {
  const byType: Record<LeaveType, Set<string>> = {
    CO: new Set(),
    CM: new Set(),
    L: new Set(),
    CFP: new Set(),
  };
  const all = new Set<string>();
  for (const p of periods) {
    const start = new Date(
      p.start.getFullYear(),
      p.start.getMonth(),
      p.start.getDate()
    );
    const end = new Date(
      p.end.getFullYear(),
      p.end.getMonth(),
      p.end.getDate()
    );
    if (end < start) continue;
    for (
      let d = new Date(start.getTime());
      d <= end;
      d.setDate(d.getDate() + 1)
    ) {
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      byType[p.type].add(k);
      all.add(k);
    }
  }
  return {
    total: all.size,
    CO: byType.CO.size,
    CM: byType.CM.size,
    L: byType.L.size,
    CFP: byType.CFP.size,
  };
}

export function isLeaveMatrix(concediu: string[][]): boolean {
  if (!concediu || concediu.length === 0) return false;
  for (let i = 0; i < Math.min(3, concediu.length); i++) {
    const row = concediu[i] || [];
    const monthHits = row.filter((c) => matchMonthHeader(c) >= 0).length;
    if (monthHits >= 3) return true;
  }
  return concediu.some((r) => Array.isArray(r) && r.length >= 13);
}

export function parseLeaves(concediu: string[][]): LeaveRecord[] {
  if (!concediu || concediu.length === 0) return [];
  const azi = todayRo();
  const in14Days = new Date(azi.getTime() + 14 * 86400000);
  const currentYear = azi.getFullYear();

  const makeRecord = (
    nume: string,
    type: LeaveType,
    startDate: Date | null,
    endDate: Date | null,
    rawStart?: string,
    rawEnd?: string
  ): LeaveRecord => {
    const daysCount =
      startDate && endDate ? daysBetweenInclusive(startDate, endDate) : 0;
    const isActiveToday = Boolean(
      startDate && endDate && startDate <= azi && azi <= endDate
    );
    const isUpcoming = Boolean(
      startDate && startDate > azi && startDate <= in14Days
    );
    return {
      nume: nume.trim(),
      type,
      startStr: rawStart || (startDate ? fmtRoDate(startDate) : ''),
      endStr: rawEnd || (endDate ? fmtRoDate(endDate) : ''),
      startDate,
      endDate,
      daysCount,
      isActiveToday,
      isUpcoming,
    };
  };

  // Detect monthly matrix header (like CONCEDIU SOFERI: NUME SOFER | IANUARIE ... DECEMBRIE | TOTAL)
  let headerIdx = -1;
  let monthCols: { colIdx: number; month: number }[] = [];
  let nameCol = 0;
  let sheetYear = currentYear;

  for (let i = 0; i < Math.min(3, concediu.length); i++) {
    const row = concediu[i] || [];
    const cols: { colIdx: number; month: number }[] = [];
    row.forEach((cell, colIdx) => {
      const m = matchMonthHeader(cell);
      if (m >= 0) cols.push({ colIdx, month: m });
      const ym = String(cell || '').match(/\b(20\d{2})\b/);
      if (ym) sheetYear = Number(ym[1]);
    });
    if (cols.length >= 3) {
      headerIdx = i;
      monthCols = cols;
      const foundNameIdx = row.findIndex((c) => {
        const p = plainRo(c);
        return p.includes('nume') || p.includes('sofer');
      });
      nameCol = foundNameIdx >= 0 ? foundNameIdx : 0;
      break;
    }
  }

  // Fallback if matrix rows have 13+ columns without header row
  if (headerIdx === -1 && concediu.some((r) => Array.isArray(r) && r.length >= 13)) {
    monthCols = Array.from({ length: 12 }, (_, m) => ({ colIdx: m + 1, month: m }));
  }

  if (monthCols.length > 0) {
    const records: LeaveRecord[] = [];
    for (let i = headerIdx + 1; i < concediu.length; i++) {
      const row = concediu[i] || [];
      const nume = String(row[nameCol] || '').trim();
      const plainName = plainRo(nume);
      if (
        !nume ||
        plainName === 'nume sofer' ||
        plainName === 'nume' ||
        plainName.startsWith('total')
      ) {
        continue;
      }

      for (const { colIdx, month } of monthCols) {
        const cell = String(row[colIdx] || '').trim();
        if (!cell) continue;
        const periods = parseMonthLeaveCell(cell, month, sheetYear);
        for (const p of periods) {
          records.push(makeRecord(nume, p.type, p.start, p.end));
        }
      }
    }
    return records;
  }

  // Standard 3/4-tuple format: [nume, startStr, endStr, type?] or generic row with full dates
  const records: LeaveRecord[] = [];
  for (const row of concediu) {
    if (!Array.isArray(row) || row.length === 0) continue;
    const nume = String(row[0] || '').trim();
    if (!nume || plainRo(nume) === 'nume sofer' || plainRo(nume) === 'nume') {
      continue;
    }

    const rawType = String(row[3] || '').trim().toUpperCase();
    const rowType: LeaveType =
      rawType === 'CM' || rawType === 'L' || rawType === 'CFP' || rawType === 'CO'
        ? rawType
        : detectLeavePrefix(String(row[1] || '')).type || 'CO';

    const startStr = String(row[1] || '').trim();
    const endStr = String(row[2] || '').trim();
    const s = parseRoDate(startStr);
    const e = parseRoDate(endStr) || s;
    if (s && e) {
      records.push(makeRecord(nume, rowType, s, e, startStr, endStr || startStr));
      continue;
    }

    const matches = row.join(' ').match(/\d{1,2}[./-]\d{1,2}[./-]\d{4}/g) || [];
    const parsedDates = matches
      .map(parseRoDate)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime());
    if (parsedDates.length > 0) {
      records.push(
        makeRecord(
          nume,
          rowType,
          parsedDates[0],
          parsedDates[parsedDates.length - 1]
        )
      );
    }
  }
  return records;
}
