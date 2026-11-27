const PAROLA = 'TRANSPORT';
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
  const list = sheets_();
  let found = list.find(s => s.getName().trim().toLowerCase() === k);
  if (!found && k === 'sheet 1') {
    found = list.find(s => s.getName().trim().toLowerCase() === 'sheet1');
  }
  return found;
}
function vals_(n, cols) {
  const cacheKey = n.toLowerCase() + ':' + cols;
  if (_valsCache[cacheKey]) return _valsCache[cacheKey];
  const sh = sheet_(n);
  if (!sh) return [];
  const maxCols = Math.max(sh.getMaxColumns(), 1);
  const reqCols = Math.min(Math.max(sh.getLastColumn(), cols), maxCols);
  const raw = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), reqCols).getDisplayValues();
  const data = reqCols < cols
    ? raw.map(function(r) {
        const copy = r.slice();
        while (copy.length < cols) copy.push('');
        return copy;
      })
    : raw;
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
    txt.split(/;|\r?\n/).forEach(clause => {
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
  const fl = vals_(TAB_FLOTA, 12), cu = vals_(TAB_CURSE, 16), ir = vals_(TAB_IST_REM, 19);
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
  const ir = vals_(TAB_IST_REM, 19);
  const azi = azi_();
  const trucksSet = {};
  for (let i = 1; i < fl.length; i++) {
    const cam = String(fl[i][0] || '').trim();
    const k = normKey_(cam);
    if (k && !trucksSet[k]) trucksSet[k] = cam;
  }
  for (let i = 1; i < cu.length; i++) {
    const nrCam = String(cu[i][1] || '').split('/')[0].trim();
    const k = normKey_(nrCam);
    if (k && !trucksSet[k]) trucksSet[k] = nrCam;
  }

  const daySets = {};
  function addRange(tKey, sD, eD) {
    if (!tKey || !sD || !eD) return;
    const span = Math.round((eD.getTime() - sD.getTime()) / 86400000) + 1;
    if (span <= 0 || span > 180) return;
    if (!daySets[tKey]) daySets[tKey] = {};
    for (let d = new Date(sD.getTime()); d <= eD; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === AN_CONCEDIU) {
        const dk = d.getMonth() + '-' + d.getDate();
        daySets[tKey][dk] = true;
      }
    }
  }

  const pickupsByTruckRem = {};
  function recordPickup(tCam, rKey, pDate) {
    const tKey = normKey_(tCam);
    if (!tKey || !rKey || !pDate) return;
    if (!trucksSet[tKey]) trucksSet[tKey] = tCam;
    const mapKey = tKey + '|' + rKey;
    if (!pickupsByTruckRem[mapKey]) pickupsByTruckRem[mapKey] = [];
    pickupsByTruckRem[mapKey].push(pDate);
  }

  const istHasHeader = ir.length > 0 && (plain_(ir[0] && ir[0][0]).indexOf('nr') >= 0 || plain_(ir[0] && ir[0][1]).indexOf('camion') >= 0);
  const istStartIdx = istHasHeader ? 1 : 0;

  for (let i = istStartIdx; i < ir.length; i++) {
    const r = ir[i] || [];
    const camHandover = String(r[1] || '').trim();
    const camHandoverKey = normKey_(camHandover);
    const remPred = normRem_(r[2] || '');
    const remPredKey = normKey_(remPred);
    const remPrel = normRem_(r[3] || '');
    const remPrelKey = normKey_(remPrel);

    if (r[11] && remPredKey) {
      recordPickup(String(r[11]).trim(), remPredKey, parseRo_(r[13]) || parseRo_(r[6]));
    }
    if (camHandoverKey && remPrelKey) {
      recordPickup(camHandover, remPrelKey, parseRo_(r[6]) || parseRo_(r[13]));
    }

    if (!camHandoverKey || !remPredKey) continue;
    if (!trucksSet[camHandoverKey]) trucksSet[camHandoverKey] = camHandover;

    const unloadRaw = String(r[9] || '').trim();
    const unloadLow = plain_(unloadRaw);
    const unloadIsSpecial = unloadLow === 'curte' || unloadLow === 'sofer' || unloadLow === 'fara sofer';
    const unloadD = unloadIsSpecial ? null : parseRo_(unloadRaw);
    const loadD = parseLoadingDate_(r[17], unloadD);
    const prevPickD = parseRo_(r[4]);
    const handoverD = parseRo_(r[6]);
    if (!loadD && !unloadD) continue;

    let segStart = null;
    if (loadD && prevPickD) {
      segStart = prevPickD > loadD ? prevPickD : loadD;
    } else {
      segStart = loadD || prevPickD || unloadD;
    }
    if (!segStart) continue;

    let segEnd = null;
    if (handoverD && unloadD && unloadD >= segStart) {
      segEnd = unloadD < handoverD ? unloadD : handoverD;
    } else {
      segEnd = handoverD || unloadD || segStart;
    }
    if (!segEnd || segEnd < segStart) continue;

    addRange(camHandoverKey, segStart, segEnd);
  }

  for (let i = 1; i < cu.length; i++) {
    const nr = String(cu[i][1] || '');
    const parts = nr.split('/');
    const cam = (parts[0] || '').trim();
    const rem = (parts[1] || '').trim();
    if (!cam || /^schimb/i.test(rem)) continue;
    const dataDescRaw = String(cu[i][2] || '').trim();
    const dataLow = plain_(dataDescRaw);
    if (dataLow === 'curte' || dataLow === 'sofer' || dataLow === 'fara sofer') continue;

    const key = normKey_(cam);
    if (!key) continue;
    if (!trucksSet[key]) trucksSet[key] = cam;

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

    const remKey = normKey_(normRem_(rem));
    if (remKey) {
      const pickups = pickupsByTruckRem[key + '|' + remKey];
      if (pickups && pickups.length > 0) {
        let latestPickupInTrip = null;
        for (let p = 0; p < pickups.length; p++) {
          const pDate = pickups[p];
          if (pDate >= startD && pDate <= endD) {
            if (!latestPickupInTrip || pDate > latestPickupInTrip) {
              latestPickupInTrip = pDate;
            }
          }
        }
        if (latestPickupInTrip && latestPickupInTrip > startD) {
          startD = latestPickupInTrip;
        }
      }
    }

    addRange(key, startD, endD);
  }

  const truckKeys = Object.keys(trucksSet).sort(function(a, b) {
    return trucksSet[a].localeCompare(trucksSet[b]);
  });

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
function ensureIstoricRemorciHeaders_(remSh) {
  if (!remSh) return;
  if (remSh.getMaxColumns() < 19) {
    remSh.insertColumnsAfter(remSh.getMaxColumns(), 19 - remSh.getMaxColumns());
  }
  if (remSh.getLastRow() >= 1) {
    const hdr = remSh.getRange(1, 18, 1, 2).getDisplayValues()[0];
    if (!String(hdr[0] || '').trim()) {
      remSh.getRange(1, 18).setValue('data incarcarii remorcii predate');
    }
    if (!String(hdr[1] || '').trim()) {
      remSh.getRange(1, 19).setValue('data incarcarii remorcii preluate');
    }
  }
}
function logIstoricRemorci_(camion, oldRemRaw, newRemRaw, swapLoc, oldData, oldTara, oldLoc, oldSofer, newData, newTara, newLoc, newSofer, oldDataInc, newDataInc) {
  const oldRem = normRem_(oldRemRaw);
  const newRem = normRem_(newRemRaw);
  const oldRemKey = normKey_(oldRem);
  const newRemKey = normKey_(newRem);
  if (!oldRemKey && !newRemKey) return;
  if (oldRemKey === newRemKey) return;

  let remSh = sheet_(TAB_IST_REM);
  if (!remSh) {
    remSh = ss_().insertSheet(TAB_IST_REM);
    registerSheet_(remSh);
    remSh.appendRow([
      'Nr crt', 'Nr camion', 'remorca predata', 'remorca preluata',
      'data preluarii', 'localitatea', 'data predarii', 'tara descarcarii',
      'localitatea', 'data descarcarii', 'sofer care preda', 'cap tractor',
      'sofer care preia', 'data preluarii', 'TARA', 'localitatea', 'data descarcareii',
      'data incarcarii remorcii predate', 'data incarcarii remorcii preluate'
    ]);
    remSh.setFrozenRows(1);
  } else {
    ensureIstoricRemorciHeaders_(remSh);
  }

  const todayStr = fmtRo_(azi_());
  const lastRow = Math.max(remSh.getLastRow(), 1);
  const rows = lastRow > 1 ? remSh.getRange(2, 1, lastRow - 1, 19).getDisplayValues() : [];

  let maxNr = 0;
  for (let i = 0; i < rows.length; i++) {
    const a = String(rows[i][0] || '').trim();
    if (/^\d+$/.test(a)) {
      const n = parseInt(a, 10);
      if (n > maxNr) maxNr = n;
    }
  }

  const cam = String(camion || '').trim();
  const camKey = normKey_(cam);
  const oldIncStr = String(oldDataInc || '').trim();
  const newIncStr = String(newDataInc || '').trim();
  let matchedPrevHandover = false;

  if (newRemKey) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (normKey_(rows[i][2]) === newRemKey && !String(rows[i][11] || '').trim()) {
        remSh.getRange(i + 2, 12, 1, 6).setValues([[
          cam,
          String(newSofer || '').trim(),
          todayStr,
          String(newTara || '').trim(),
          String(newLoc || '').trim(),
          String(newData || '').trim()
        ]]);
        if (newIncStr) {
          remSh.getRange(i + 2, 19).setValue(newIncStr);
        }
        matchedPrevHandover = true;
        break;
      }
    }
    if (!oldRemKey && !matchedPrevHandover) {
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
        String(newData || '').trim(),
        '',
        newIncStr
      ]);
      invalidateCache_(TAB_IST_REM);
      reconcileIstoricRemorci_();
      return;
    }
  }

  if (oldRemKey) {
    let dataPreluariiAnt = '';
    for (let i = rows.length - 1; i >= 0; i--) {
      const rCamKey = normKey_(rows[i][1]);
      const rPredKey = normKey_(rows[i][2]);
      const rPrelKey = normKey_(rows[i][3]);
      const rCapPreiaKey = normKey_(rows[i][11]);
      if (rCamKey === camKey && rPrelKey === oldRemKey) {
        dataPreluariiAnt = String(rows[i][13] || rows[i][6] || '').trim();
        break;
      }
      if (rPredKey === oldRemKey && rCapPreiaKey === camKey) {
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
      '',
      oldIncStr,
      ''
    ]);
  }
  invalidateCache_(TAB_IST_REM);
  reconcileIstoricRemorci_();
}

