import { AlertCircle, Check, CheckCircle2, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GasConfig } from '../types/fleet';

const FULL_CODE_GS = `const PAROLA = 'TRANSPORT';
const TAB_CURSE = 'sheet 1', TAB_VIZE = 'vize medicale', TAB_FLOTA = 'flota', TAB_ISTORIC = 'istoric', TAB_LIBERE = 'remorci libere', TAB_TOTAL = 'total concediu', TAB_IST_REM = 'istoric remorci';
const AN_CONCEDIU = new Date().getFullYear();
const LUNI = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

let _ssCache = null;
let _sheetsCache = null;
const _valsCache = {};
let _flotaMapsCache = null;

function ss_() {
  if (!_ssCache) _ssCache = SpreadsheetApp.getActiveSpreadsheet();
  return _ssCache;
}
function sheets_() {
  if (!_sheetsCache) _sheetsCache = ss_().getSheets();
  return _sheetsCache;
}
function registerSheet_(sh) {
  if (sh && _sheetsCache && _sheetsCache.indexOf(sh) < 0) _sheetsCache.push(sh);
}
function invalidateCache_(n) {
  const k = String(n || '').trim().toLowerCase();
  Object.keys(_valsCache).forEach(function(key) {
    if (key.indexOf(k + ':') === 0) delete _valsCache[key];
  });
  if (k === TAB_FLOTA) _flotaMapsCache = null;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_(n) {
  const k = n.toLowerCase();
  return sheets_().find(s => s.getName().trim().toLowerCase() === k);
}
function vals_(n, cols) {
  const cacheKey = n.toLowerCase() + ':' + cols;
  if (_valsCache[cacheKey]) return _valsCache[cacheKey];
  const sh = sheet_(n);
  if (!sh) return [];
  const data = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), Math.max(sh.getLastColumn(), cols)).getDisplayValues();
  _valsCache[cacheKey] = data;
  return data;
}
function esteConcediu_(nume) {
  const n = String(nume).trim().toLowerCase();
  return n.indexOf('concediu') >= 0 && n !== TAB_TOTAL;
}
function sheetConcediu_() {
  return sheets_().find(s => esteConcediu_(s.getName()));
}
function istoric_() {
  const sh = sheet_(TAB_ISTORIC);
  if (!sh || sh.getLastRow() < 2) return [];
  const n = sh.getLastRow(), start = Math.max(2, n - 149);
  return sh.getRange(start, 1, n - start + 1, 7).getDisplayValues();
}
function plain_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function norm_(s) {
  return plain_(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
}
function log_(user, tab, row, actiune, inainte, dupa) {
  let sh = sheet_(TAB_ISTORIC);
  if (!sh) {
    sh = ss_().insertSheet(TAB_ISTORIC);
    registerSheet_(sh);
    sh.appendRow(['Data și ora', 'Utilizator', 'Tab', 'Rând', 'Acțiune', 'Înainte', 'După']);
    sh.setFrozenRows(1);
  }
  const t = Utilities.formatDate(new Date(), 'Europe/Bucharest', 'dd.MM.yyyy HH:mm:ss');
  sh.appendRow([t, user, tab, row, actiune, inainte, dupa]);
}
function parseRo_(s) {
  const m = String(s || '').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}
function fmtRo_(d) {
  const p = n => ('0' + n).slice(-2);
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
}
function azi_() {
  const z = Utilities.formatDate(new Date(), 'Europe/Bucharest', 'yyyy-MM-dd').split('-');
  return new Date(+z[0], +z[1] - 1, +z[2]);
}
const TIPURI_CONCEDIU = ['CO', 'CM', 'L', 'CFP'];
function vizeRows_() {
  const sh = sheet_(TAB_VIZE);
  if (!sh) return [];
  const r = Math.max(sh.getLastRow(), 1);
  const c = Math.max(sh.getLastColumn(), 4);
  return sh.getRange(1, 1, r, c).getDisplayValues();
}
function concediuRows_() {
  const sh = sheetConcediu_();
  if (!sh) return [];
  const r = Math.max(sh.getLastRow(), 1);
  const c = Math.max(sh.getLastColumn(), 14);
  return sh.getRange(1, 1, r, c).getDisplayValues();
}
function concediuMeta_(sh, ensureTypeCols) {
  let lastCol = Math.max(sh.getLastColumn(), 14);
  let headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const findCols = () => {
    const monthCols = {}, typeCols = {};
    let totalCol = -1;
    headers.forEach((h, idx) => {
      const p = plain_(h);
      if (p.indexOf('total') >= 0 && !/\b(co|cm|l|cfp)\b/.test(p)) totalCol = idx + 1;
      for (let t = 0; t < TIPURI_CONCEDIU.length; t++) {
        const k = TIPURI_CONCEDIU[t].toLowerCase();
        if (p === k || p === 'total ' + k || p.slice(-(k.length + 1)) === ' ' + k) typeCols[TIPURI_CONCEDIU[t]] = idx + 1;
      }
      for (let m = 0; m < 12; m++) {
        if (p.indexOf(LUNI[m]) === 0 || (m === 10 && p.indexOf('nov') === 0)) monthCols[m] = idx + 1;
      }
    });
    return { monthCols, totalCol, typeCols };
  };
  let info = findCols();
  if (ensureTypeCols) {
    let added = false;
    for (let t = 0; t < TIPURI_CONCEDIU.length; t++) {
      const code = TIPURI_CONCEDIU[t];
      if (!info.typeCols[code]) {
        lastCol += 1;
        sh.getRange(1, lastCol).setValue('TOTAL ' + code);
        added = true;
      }
    }
    if (added) {
      headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
      info = findCols();
    }
  }
  return { lastCol: lastCol, headers: headers, monthCols: info.monthCols, totalCol: info.totalCol, typeCols: info.typeCols };
}
function detectLeavePrefix_(raw) {
  const s = String(raw || '').trim();
  const n = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const m = n.match(/^(concediu\s+fara\s+plata|fara\s+plata|cfp|fp|concediu\s+medical|medical|cm|concediu\s+odihna|odihna|co|libere|liber|l)(?:\b|(?=\d))[\s:.-]*(.*)$/i);
  if (!m) return { type: null, rest: s };
  const kw = m[1].toLowerCase().replace(/\s+/g, ' ');
  let t = 'CO';
  if (kw === 'cfp' || kw === 'fp' || kw.indexOf('fara plata') >= 0) t = 'CFP';
  else if (kw === 'cm' || kw.indexOf('medical') >= 0) t = 'CM';
  else if (kw === 'l' || kw.indexOf('liber') === 0) t = 'L';
  return { type: t, rest: m[2].trim() };
}
function recalcConcediuRow_(sh, row, meta) {
  const mInfo = meta || concediuMeta_(sh, true);
  const rowVals = sh.getRange(row, 1, 1, mInfo.lastCol).getDisplayValues()[0];
  let totalAll = 0;
  const totalsByType = { CO: 0, CM: 0, L: 0, CFP: 0 };
  for (let m = 0; m < 12; m++) {
    const cIdx = (mInfo.monthCols[m] || (m + 2)) - 1;
    const txt = String(rowVals[cIdx] || '').trim();
    if (!txt) continue;
    const seenAll = {}, seenType = { CO: {}, CM: {}, L: {}, CFP: {} };
    txt.split(/[;\n]+/).forEach(clause => {
      let activeType = 'CO';
      clause.split(',').forEach(rawSeg => {
        const det = detectLeavePrefix_(rawSeg);
        if (det.type) activeType = det.type;
        const cl = det.rest.replace(/^[a-zA-Z.\s]+(?=\d)/, '').trim();
        if (!cl) return;
        const rp = cl.split(/\s*[-–—]+\s*/).filter(Boolean);
        const pDay = s => {
          const dm = String(s).match(/(\d{1,2})[.\/-](\d{1,2})/);
          if (dm) return new Date(AN_CONCEDIU, +dm[2] - 1, +dm[1]);
          const d1 = String(s).match(/\b(\d{1,2})\b/);
          return d1 ? new Date(AN_CONCEDIU, m, +d1[1]) : null;
        };
        const a = pDay(rp[0]), b2 = pDay(rp[rp.length - 1]);
        if (a && b2 && b2 >= a) {
          for (let d = new Date(a.getTime()); d <= b2; d.setDate(d.getDate() + 1)) {
            const dk = d.getMonth() + '-' + d.getDate();
            seenAll[dk] = true;
            seenType[activeType][dk] = true;
          }
        }
      });
    });
    totalAll += Object.keys(seenAll).length;
    TIPURI_CONCEDIU.forEach(t => { totalsByType[t] += Object.keys(seenType[t]).length; });
  }
  if (mInfo.totalCol > 0 && !sh.getRange(row, mInfo.totalCol).getFormula()) {
    sh.getRange(row, mInfo.totalCol).setValue(totalAll);
  }
  TIPURI_CONCEDIU.forEach(t => {
    const col = mInfo.typeCols[t];
    if (col > 0 && !sh.getRange(row, col).getFormula()) sh.getRange(row, col).setValue(totalsByType[t]);
  });
}
function actualizeazaTotaluriConcediu() {
  const sh = sheetConcediu_();
  if (!sh || sh.getLastRow() < 2) return;
  const meta = concediuMeta_(sh, true);
  for (let r = 2; r <= sh.getLastRow(); r++) {
    if (String(sh.getRange(r, 1).getDisplayValue() || '').trim()) recalcConcediuRow_(sh, r, meta);
  }
}
function refreshRemorciLibere_() {
  const ss = ss_();
  let libSh = sheet_(TAB_LIBERE);
  if (!libSh) {
    libSh = ss.insertSheet('REMORCI LIBERE');
    registerSheet_(libSh);
    libSh.setFrozenRows(1);
    libSh.setFrozenColumns(1);
  }
  const fl = vals_(TAB_FLOTA, 12), cu = vals_(TAB_CURSE, 16), ir = vals_(TAB_IST_REM, 17);
  const azi = azi_(), names = {}, ultima = {}, activa = {}, sofer = {};
  const normK = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const reg = (raw, prefer) => {
    const clean = String(raw || '').trim();
    if (!clean || /^schimb/i.test(clean)) return '';
    const k = normK(clean);
    if (!k) return '';
    if (prefer || !names[k]) names[k] = clean;
    return k;
  };
  for (let i = 1; i < fl.length; i++) reg(fl[i][1], true);
  for (let i = 1; i < cu.length; i++) {
    const nr = String(cu[i][1] || ''), rem = (nr.split('/')[1] || '').trim();
    const k = reg(rem, false);
    if (!k) continue;
    const drv = String(cu[i][7] || '').trim();
    const d = parseRo_(cu[i][2]);
    const hasTara = Boolean(String(cu[i][3] || '').trim());
    const hasLoc = Boolean(String(cu[i][4] || '').trim());
    if (d && d >= azi && hasTara && hasLoc) {
      activa[k] = true;
    }
    if (d && ((hasTara && hasLoc) || d < azi)) {
      if (!ultima[k] || d >= ultima[k]) { ultima[k] = d; if (drv) sofer[k] = drv; }
    } else if (drv && !sofer[k]) {
      sofer[k] = drv;
    }
  }
  for (let i = 1; i < ir.length; i++) {
    const kPred = reg(ir[i][2], false);
    if (kPred) {
      const dPred = parseRo_(ir[i][6]) || parseRo_(ir[i][9]);
      const sofPred = String(ir[i][10] || '').trim();
      if (dPred && (!ultima[kPred] || dPred >= ultima[kPred])) {
        ultima[kPred] = dPred;
        if (sofPred) sofer[kPred] = sofPred;
      } else if (sofPred && !sofer[kPred]) {
        sofer[kPred] = sofPred;
      }
    }
    const kPrel = reg(ir[i][3], false);
    if (kPrel) {
      const dPrel = parseRo_(ir[i][16]) || parseRo_(ir[i][13]);
      const sofPrel = String(ir[i][12] || '').trim();
      if (dPrel && (!ultima[kPrel] || dPrel >= ultima[kPrel])) {
        ultima[kPrel] = dPrel;
        if (sofPrel) sofer[kPrel] = sofPrel;
      } else if (sofPrel && !sofer[kPrel]) {
        sofer[kPrel] = sofPrel;
      }
    }
  }
  const list = [];
  Object.keys(names).forEach(k => {
    if (!activa[k]) list.push({ rem: names[k], d: ultima[k] || null, sof: sofer[k] || '' });
  });
  list.sort((a, b) => (a.d ? a.d.getTime() : 0) - (b.d ? b.d.getTime() : 0));
  const header = ['Remorcă liberă', 'Nefolosită din', 'Ultimul șofer'];
  const rows = list.map(x => [x.rem, x.d ? fmtRo_(x.d) : 'fără curse', x.sof]);
  const target = [header].concat(rows);
  const curRows = libSh.getLastRow();
  const curCols = libSh.getLastColumn();
  if (curRows === target.length && curCols >= 3) {
    const curVals = libSh.getRange(1, 1, curRows, 3).getDisplayValues();
    if (JSON.stringify(curVals) === JSON.stringify(target)) return;
  }
  libSh.clearContents();
  libSh.getRange(1, 1, target.length, 3).setValues(target);
}
function parseLoadingDate_(rawInc, unloadDate) {
  const s = String(rawInc || '').trim();
  if (!s) return null;
  const full = parseRo_(s);
  if (full) return full;
  const ref = unloadDate || azi_();
  const dm = s.match(/^(\d{1,2})[.\/-](\d{1,2})$/);
  if (dm) {
    const day = +dm[1], month = +dm[2] - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      let d = new Date(ref.getFullYear(), month, day);
      if (unloadDate && d > unloadDate) d = new Date(ref.getFullYear() - 1, month, day);
      return d;
    }
  }
  const d1 = s.match(/^(\d{1,2})$/);
  if (d1) {
    const day = +d1[1];
    if (day >= 1 && day <= 31) {
      let d = new Date(ref.getFullYear(), ref.getMonth(), day);
      if (unloadDate && day > unloadDate.getDate()) d = new Date(ref.getFullYear(), ref.getMonth() - 1, day);
      return d;
    }
  }
  return null;
}
function refreshZileCurseCamion_() {
  const ss = ss_();
  const tabName = 'zile curse camion';
  let sh = sheet_(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
    registerSheet_(sh);
    sh.setFrozenRows(1);
    sh.setFrozenColumns(1);
  }
  const fl = vals_(TAB_FLOTA, 12);
  const cu = vals_(TAB_CURSE, 16);
  const azi = azi_();
  const trucksSet = {};
  for (let i = 1; i < fl.length; i++) {
    const cam = String(fl[i][0] || '').trim();
    if (cam && !trucksSet[cam.toUpperCase()]) trucksSet[cam.toUpperCase()] = cam;
  }
  for (let i = 1; i < cu.length; i++) {
    const nrCam = String(cu[i][1] || '').split('/')[0].trim();
    if (nrCam && !trucksSet[nrCam.toUpperCase()]) trucksSet[nrCam.toUpperCase()] = nrCam;
  }
  const truckKeys = Object.keys(trucksSet).sort(function(a, b) {
    return trucksSet[a].localeCompare(trucksSet[b]);
  });
  const daySets = {};
  truckKeys.forEach(function(k) { daySets[k] = {}; });

  for (let i = 1; i < cu.length; i++) {
    const nr = String(cu[i][1] || '');
    const parts = nr.split('/');
    const cam = (parts[0] || '').trim();
    const rem = (parts[1] || '').trim();
    if (!cam || /^schimb/i.test(rem)) continue;
    const dataDescRaw = String(cu[i][2] || '').trim();
    const dataLow = plain_(dataDescRaw);
    if (dataLow === 'curte' || dataLow === 'sofer' || dataLow === 'fara sofer') continue;

    const key = cam.toUpperCase();
    if (!daySets[key]) daySets[key] = {};

    const unloadDate = parseRo_(dataDescRaw);
    const loadDate = parseLoadingDate_(cu[i][15], unloadDate);
    let startD = null, endD = null;
    if (loadDate && unloadDate) {
      startD = loadDate <= unloadDate ? loadDate : unloadDate;
      endD = loadDate <= unloadDate ? unloadDate : loadDate;
    } else if (loadDate && !dataDescRaw) {
      startD = loadDate;
      const diffMs = azi.getTime() - loadDate.getTime();
      endD = (loadDate <= azi && diffMs <= 60 * 86400000) ? azi : loadDate;
    } else if (unloadDate) {
      startD = unloadDate;
      endD = unloadDate;
    }
    if (!startD || !endD) continue;
    const span = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
    if (span <= 0 || span > 180) continue;

    for (let d = new Date(startD.getTime()); d <= endD; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === AN_CONCEDIU) {
        const dk = d.getMonth() + '-' + d.getDate();
        daySets[key][dk] = true;
      }
    }
  }

  const header = ['Nr camion', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec', 'TOTAL AN'];
  const rows = truckKeys.map(function(key) {
    const cam = trucksSet[key];
    const arr = Array(12).fill(0);
    const seen = daySets[key] || {};
    Object.keys(seen).forEach(function(dk) {
      const m = parseInt(dk.split('-')[0], 10);
      if (m >= 0 && m < 12) arr[m] += 1;
    });
    const total = arr.reduce(function(a, b) { return a + b; }, 0);
    return [cam].concat(arr).concat([total]);
  });
  const target = [header].concat(rows);
  const curRows = sh.getLastRow();
  const curCols = sh.getLastColumn();
  if (curRows === target.length && curCols >= header.length) {
    const curVals = sh.getRange(1, 1, curRows, header.length).getDisplayValues();
    if (JSON.stringify(curVals) === JSON.stringify(target)) return;
  }
  sh.clearContents();
  sh.getRange(1, 1, target.length, header.length).setValues(target);
  invalidateCache_(tabName);
}
function normRem_(r) {
  const s = String(r || '').trim();
  return !s || /^schimb/i.test(s) ? '' : s;
}
function logIstoricRemorci_(camion, oldRemRaw, newRemRaw, swapLoc, oldData, oldTara, oldLoc, oldSofer, newData, newTara, newLoc, newSofer) {
  const oldRem = normRem_(oldRemRaw);
  const newRem = normRem_(newRemRaw);
  if (!oldRem && !newRem) return;
  if (oldRem.toUpperCase() === newRem.toUpperCase()) return;

  let remSh = sheet_(TAB_IST_REM);
  if (!remSh) {
    remSh = ss_().insertSheet(TAB_IST_REM);
    registerSheet_(remSh);
    remSh.appendRow([
      'Nr crt', 'Nr camion', 'remorca predata', 'remorca preluata',
      'data preluarii', 'localitatea', 'data predarii', 'tara descarcarii',
      'localitatea', 'data descarcarii', 'sofer care preda', 'cap tractor',
      'sofer care preia', 'data preluarii', 'TARA', 'localitatea', 'data descarcareii'
    ]);
    remSh.setFrozenRows(1);
  }

  const todayStr = fmtRo_(azi_());
  const lastRow = Math.max(remSh.getLastRow(), 1);
  const rows = lastRow > 1 ? remSh.getRange(2, 1, lastRow - 1, 17).getDisplayValues() : [];

  let maxNr = 0;
  for (let i = 0; i < rows.length; i++) {
    const a = String(rows[i][0] || '').trim();
    if (/^\d+$/.test(a)) {
      const n = parseInt(a, 10);
      if (n > maxNr) maxNr = n;
    }
  }

  const cam = String(camion || '').trim();
  const camionUp = cam.toUpperCase();
  const newRemUp = newRem.toUpperCase();
  const oldRemUp = oldRem.toUpperCase();
  let matchedPrevHandover = false;

  if (newRem) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][2] || '').trim().toUpperCase() === newRemUp && !String(rows[i][11] || '').trim()) {
        remSh.getRange(i + 2, 12, 1, 6).setValues([[
          cam,
          String(newSofer || '').trim(),
          todayStr,
          String(newTara || '').trim(),
          String(newLoc || '').trim(),
          String(newData || '').trim()
        ]]);
        matchedPrevHandover = true;
        break;
      }
    }
    if (!oldRem && !matchedPrevHandover) {
      remSh.appendRow([
        maxNr + 1,
        cam,
        '',
        newRem,
        '',
        String(swapLoc || '').trim(),
        '',
        '',
        '',
        '',
        '',
        cam,
        String(newSofer || '').trim(),
        todayStr,
        String(newTara || '').trim(),
        String(newLoc || '').trim(),
        String(newData || '').trim()
      ]);
      return;
    }
  }

  if (oldRem) {
    let dataPreluariiAnt = '';
    for (let i = rows.length - 1; i >= 0; i--) {
      const rCam = String(rows[i][1] || '').trim().toUpperCase();
      const rPred = String(rows[i][2] || '').trim().toUpperCase();
      const rPrel = String(rows[i][3] || '').trim().toUpperCase();
      const rCapPreia = String(rows[i][11] || '').trim().toUpperCase();
      if (rCam === camionUp && rPrel === oldRemUp) {
        dataPreluariiAnt = String(rows[i][13] || rows[i][6] || '').trim();
        break;
      }
      if (rPred === oldRemUp && rCapPreia === camionUp) {
        dataPreluariiAnt = String(rows[i][13] || '').trim();
        break;
      }
    }
    remSh.appendRow([
      maxNr + 1,
      cam,
      oldRem,
      newRem,
      dataPreluariiAnt,
      String(swapLoc || '').trim(),
      todayStr,
      String(oldTara || '').trim(),
      String(oldLoc || '').trim(),
      String(oldData || '').trim(),
      String(oldSofer || newSofer || '').trim(),
      '',
      '',
      '',
      '',
      '',
      ''
    ]);
  }
}
function normKey_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function splitDrivers_(s) {
  return String(s || '').split(/[,\/\r\n]+/).map(function(x) { return x.trim(); }).filter(Boolean);
}
function flotaLookup_() {
  if (_flotaMapsCache) return _flotaMapsCache;
  const fl = vals_(TAB_FLOTA, 12);
  const byCamion = {}, byRemorca = {}, bySofer = {};
  for (let i = 1; i < fl.length; i++) {
    const r = fl[i] || [];
    const a = String(r[0] || '').trim();
    const b = String(r[1] || '').trim();
    const c = String(r[2] || '').trim();
    const e = String(r[4] || '').trim();
    const f = String(r[5] || '').trim();
    const g = String(r[6] || '').trim();
    const h = String(r[7] || '').trim();
    const kCam = normKey_(a);
    const kRem = normKey_(b);
    const kSof = norm_(c);
    if (kCam) {
      if (!byCamion[kCam]) byCamion[kCam] = { a: a, b: b, g: g, h: h };
      else {
        if (!byCamion[kCam].b && b) byCamion[kCam].b = b;
        if (!byCamion[kCam].g && g) byCamion[kCam].g = g;
        if (!byCamion[kCam].h && h) byCamion[kCam].h = h;
      }
    }
    if (kRem) {
      if (!byRemorca[kRem]) byRemorca[kRem] = { a: a, b: b, g: g, h: h };
      else {
        if (!byRemorca[kRem].h && h) byRemorca[kRem].h = h;
      }
    }
    if (kSof) {
      if (!bySofer[kSof]) bySofer[kSof] = { e: e, f: f };
      else {
        if (!bySofer[kSof].e && e) bySofer[kSof].e = e;
        if (!bySofer[kSof].f && f) bySofer[kSof].f = f;
      }
    }
  }
  _flotaMapsCache = { byCamion: byCamion, byRemorca: byRemorca, bySofer: bySofer };
  return _flotaMapsCache;
}
function computeCurseAutoValues_(rowArr, maps) {
  const m = maps || flotaLookup_();
  const v = Array.from({ length: 16 }, function(_, i) { return String((rowArr && rowArr[i]) || ''); });
  const parts = String(v[1] || '').split('/');
  const cam = (parts[0] || '').trim();
  const remRaw = (parts[1] || '').trim();
  const rem = (!remRaw || /^schimb/i.test(remRaw)) ? '' : remRaw;

  const camInfo = normKey_(cam) ? m.byCamion[normKey_(cam)] : null;
  const remInfo = normKey_(rem) ? m.byRemorca[normKey_(rem)] : null;

  const tels = [], rezs = [];
  const drivers = splitDrivers_(v[7]);
  for (let d = 0; d < drivers.length; d++) {
    const info = m.bySofer[norm_(drivers[d])];
    if (!info) continue;
    if (info.e && tels.indexOf(info.e) < 0) tels.push(info.e);
    if (info.f && rezs.indexOf(info.f) < 0) rezs.push(info.f);
  }

  return {
    telefon: tels.join(' / '),
    rezerva: rezs.join(' / '),
    tipAuto: remInfo ? remInfo.h : '',
    anFabricatie: camInfo ? camInfo.g : '',
    camioaneOriginal: camInfo ? (camInfo.b ? (camInfo.a + '/' + camInfo.b) : camInfo.a) : '',
    hasDriver: drivers.length > 0,
    hasCam: Boolean(cam),
    hasRem: Boolean(rem)
  };
}
function applyCurseAutoFillRow_(sh, row, colChanged, maps) {
  const v = sh.getRange(row, 1, 1, 16).getDisplayValues()[0];
  const m = maps || flotaLookup_();
  const auto = computeCurseAutoValues_(v, m);
  if (!colChanged || colChanged === 2) {
    sh.getRange(row, 11).setValue(auto.hasRem ? auto.tipAuto : '');
    sh.getRange(row, 12).setValue(auto.hasCam ? auto.anFabricatie : '');
    sh.getRange(row, 15).setValue(auto.hasCam ? auto.camioaneOriginal : '');
  }
  if (!colChanged || colChanged === 8) {
    sh.getRange(row, 9, 1, 2).setNumberFormat('@');
    sh.getRange(row, 9).setValue(auto.hasDriver ? auto.telefon : '');
    sh.getRange(row, 10).setValue(auto.hasDriver ? auto.rezerva : '');
  } else if (colChanged === 9) {
    const kTyped = norm_(v[8]);
    const sofInfo = kTyped ? m.bySofer[kTyped] : null;
    if (sofInfo) {
      sh.getRange(row, 9, 1, 2).setNumberFormat('@');
      sh.getRange(row, 9).setValue(sofInfo.e || '');
      sh.getRange(row, 10).setValue(sofInfo.f || '');
    }
  }
}
function checkCurseLoadingDateWarning_(sh, fromRow, toRow, editedColC) {
  const count = toRow - fromRow + 1;
  if (count <= 0) return;
  if (sh.getMaxColumns() < 16) {
    sh.insertColumnsAfter(sh.getMaxColumns(), 16 - sh.getMaxColumns());
  }
  if (!String(sh.getRange(1, 16).getDisplayValue() || '').trim()) {
    sh.getRange(1, 16).setValue('DATA INCARCARII');
  }
  const vals = sh.getRange(fromRow, 1, count, 16).getDisplayValues();
  const missingRows = [];
  for (let i = 0; i < count; i++) {
    const r = fromRow + i;
    const rowVals = vals[i] || [];
    const nrCamion = String(rowVals[1] || '').trim();
    const dataDesc = String(rowVals[2] || '').trim();
    const dataLow = plain_(dataDesc);
    const dataInc = String(rowVals[15] || '').trim();
    const isSpecial = !dataDesc || dataLow === 'curte' || dataLow === 'sofer' || /schimb/i.test(nrCamion);
    const cellP = sh.getRange(r, 16);
    if (!isSpecial && !dataInc) {
      cellP.setBackground('#fef3c7');
      missingRows.push({ row: r, truck: nrCamion || ('Rând ' + r) });
    } else if (dataInc || !dataDesc || dataLow === 'curte' || dataLow === 'sofer') {
      if (cellP.getBackground() === '#fef3c7') {
        cellP.setBackground(null);
      }
    }
  }
  if (editedColC && missingRows.length > 0) {
    const first = missingRows[0];
    try {
      sh.getRange(first.row, 16).activate();
    } catch (err) {}
    const msg = missingRows.length === 1
      ? 'Ai completat data descărcării pentru ' + first.truck + ' (rând ' + first.row + '), dar coloana P (DATA INCARCARII) este goală! Completează data încărcării în coloana P.'
      : 'Ai completat data descărcării pe ' + missingRows.length + ' rânduri fără DATA INCARCARII în coloana P (rândurile: ' + missingRows.map(function(x) { return x.row; }).join(', ') + ').';
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Atenție: completează coloana P!', 10);
    } catch (err) {}
    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert('Completează Data Încărcării (Coloana P)', msg, ui.ButtonSet.OK);
    } catch (err) {}
  }
}
function syncSheet1AutoFill_() {
  const sh = sheet_(TAB_CURSE);
  if (!sh) return;
  if (sh.getMaxColumns() < 16) {
    sh.insertColumnsAfter(sh.getMaxColumns(), 16 - sh.getMaxColumns());
  }
  const defHeaders = ['TELEFON', 'REZERVA', 'TIP AUTO', 'AN FABRICATIE', 'PERIOADA ESTIMATA', 'GARAJ DIN', 'CAMIOANE original', 'DATA INCARCARII'];
  const curHdr = sh.getRange(1, 9, 1, 8).getDisplayValues()[0];
  let hdrChanged = false;
  for (let h = 0; h < 8; h++) {
    if (!String(curHdr[h] || '').trim()) {
      curHdr[h] = defHeaders[h];
      hdrChanged = true;
    }
  }
  if (hdrChanged) {
    sh.getRange(1, 9, 1, 8).setValues([curHdr]);
  }
  if (sh.getLastRow() < 2) return;
  const maps = flotaLookup_();
  const numRows = sh.getLastRow() - 1;
  const rows = sh.getRange(2, 1, numRows, 16).getDisplayValues();
  const curIL = [], nextIL = [], curO = [], nextO = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowIL = [String(r[8] || ''), String(r[9] || ''), String(r[10] || ''), String(r[11] || '')];
    const rowO = [String(r[14] || '')];
    curIL.push(rowIL);
    curO.push(rowO);
    if (r.every(function(c) { return !String(c || '').trim(); })) {
      nextIL.push(rowIL.slice());
      nextO.push(rowO.slice());
      continue;
    }
    const auto = computeCurseAutoValues_(r, maps);
    nextIL.push([
      auto.telefon || rowIL[0],
      auto.rezerva || rowIL[1],
      auto.tipAuto || rowIL[2],
      auto.anFabricatie || rowIL[3]
    ]);
    nextO.push([auto.camioaneOriginal || rowO[0]]);
  }
  let wrote = false;
  if (JSON.stringify(curIL) !== JSON.stringify(nextIL)) {
    sh.getRange(2, 9, numRows, 2).setNumberFormat('@');
    sh.getRange(2, 9, numRows, 4).setValues(nextIL);
    wrote = true;
  }
  if (JSON.stringify(curO) !== JSON.stringify(nextO)) {
    sh.getRange(2, 15, numRows, 1).setValues(nextO);
    wrote = true;
  }
  if (wrote || hdrChanged) {
    invalidateCache_(TAB_CURSE);
    SpreadsheetApp.flush();
  }
}
function actualizeazaSheet1DinFlota() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(function(s) {
    if (s.getFrozenColumns() < 1) s.setFrozenColumns(1);
  });
  syncSheet1AutoFill_();
  refreshRemorciLibere_();
  refreshZileCurseCamion_();
}
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Dispecerat')
      .addItem('Completează I-O din Flotă (sheet 1)', 'actualizeazaSheet1DinFlota')
      .addItem('Recalculează zile curse camion', 'refreshZileCurseCamion_')
      .addItem('Recalculează totaluri concediu', 'actualizeazaTotaluriConcediu')
      .addToUi();
  } catch (err) {
    // ignore in non-UI contexts
  }
}
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  const name = sh.getName();
  const low = name.trim().toLowerCase();
  if (low === TAB_ISTORIC || low === TAB_IST_REM || low === TAB_LIBERE || low === TAB_TOTAL || low === 'zile curse camion') return;
  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  const startCol = e.range.getColumn();
  const numCols = e.range.getNumColumns();
  const endRow = startRow + numRows - 1;
  const endCol = startCol + numCols - 1;
  if (endRow <= 1) return;

  if (numRows === 1 && numCols === 1 && startRow > 1) {
    const oldVal = e.oldValue !== undefined ? String(e.oldValue) : '';
    const newVal = e.range.getDisplayValue();
    if (oldVal !== newVal) {
      const header = String(sh.getRange(1, startCol).getDisplayValue() || ('Col ' + startCol)).trim();
      const rowLabel = String(sh.getRange(startRow, 1).getDisplayValue() || '').trim();
      const prefix = rowLabel && startCol > 1 ? rowLabel + ' · ' : '';
      log_('Google Sheet', name, startRow, 'Editare Excel', prefix + header + ': ' + (oldVal || 'gol'), prefix + header + ': ' + (newVal || 'gol'));
    }
    if (low === TAB_CURSE && startCol === 2 && oldVal !== newVal) {
      const rowVals = sh.getRange(startRow, 1, 1, 16).getDisplayValues()[0];
      const camNew = (newVal.split('/')[0] || '').trim() || (oldVal.split('/')[0] || '').trim();
      const oldRem = (oldVal.split('/')[1] || '').trim();
      const newRem = (newVal.split('/')[1] || '').trim();
      logIstoricRemorci_(
        camNew,
        oldRem,
        newRem,
        '',
        rowVals[2],
        rowVals[3],
        rowVals[4],
        rowVals[7],
        rowVals[2],
        rowVals[3],
        rowVals[4],
        rowVals[7]
      );
    }
  }

  if (low === TAB_CURSE) {
    const touchesB = startCol <= 2 && endCol >= 2;
    const touchesC = startCol <= 3 && endCol >= 3;
    const touchesH = startCol <= 8 && endCol >= 8;
    const touchesI = startCol <= 9 && endCol >= 9;
    const touchesP = startCol <= 16 && endCol >= 16;
    if (touchesB || touchesH || touchesI) {
      const maps = flotaLookup_();
      const fromR = Math.max(2, startRow);
      for (let r = fromR; r <= endRow; r++) {
        if (touchesB) applyCurseAutoFillRow_(sh, r, 2, maps);
        if (touchesH) applyCurseAutoFillRow_(sh, r, 8, maps);
        else if (touchesI && numRows === 1 && numCols === 1) applyCurseAutoFillRow_(sh, r, 9, maps);
      }
    }
    if (touchesC || touchesP) {
      checkCurseLoadingDateWarning_(sh, Math.max(2, startRow), endRow, touchesC);
    }
  }
  if (esteConcediu_(name)) {
    const fromR = Math.max(2, startRow);
    for (let r = fromR; r <= endRow; r++) recalcConcediuRow_(sh, r);
  }
  if (low === TAB_FLOTA) syncSheet1AutoFill_();
  if (low === TAB_CURSE || low === TAB_FLOTA) {
    refreshRemorciLibere_();
    refreshZileCurseCamion_();
  }
}
function doGet(e) {
  if (!e || (e.parameter.key || '') !== PAROLA) return out_({ error: 'Parolă greșită' });
  if (e.parameter.recalc === '1') {
    syncSheet1AutoFill_();
    refreshRemorciLibere_();
    refreshZileCurseCamion_();
  }
  return out_({
    scriptVersion: '3.3',
    curse: vals_(TAB_CURSE, 16),
    vize: vizeRows_(),
    flota: vals_(TAB_FLOTA, 12),
    concediu: concediuRows_(),
    istoric: istoric_(),
    istoricRemorci: vals_(TAB_IST_REM, 17),
    zileCurse: vals_('zile curse camion', 14)
  });
}
function doPost(e) {
  const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  if ((b.key || '') !== PAROLA) return out_({ error: 'Parolă greșită' });
  if (b.action && b.action !== 'write') return out_({ error: 'Acțiune necunoscută' });
  const user = String(b.user || 'Dispecer').trim();
  const vals = Array.isArray(b.values) ? b.values : [];

  if (b.kind === 'curse') {
    const sh = sheet_(TAB_CURSE);
    if (!sh) return out_({ error: 'Foaia sheet 1 lipsește' });
    if (sh.getMaxColumns() < 16) {
      sh.insertColumnsAfter(sh.getMaxColumns(), 16 - sh.getMaxColumns());
    }
    const row = b.row ? Number(b.row) : sh.getLastRow() + 1;
    const oldRow = b.row ? sh.getRange(row, 1, 1, 16).getDisplayValues()[0] : [];
    const before = oldRow.length ? oldRow.join(' | ') : '';
    const v16 = Array.from({ length: 16 }, (_, i) => String(vals[i] || ''));
    const auto = computeCurseAutoValues_(v16);
    if (!v16[8]) v16[8] = auto.telefon;
    if (!v16[9]) v16[9] = auto.rezerva;
    if (!v16[10]) v16[10] = auto.tipAuto;
    if (!v16[11]) v16[11] = auto.anFabricatie;
    if (!v16[14]) v16[14] = auto.camioaneOriginal;
    const oldNr = String(oldRow[1] || '');
    const oldRem = (oldNr.split('/')[1] || '').trim();
    const newRem = (String(v16[1] || '').split('/')[1] || '').trim();
    const camNew = (String(v16[1] || '').split('/')[0] || '').trim() || (oldNr.split('/')[0] || '').trim();
    sh.getRange(row, 9, 1, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, 16).setValues([v16]);
    invalidateCache_(TAB_CURSE);
    const cellP = sh.getRange(row, 16);
    if (String(v16[15] || '').trim() || !String(v16[2] || '').trim() || /^(curte|sofer)$/i.test(plain_(v16[2]))) {
      if (cellP.getBackground() === '#fef3c7') cellP.setBackground(null);
    }
    log_(user, sh.getName(), row, b.row ? 'Modificare' : 'Adăugare', before, v16.join(' | '));
    const remChanged = (oldRem || newRem) && oldRem.toUpperCase() !== newRem.toUpperCase();
    if (remChanged) {
      logIstoricRemorci_(
        camNew,
        oldRem,
        newRem,
        String(b.loc || ''),
        oldRow[2] || '',
        oldRow[3] || '',
        oldRow[4] || '',
        oldRow[7] || '',
        v16[2] || '',
        v16[3] || '',
        v16[4] || '',
        v16[7] || ''
      );
      invalidateCache_(TAB_IST_REM);
    }
    const trailerAffectsLibere =
      !b.row ||
      remChanged ||
      String(oldRow[2] || '') !== v16[2] ||
      String(oldRow[3] || '') !== v16[3] ||
      String(oldRow[4] || '') !== v16[4] ||
      String(oldRow[7] || '') !== v16[7];
    if (trailerAffectsLibere) {
      refreshRemorciLibere_();
    }
    const datesAffectZile =
      !b.row ||
      oldNr !== v16[1] ||
      String(oldRow[2] || '') !== v16[2] ||
      String(oldRow[15] || '') !== v16[15];
    if (datesAffectZile) {
      refreshZileCurseCamion_();
    }
    return out_({ ok: true, row });
  }

  if (b.kind === 'flota') {
    const sh = sheet_(TAB_FLOTA);
    if (!sh) return out_({ error: 'Foaia flota lipsește' });
    const row = b.row ? Number(b.row) : sh.getLastRow() + 1;
    const oldRow = b.row ? sh.getRange(row, 1, 1, 12).getDisplayValues()[0] : [];
    const before = oldRow.length ? oldRow.join(' | ') : '';
    const v12 = Array.from({ length: 12 }, (_, i) => {
      const s = String(vals[i] || '');
      if (i === 10 || i === 11) {
        if (/^true$/i.test(s)) return true;
        if (/^false$/i.test(s)) return false;
      }
      return s;
    });
    sh.getRange(row, 1, 1, 12).setValues([v12]);
    invalidateCache_(TAB_FLOTA);
    log_(user, sh.getName(), row, b.row ? 'Modificare Flotă' : 'Adăugare Flotă', before, v12.map(function(x) { return String(x); }).join(' | '));
    syncSheet1AutoFill_();
    refreshRemorciLibere_();
    refreshZileCurseCamion_();
    return out_({ ok: true, row });
  }

  if (b.kind === 'vize') {
    const sh = sheet_(TAB_VIZE);
    if (!sh) return out_({ error: 'Foaia vize medicale lipsește' });
    const row = b.row ? Number(b.row) : sh.getLastRow() + 1;
    const before = b.row ? sh.getRange(row, 2, 1, 3).getDisplayValues()[0].join(' | ') : '';
    const v3 = [String(vals[0] || ''), String(vals[1] || ''), String(vals[2] || '')];
    if (!b.row) sh.getRange(row, 1).setValue(row - 1);
    sh.getRange(row, 2, 1, 3).setValues([v3]);
    log_(user, sh.getName(), row, b.row ? 'Modificare' : 'Adăugare', before, v3.join(' | '));
    return out_({ ok: true, row });
  }

  if (b.kind === 'concediu') {
    const sh = sheetConcediu_();
    if (!sh) return out_({ error: 'Foaia de concediu lipsește' });
    const nume = String(vals[0] || '').trim();
    if (!nume) return out_({ error: 'Numele șoferului lipsește' });

    const meta = concediuMeta_(sh, true);
    const lastRow = Math.max(sh.getLastRow(), 1);
    const names = sh.getRange(1, 1, lastRow, 1).getDisplayValues().map(r => r[0]);
    let row = names.findIndex((n, idx) => idx > 0 && norm_(n) === norm_(nume)) + 1;
    if (row <= 0) {
      row = lastRow + 1;
      sh.getRange(row, 1).setValue(nume);
    }

    const monthIdxNum = Number(vals[1]);
    if (!isNaN(monthIdxNum) && monthIdxNum >= 0 && monthIdxNum <= 11 && /^\d{1,2}$/.test(String(vals[1]).trim())) {
      const col = meta.monthCols[monthIdxNum] || (monthIdxNum + 2);
      const cellText = String(vals[2] || '').trim();
      const before = String(sh.getRange(row, col).getDisplayValue() || '').trim();
      sh.getRange(row, col).setValue(cellText);
      const monthName = meta.headers[col - 1] || LUNI[monthIdxNum].toUpperCase();
      recalcConcediuRow_(sh, row, meta);
      log_(user, sh.getName(), row, before ? 'Modificare' : 'Adăugare', nume + ' (' + monthName + ': ' + (before || 'gol') + ')', nume + ' (' + monthName + ': ' + (cellText || 'șters') + ')');
      return out_({ ok: true, row });
    }

    return out_({ error: 'Format lună/valoare invalid' });
  }

  return out_({ error: 'Acțiune necunoscută' });
}`