function reconcileIstoricRemorci_() {
  const remSh = sheet_(TAB_IST_REM);
  if (!remSh || remSh.getLastRow() < 2) return false;
  ensureIstoricRemorciHeaders_(remSh);
  const rawIst = vals_(TAB_IST_REM, 19);
  if (rawIst.length < 2) return false;

  const p0 = plain_(rawIst[0] && rawIst[0][0]);
  const p1 = plain_(rawIst[0] && rawIst[0][1]);
  const hasHeader = p0.indexOf('nr') >= 0 || p1.indexOf('camion') >= 0;
  const startIdx = hasHeader ? 1 : 0;

  let hasBlankNeed = false;
  for (let i = startIdx; i < rawIst.length; i++) {
    const r = rawIst[i] || [];
    if (normKey_(r[2]) && (!String(r[11] || '').trim() || !String(r[4] || '').trim() || !String(r[18] || '').trim())) {
      hasBlankNeed = true;
      break;
    }
  }
  if (!hasBlankNeed) return false;

  const curseRows = vals_(TAB_CURSE, 16);
  const liveByTruckRem = {};
  const liveByRem = {};
  for (let i = 1; i < curseRows.length; i++) {
    const r = curseRows[i] || [];
    const parts = String(r[1] || '').split('/');
    const cam = (parts[0] || '').trim();
    const rem = normRem_(parts[1] || '');
    const camKey = normKey_(cam);
    const remKey = normKey_(rem);
    if (!remKey) continue;
    const info = {
      cam: cam,
      camKey: camKey,
      sofer: String(r[7] || '').trim(),
      tara: String(r[3] || '').trim(),
      loc: String(r[4] || '').trim(),
      dataDesc: String(r[2] || '').trim(),
      dataInc: String(r[15] || '').trim()
    };
    if (camKey) liveByTruckRem[camKey + '|' + remKey] = info;
    if (!liveByRem[remKey]) liveByRem[remKey] = [];
    liveByRem[remKey].push(info);
  }

  const todayStr = fmtRo_(azi_());
  let updated = false;

  for (let i = startIdx; i < rawIst.length; i++) {
    const row = rawIst[i] || [];
    const remKey = normKey_(row[2]);
    const camKey = normKey_(row[1]);
    if (!remKey) continue;

    if (!String(row[4] || '').trim() && camKey) {
      let dataAnt = '';
      for (let j = i - 1; j >= Math.max(startIdx, i - 40); j--) {
        const jRow = rawIst[j] || [];
        const pCam = normKey_(jRow[1]);
        const pPrel = normKey_(jRow[3]);
        const pPred = normKey_(jRow[2]);
        const pCapPreia = normKey_(jRow[11]);
        if (pCam === camKey && pPrel === remKey) {
          dataAnt = String(jRow[13] || jRow[6] || '').trim();
          break;
        }
        if (pPred === remKey && pCapPreia === camKey) {
          dataAnt = String(jRow[13] || '').trim();
          break;
        }
      }
      if (dataAnt) {
        remSh.getRange(i + 1, 5).setValue(dataAnt);
        row[4] = dataAnt;
        updated = true;
      }
    }

    if (String(row[11] || '').trim()) {
      if (!String(row[18] || '').trim()) {
        const liveExisting = liveByTruckRem[normKey_(row[11]) + '|' + remKey];
        if (liveExisting && liveExisting.dataInc) {
          remSh.getRange(i + 1, 19).setValue(liveExisting.dataInc);
          row[18] = liveExisting.dataInc;
          updated = true;
        }
      }
      continue;
    }

    let matchedIdx = -1;
    for (let j = i + 1; j < rawIst.length; j++) {
      if (normKey_(rawIst[j][2]) === remKey) break;
      if (normKey_(rawIst[j][3]) === remKey && normKey_(rawIst[j][1]) !== camKey) {
        matchedIdx = j;
        break;
      }
    }

    if (matchedIdx < 0) {
      const handoverDate = parseRo_(row[6]);
      for (let j = i - 1; j >= Math.max(startIdx, i - 30); j--) {
        if (normKey_(rawIst[j][2]) === remKey) break;
        const jCamKey = normKey_(rawIst[j][1]);
        if (normKey_(rawIst[j][3]) === remKey && jCamKey !== camKey) {
          const jDate = parseRo_(rawIst[j][6]);
          const closeDates =
            String(rawIst[j][6] || '').trim() === String(row[6] || '').trim() ||
            Boolean(handoverDate && jDate && Math.abs(handoverDate.getTime() - jDate.getTime()) <= 3 * 86400000);
          const activeInSheet1 = Boolean(liveByTruckRem[jCamKey + '|' + remKey]);
          if (closeDates || activeInSheet1) {
            matchedIdx = j;
            break;
          }
        }
      }
    }

    if (matchedIdx >= 0) {
      const jRow = rawIst[matchedIdx] || [];
      const pickupCam = String(jRow[1] || '').trim();
      const pickupKey = normKey_(pickupCam);
      const live = liveByTruckRem[pickupKey + '|' + remKey];
      const pickupDate = String(jRow[6] || jRow[13] || row[6] || todayStr).trim();
      const valsLQ = [
        pickupCam,
        live ? live.sofer : String(jRow[12] || '').trim(),
        pickupDate,
        live ? live.tara : String(jRow[14] || '').trim(),
        live ? live.loc : String(jRow[15] || '').trim(),
        live ? live.dataDesc : String(jRow[16] || '').trim()
      ];
      remSh.getRange(i + 1, 12, 1, 6).setValues([valsLQ]);
      for (let c = 0; c < 6; c++) row[11 + c] = valsLQ[c];
      const pickupLoad = (live && live.dataInc) || String(jRow[18] || '').trim();
      if (pickupLoad && !String(row[18] || '').trim()) {
        remSh.getRange(i + 1, 19).setValue(pickupLoad);
        row[18] = pickupLoad;
      }
      updated = true;
      continue;
    }

    let hasLaterHandover = false;
    for (let k = i + 1; k < rawIst.length; k++) {
      if (normKey_(rawIst[k][2]) === remKey) {
        hasLaterHandover = true;
        break;
      }
    }
    if (!hasLaterHandover) {
      const candidates = liveByRem[remKey] || [];
      const cand = candidates.find(function(c) { return c.camKey && c.camKey !== camKey; });
      if (cand) {
        const valsLQ2 = [
          cand.cam,
          cand.sofer,
          String(row[6] || '').trim() || todayStr,
          cand.tara,
          cand.loc,
          cand.dataDesc
        ];
        remSh.getRange(i + 1, 12, 1, 6).setValues([valsLQ2]);
        for (let c = 0; c < 6; c++) row[11 + c] = valsLQ2[c];
        if (cand.dataInc && !String(row[18] || '').trim()) {
          remSh.getRange(i + 1, 19).setValue(cand.dataInc);
          row[18] = cand.dataInc;
        }
        updated = true;
      }
    }
  }

  if (updated) invalidateCache_(TAB_IST_REM);
  return updated;
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
  reconcileIstoricRemorci_();
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
      if (normKey_(normRem_(oldRem)) !== normKey_(normRem_(newRem))) {
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
          rowVals[7],
          rowVals[15],
          rowVals[15]
        );
      }
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
  reconcileIstoricRemorci_();
  return out_({
    scriptVersion: '3.7',
    curse: vals_(TAB_CURSE, 16),
    vize: vizeRows_(),
    flota: vals_(TAB_FLOTA, 12),
    concediu: concediuRows_(),
    istoric: istoric_(),
    istoricRemorci: vals_(TAB_IST_REM, 19),
    zileCurse: vals_('zile curse camion', 14)
  });
}

function vizeLayout_(sh) {
  const lastRow = Math.max(sh.getLastRow(), 1);
  const lastCol = Math.max(sh.getLastColumn(), 4);
  const grid = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  let headerIdx = -1, nrCol = -1, nameCol = -1, docCol = -1, dateCol = -1;
  for (let i = 0; i < Math.min(3, grid.length); i++) {
    const r = grid[i] || [];
    let cNr = -1, cN = -1, cD = -1, cDt = -1;
    for (let c = 0; c < r.length; c++) {
      const p = plain_(r[c]);
      if (!p) continue;
      if (cNr === -1 && (p === 'nr' || p === 'nr.' || p === 'nr crt' || p === 'crt')) cNr = c;
      else if (cN === -1 && (p.indexOf('nume') >= 0 || p.indexOf('sofer') >= 0 || p.indexOf('angajat') >= 0)) cN = c;
      else if (cD === -1 && (p.indexOf('doc') >= 0 || p.indexOf('tip') >= 0 || p.indexOf('viza') >= 0 || p.indexOf('aviz') >= 0 || p.indexOf('atestat') >= 0)) cD = c;
      else if (cDt === -1 && (p.indexOf('expir') >= 0 || p.indexOf('data') >= 0 || p.indexOf('valab') >= 0)) cDt = c;
    }
    if ([cN, cD, cDt].filter(function(x) { return x >= 0; }).length >= 2) {
      headerIdx = i; nrCol = cNr; nameCol = cN; docCol = cD; dateCol = cDt;
      break;
    }
  }
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1;
  if (nameCol === -1 || docCol === -1 || dateCol === -1) {
    const sample = grid.slice(startIdx, startIdx + 15);
    const hasCol3 = sample.some(function(r) { return Boolean(parseRo_(r[3])); });
    const hasCol2 = sample.some(function(r) { return Boolean(parseRo_(r[2])); });
    if (!hasCol3 && hasCol2) {
      if (nameCol === -1) nameCol = 0;
      if (docCol === -1) docCol = 1;
      if (dateCol === -1) dateCol = 2;
    } else {
      if (nrCol === -1) nrCol = 0;
      if (nameCol === -1) nameCol = 1;
      if (docCol === -1) docCol = 2;
      if (dateCol === -1) dateCol = 3;
    }
  }
  return { grid: grid, startRow: startIdx + 1, nrCol: nrCol, nameCol: nameCol, docCol: docCol, dateCol: dateCol };
}