interface ConnectionModalProps {
  open: boolean;
  config: GasConfig;
  initialTab?: 'connect' | 'audit';
  scriptOutdated?: boolean;
  testing: boolean;
  error: string | null;
  onClose: () => void;
  onSaveAndConnect: (nextConfig: GasConfig) => Promise<void>;
  onSwitchToDemo: () => void;
}

export function ConnectionModal({
  open,
  config,
  initialTab = 'connect',
  scriptOutdated = false,
  testing,
  error,
  onClose,
  onSaveAndConnect,
  onSwitchToDemo,
}: ConnectionModalProps) {
  const [tab, setTab] = useState<'connect' | 'audit'>(initialTab);
  const [scriptUrl, setScriptUrl] = useState(config.scriptUrl);
  const [key, setKey] = useState(config.key);
  const [user, setUser] = useState(config.user);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setScriptUrl(config.scriptUrl);
    setKey(config.key);
    setUser(config.user);
    setCopied(false);
    setCopiedLink(false);
  }, [open, config, initialTab]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveAndConnect({
      scriptUrl: scriptUrl.trim(),
      key: key.trim(),
      user: user.trim() || 'Dispecer',
      mode: 'live',
    });
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(FULL_CODE_GS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleCopyPhoneLink = async () => {
    if (!scriptUrl.trim()) return;
    const params = new URLSearchParams({
      gas: scriptUrl.trim(),
      key: key.trim() || 'TRANSPORT',
      user: user.trim() || 'Dispecer',
    });
    const shareUrl = `${window.location.origin}/?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl pb-[env(safe-area-inset-bottom)]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Google Apps Script & Instalare Mobil
            </h2>
            <p className="text-xs text-slate-500">
              Conectare bidirecțională Google Sheets ↔ Aplicație pentru Curse, Vize și Concedii
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-4 border-b border-slate-200 flex gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab('connect')}
            className={`pb-2.5 border-b-2 transition-colors ${
              tab === 'connect'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Conectare Google Sheet
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`pb-2.5 border-b-2 transition-colors ${
              tab === 'audit'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Script Google (Code.gs) & iOS/Android
          </button>
        </div>

        {tab === 'connect' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {scriptOutdated && config.mode === 'live' && !error && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-2.5 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                  <span>
                    URL-ul actual răspunde cu o versiune mai veche a scriptului (fără v3.2: calcul automat zile lucrate din col. P → col. C, atenționare col. P și salvarea completă A–P).
                    În Apps Script alege <strong>Implementare → Gestionați implementările → Editați (creion) → Versiune nouă → Implementează</strong> sau lipește aici noul URL <code className="font-mono">/exec</code>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('audit')}
                  className="font-semibold underline whitespace-nowrap shrink-0"
                >
                  Vezi scriptul
                </button>
              </div>
            )}

            {config.mode === 'live' && !error && !scriptOutdated && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Conectat la Google Sheets Live (versiunea 3.3 bidirecțională).</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  URL aplicație web Google Apps Script
                </label>
                <input
                  type="url"
                  required
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Parolă script (<code className="font-mono">PAROLA</code>)
                  </label>
                  <input
                    type="password"
                    required
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="TRANSPORT"
                    className="w-full px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nume dispecer (<code className="font-mono">user</code> în istoric)
                  </label>
                  <input
                    type="text"
                    required
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="ex. Ion Popescu"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSwitchToDemo}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Folosește date demonstrative
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {scriptUrl.trim().startsWith('https://script.google.com/') && (
                  <button
                    type="button"
                    onClick={handleCopyPhoneLink}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Link telefon copiat!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiază link pt. telefon</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Închide
                </button>
                <button
                  type="submit"
                  disabled={testing}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
                >
                  {testing ? 'Se conectează...' : 'Conectează și sincronizează'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4 text-xs text-slate-700">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-amber-950">
              <div className="font-semibold">
                Important — de ce apare „Acțiune necunoscută” dacă doar apeși Salvează:
              </div>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>
                  În Apps Script, după ce lipești codul de mai jos și apeși <strong>Salvează</strong>, linkul <code className="font-mono">/exec</code> NU se actualizează singur.
                </li>
                <li>
                  Trebuie să apeși <strong>Implementare → Gestionați implementările → Editați (creion) → Versiune nouă → Implementează</strong>.
                </li>
                <li>
                  Dacă ai apăsat <em>Implementare nouă</em> în loc să editezi, copiază noul link <code className="font-mono">/exec</code> și lipește-l în tab-ul <strong>Conectare Google Sheet</strong>.
                </li>
              </ol>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">
                  1. Script complet Google Apps Script (`Code.gs`)
                </div>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copiat!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiază tot scriptul</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-slate-600">
                Sincronizează în ambele sensuri: modificările din aplicație ajung în Google Sheet, iar editările făcute direct în Google Sheet (<code className="font-mono">onEdit</code>) actualizează automat totalurile, remorcile libere și istoricul.
              </p>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto max-h-56 font-mono text-[11px] leading-relaxed">
                {FULL_CODE_GS}
              </pre>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-semibold text-slate-900">
                2. Instalare pe telefon (iOS & Android)
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>
                  <strong>iOS (Safari)</strong>: Apasă <strong>Partajare → Adaugă pe ecranul principal</strong>.
                </li>
                <li>
                  <strong>Android (Chrome)</strong>: Apasă butonul <strong>Instalează aplicația</strong> din bara de sus sau din meniu.
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Închide
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