function deleteVizeRowsSafe_(sh, rowMap, user, actionLabel) {
  const layout = vizeLayout_(sh);
  const grid = layout.grid;
  const rowsToDelete = Object.keys(rowMap).map(function(k) { return Number(k); }).filter(function(r) {
    return r >= layout.startRow && r <= grid.length;
  });
  if (rowsToDelete.length === 0) return 0;

  let lastName = '';
  const beforeSummaries = [];
  for (let i = layout.startRow - 1; i < grid.length; i++) {
    const rNum = i + 1;
    const row = grid[i] || [];
    const rawN = layout.nameCol >= 0 ? String(row[layout.nameCol] || '').trim() : '';
    const isNum = /^\d+[.)]?$/.test(rawN);
    if (rawN && !isNum) lastName = rawN;
    const effName = rawN && !isNum ? rawN : lastName;

    if (rowMap[rNum]) {
      beforeSummaries.push([effName, row[layout.docCol] || '', row[layout.dateCol] || ''].filter(Boolean).join(' - '));
    } else if (!rawN && effName && layout.nameCol >= 0 && i > 0 && rowMap[rNum - 1]) {
      sh.getRange(rNum, layout.nameCol + 1).setValue(effName);
    }
  }

  rowsToDelete.sort(function(a, b) { return b - a; });
  for (let j = 0; j < rowsToDelete.length; j++) {
    sh.deleteRow(rowsToDelete[j]);
  }
  invalidateCache_(TAB_VIZE);
  log_(user, sh.getName(), rowsToDelete.length, actionLabel, beforeSummaries.slice(0, 8).join('; ') + (beforeSummaries.length > 8 ? ' ...' : ''), rowsToDelete.length + ' rânduri șterse');
  return rowsToDelete.length;
}

function deleteDriverVisasIfRemoved_(driverName, user) {
  const targetKey = norm_(driverName);
  if (!targetKey) return;
  const fl = vals_(TAB_FLOTA, 12);
  for (let i = 1; i < fl.length; i++) {
    const c = String((fl[i] && fl[i][2]) || '').trim();
    if (!c) continue;
    if (norm_(c) === targetKey || splitDrivers_(c).some(function(p) { return norm_(p) === targetKey; })) {
      return;
    }
  }
  const shV = sheet_(TAB_VIZE);
  if (!shV || shV.getLastRow() < 2) return;
  const layout = vizeLayout_(shV);
  const grid = layout.grid;
  const rowMap = {};
  let lastName = '';
  for (let i = layout.startRow - 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const rawN = layout.nameCol >= 0 ? String(row[layout.nameCol] || '').trim() : '';
    const isNum = /^\d+[.)]?$/.test(rawN);
    if (rawN && !isNum) lastName = rawN;
    const effName = rawN && !isNum ? rawN : lastName;
    if (!effName) continue;
    if (norm_(effName) === targetKey || splitDrivers_(effName).some(function(p) { return norm_(p) === targetKey; })) {
      const hasContent = String(row[layout.docCol] || '').trim() || String(row[layout.dateCol] || '').trim() || rawN;
      if (hasContent) rowMap[i + 1] = true;
    }
  }
  deleteVizeRowsSafe_(shV, rowMap, user, 'Ștergere Vize (Șofer șters)');
}
function ensureRowCapacity_(sh, row) {
  if (sh && row > sh.getMaxRows()) {
    sh.insertRowsAfter(sh.getMaxRows(), row - sh.getMaxRows());
  }
}
function doPost(e) {
  try {
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
    ensureRowCapacity_(sh, row);
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
    const oldRemClean = normRem_(oldRem);
    const newRemClean = normRem_(newRem);
    const remChanged = (oldRemClean || newRemClean) && normKey_(oldRemClean) !== normKey_(newRemClean);
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
        v16[7] || '',
        oldRow[15] || '',
        v16[15] || ''
      );
      invalidateCache_(TAB_IST_REM);
    } else if (newRemClean && camNew) {
      const remSh = sheet_(TAB_IST_REM);
      if (remSh && remSh.getLastRow() >= 2) {
        ensureIstoricRemorciHeaders_(remSh);
        const istRows = vals_(TAB_IST_REM, 19);
        const todayStr = fmtRo_(azi_());
        const rKey = normKey_(newRemClean);
        const cKey = normKey_(camNew);
        for (let i = istRows.length - 1; i >= 1; i--) {
          if (
            normKey_(istRows[i][2]) === rKey &&
            normKey_(istRows[i][11]) === cKey &&
            String(istRows[i][13] || '').trim() === todayStr
          ) {
            remSh.getRange(i + 1, 13).setValue(v16[7] || '');
            remSh.getRange(i + 1, 15, 1, 3).setValues([[v16[3] || '', v16[4] || '', v16[2] || '']]);
            if (String(v16[15] || '').trim()) {
              remSh.getRange(i + 1, 19).setValue(String(v16[15] || '').trim());
            }
            invalidateCache_(TAB_IST_REM);
            break;
          }
        }
      }
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
    if (sh.getMaxColumns() < 12) {
      sh.insertColumnsAfter(sh.getMaxColumns(), 12 - sh.getMaxColumns());
    }
    const row = b.row ? Number(b.row) : sh.getLastRow() + 1;
    ensureRowCapacity_(sh, row);
    const oldRow = b.row ? sh.getRange(row, 1, 1, 12).getDisplayValues()[0] : [];
    const before = oldRow.length ? oldRow.join(' | ') : '';
    const deletedDriverTarget = String(b.deleteDriverVisas || '').trim();
    if (b.deleteRow && b.row && row >= 2 && row <= sh.getLastRow()) {
      sh.deleteRow(row);
      invalidateCache_(TAB_FLOTA);
      log_(user, sh.getName(), row, 'Ștergere Flotă', before, '');
      if (deletedDriverTarget) deleteDriverVisasIfRemoved_(deletedDriverTarget, user);
      syncSheet1AutoFill_();
      refreshRemorciLibere_();
      refreshZileCurseCamion_();
      return out_({ ok: true, row });
    }
    const v12 = Array.from({ length: 12 }, (_, i) => {
      const s = String(vals[i] || '');
      if (i === 10 || i === 11) {
        if (/^true$/i.test(s)) return true;
        if (/^false$/i.test(s)) return false;
      }
      return s;
    });
    sh.getRange(row, 5, 1, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, 12).setValues([v12]);
    invalidateCache_(TAB_FLOTA);
    log_(user, sh.getName(), row, b.row ? 'Modificare Flotă' : 'Adăugare Flotă', before, v12.map(function(x) { return String(x); }).join(' | '));
    if (deletedDriverTarget) deleteDriverVisasIfRemoved_(deletedDriverTarget, user);
    syncSheet1AutoFill_();
    refreshRemorciLibere_();
    refreshZileCurseCamion_();
    return out_({ ok: true, row });
  }

  if (b.kind === 'vize') {
    const sh = sheet_(TAB_VIZE);
    if (!sh) return out_({ error: 'Foaia vize medicale lipsește' });
    if (sh.getMaxColumns() < 4) {
      sh.insertColumnsAfter(sh.getMaxColumns(), 4 - sh.getMaxColumns());
    }

    if (Array.isArray(b.deleteRows) && b.deleteRows.length > 0) {
      const rowMap = {};
      for (let i = 0; i < b.deleteRows.length; i++) {
        const rn = Number(b.deleteRows[i]);
        if (!isNaN(rn) && rn >= 2) rowMap[rn] = true;
      }
      const deletedCount = deleteVizeRowsSafe_(sh, rowMap, user, 'Ștergere Vize');
      return out_({ ok: true, deletedCount: deletedCount });
    }

    if (Array.isArray(b.batchValues) && b.batchValues.length > 0) {
      const layout = vizeLayout_(sh);
      const startRow = Math.max(sh.getLastRow() + 1, 2);
      ensureRowCapacity_(sh, startRow + b.batchValues.length - 1);
      let maxNr = 0;
      if (layout.nrCol >= 0) {
        for (let r = layout.startRow - 1; r < layout.grid.length; r++) {
          const nVal = String((layout.grid[r] && layout.grid[r][layout.nrCol]) || '').trim();
          if (/^\d+$/.test(nVal)) {
            const parsedN = parseInt(nVal, 10);
            if (parsedN > maxNr) maxNr = parsedN;
          }
        }
      }
      const hasNr = layout.nrCol >= 0;
      const numCols = hasNr ? 4 : 3;
      const rowsToWrite = b.batchValues.map(function(item, idx) {
        const nm = String((item && item[0]) || '').trim();
        const dc = String((item && item[1]) || '').trim();
        const dt = String((item && item[2]) || '').trim();
        return hasNr ? [String(maxNr + idx + 1), nm, dc, dt] : [nm, dc, dt];
      });
      const dateSheetCol = hasNr ? 4 : 3;
      sh.getRange(startRow, dateSheetCol, rowsToWrite.length, 1).setNumberFormat('@');
      sh.getRange(startRow, 1, rowsToWrite.length, numCols).setValues(rowsToWrite);
      invalidateCache_(TAB_VIZE);
      log_(user, sh.getName(), startRow, 'Adăugare Excel (' + rowsToWrite.length + ')', '', rowsToWrite.length + ' vize importate din Excel');
      return out_({ ok: true, row: startRow, added: rowsToWrite.length });
    }

    const row = b.row ? Number(b.row) : sh.getLastRow() + 1;
    ensureRowCapacity_(sh, row);
    const before = b.row ? sh.getRange(row, 2, 1, 3).getDisplayValues()[0].join(' | ') : '';
    const v3 = [String(vals[0] || ''), String(vals[1] || ''), String(vals[2] || '')];
    if (!b.row) sh.getRange(row, 1).setValue(row - 1);
    sh.getRange(row, 4).setNumberFormat('@');
    sh.getRange(row, 2, 1, 3).setValues([v3]);
    invalidateCache_(TAB_VIZE);
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

  if (b.kind === 'istoricRemorci') {
    const sh = sheet_(TAB_IST_REM);
    if (!sh) return out_({ error: 'Foaia istoric remorci lipsește' });
    ensureIstoricRemorciHeaders_(sh);
    const row = b.row ? Number(b.row) : sh.getLastRow() + 1;
    ensureRowCapacity_(sh, row);
    const oldRow = b.row ? sh.getRange(row, 1, 1, 19).getDisplayValues()[0] : [];
    const before = oldRow.length ? oldRow.join(' | ') : '';
    const v19 = Array.from({ length: 19 }, (_, i) => String(vals[i] || ''));
    if (!v19[0]) {
      v19[0] = oldRow[0] ? String(oldRow[0]) : String(Math.max(1, row - 1));
    }
    sh.getRange(row, 1, 1, 19).setValues([v19]);
    invalidateCache_(TAB_IST_REM);
    log_(user, sh.getName(), row, b.row ? 'Modificare' : 'Adăugare', before, v19.join(' | '));
    refreshRemorciLibere_();
    refreshZileCurseCamion_();
    return out_({ ok: true, row });
  }

  return out_({ error: 'Acțiune necunoscută' });
  } catch (err) {
    return out_({ error: 'Eroare Apps Script: ' + (err && err.message ? err.message : String(err)) });
  }
}