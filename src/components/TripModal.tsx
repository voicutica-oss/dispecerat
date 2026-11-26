import { AlertCircle, Flame, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { LeaveRecord, TripRecord } from '../types/fleet';
import {
  buildAdrDriversSet,
  computeFleetAutoFill,
  computeTripDays,
  fmtRoDate,
  hasDriverAdr,
  isFlotaSwapTag,
  isoToRoDate,
  normRemKey,
  normRo,
  parteNr,
  plainRo,
  roToIsoDate,
  SHEET1_DEFAULT_HEADERS,
  splitDrivers,
  todayRo,
} from '../utils/roDates';

interface TripModalProps {
  open: boolean;
  trip: TripRecord | null;
  allTrips: TripRecord[];
  headers: string[];
  flota: string[][];
  leaves: LeaveRecord[];
  istoricRemorci?: string[][];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    row?: number;
    values: string[];
    loc?: string;
  }) => Promise<void>;
}

export function TripModal({
  open,
  trip,
  allTrips,
  headers,
  flota,
  leaves,
  istoricRemorci = [],
  saving,
  error,
  onClose,
  onSave,
}: TripModalProps) {
  const [idVal, setIdVal] = useState('');
  const [camion, setCamion] = useState('');
  const [remorca, setRemorca] = useState('');
  const [hasSlash, setHasSlash] = useState(true);
  const [sofer1, setSofer1] = useState('');
  const [sofer2, setSofer2] = useState('');
  const [dataText, setDataText] = useState('');
  const [tara, setTara] = useState('');
  const [localitate, setLocalitate] = useState('');
  const [detalii, setDetalii] = useState('');
  const [obs, setObs] = useState('');
  const [telefon, setTelefon] = useState('');
  const [rezerva, setRezerva] = useState('');
  const [tipAuto, setTipAuto] = useState('');
  const [anFabricatie, setAnFabricatie] = useState('');
  const [perioadaEstimata, setPerioadaEstimata] = useState('');
  const [garajDin, setGarajDin] = useState('');
  const [camioaneOriginal, setCamioaneOriginal] = useState('');
  const [dataIncarcarii, setDataIncarcarii] = useState('');
  const [locSwap, setLocSwap] = useState('');
  const [autoFilledTrailer, setAutoFilledTrailer] = useState<string | null>(
    null
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const adrDrivers = useMemo(() => buildAdrDriversSet(flota), [flota]);

  const fleetLists = useMemo(() => {
    const trucks = new Set<string>();
    const trailers = new Set<string>();
    const drivers = new Set<string>();
    const trailerNotes: Record<string, string> = {};

    for (let i = 1; i < flota.length; i++) {
      const c = String(flota[i]?.[0] || '').trim();
      const r = String(flota[i]?.[1] || '').trim();
      const s = String(flota[i]?.[2] || '').trim();
      const n = String(flota[i]?.[3] || '').trim();
      if (c) trucks.add(c);
      if (r) {
        trailers.add(r);
        const nk = normRemKey(r);
        if (n && nk) trailerNotes[nk] = n;
      }
      if (s) drivers.add(s);
    }

    // Also include existing trucks/drivers from sheet 1 and trailers from istoric remorci
    allTrips.forEach((t) => {
      if (t.camion) trucks.add(t.camion);
      if (t.remorca && !/^schimb/i.test(t.remorca)) trailers.add(t.remorca);
      splitDrivers(t.sofer).forEach((d) => drivers.add(d));
    });
    istoricRemorci.slice(1).forEach((row) => {
      const rPred = String(row[2] || '').trim();
      const rPrel = String(row[3] || '').trim();
      if (rPred && !/^schimb/i.test(rPred)) trailers.add(rPred);
      if (rPrel && !/^schimb/i.test(rPrel)) trailers.add(rPrel);
    });

    return {
      trucks: Array.from(trucks).sort((a, b) => a.localeCompare(b)),
      trailers: Array.from(trailers).sort((a, b) => a.localeCompare(b)),
      drivers: Array.from(drivers).sort((a, b) => a.localeCompare(b)),
      trailerNotes,
    };
  }, [flota, allTrips, istoricRemorci]);

  const trailerLatestData = useMemo(() => {
    const map: Record<
      string,
      { dataDesc: string; tara: string; localitate: string }
    > = {};

    // 1. From istoric remorci (oldest -> newest so latest wins)
    istoricRemorci.slice(1).forEach((row) => {
      const rPred = String(row[2] || '').trim();
      const kPred = normRemKey(rPred);
      if (kPred && !/^schimb/i.test(rPred)) {
        const taraP = String(row[7] || '').trim();
        const locP = String(row[8] || '').trim();
        const dataP = String(row[9] || '').trim();
        if (dataP || taraP || locP) {
          map[kPred] = {
            dataDesc: dataP,
            tara: taraP,
            localitate: locP,
          };
        }
      }
      const rPrel = String(row[3] || '').trim();
      const kPrel = normRemKey(rPrel);
      if (kPrel && !/^schimb/i.test(rPrel)) {
        const taraN = String(row[14] || '').trim();
        const locN = String(row[15] || '').trim();
        const dataN = String(row[16] || '').trim();
        if (dataN || taraN || locN) {
          map[kPrel] = {
            dataDesc: dataN,
            tara: taraN,
            localitate: locN,
          };
        }
      }
    });

    // 2. From live sheet 1 trips (excluding the row currently being edited)
    allTrips.forEach((t) => {
      if (trip && t.rowIndex === trip.rowIndex) return;
      const rem = (t.remorca || '').trim();
      const kRem = normRemKey(rem);
      if (!kRem || /^schimb/i.test(rem)) return;
      const dataD = String(t.cells[2] || '').trim();
      const taraD = String(t.cells[3] || '').trim();
      const locD = String(t.cells[4] || '').trim();
      if (dataD || taraD || locD) {
        map[kRem] = {
          dataDesc: dataD,
          tara: taraD,
          localitate: locD,
        };
      }
    });

    return map;
  }, [istoricRemorci, allTrips, trip]);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setAutoFilledTrailer(null);
    setLocSwap('');
    if (trip) {
      const rawNr = trip.cells[1] || '';
      const { camion: c, remorca: r } = parteNr(rawNr);
      const [s1 = '', s2 = ''] = splitDrivers(trip.cells[7]);
      const auto = computeFleetAutoFill(
        { camion: c, remorca: r, soferi: trip.cells[7] },
        flota
      );
      setIdVal(trip.cells[0] || '');
      setCamion(c);
      setRemorca(r);
      setHasSlash(rawNr.includes('/'));
      setSofer1(s1);
      setSofer2(s2);
      setDataText(trip.cells[2] || '');
      setTara(trip.cells[3] || '');
      setLocalitate(trip.cells[4] || '');
      setDetalii(trip.cells[5] || '');
      setObs(trip.cells[6] || '');
      setTelefon(trip.cells[8] || auto.telefon);
      setRezerva(trip.cells[9] || auto.rezerva);
      setTipAuto(trip.cells[10] || auto.tipAuto);
      setAnFabricatie(trip.cells[11] || auto.anFabricatie);
      setPerioadaEstimata(trip.cells[12] || '');
      setGarajDin(trip.cells[13] || '');
      setCamioaneOriginal(trip.cells[14] || auto.camioaneOriginal);
      setDataIncarcarii(trip.cells[15] || '');
    } else {
      const maxId = allTrips.reduce((max, t) => {
        const parsed = parseInt(t.cells[0], 10);
        return !Number.isNaN(parsed) && parsed > max ? parsed : max;
      }, 0);
      setIdVal(maxId > 0 ? String(maxId + 1) : '1');
      setCamion('');
      setRemorca('');
      setHasSlash(true);
      setSofer1('');
      setSofer2('');
      setDataText(fmtRoDate(todayRo()));
      setTara('');
      setLocalitate('');
      setDetalii('');
      setObs('');
      setTelefon('');
      setRezerva('');
      setTipAuto('');
      setAnFabricatie('');
      setPerioadaEstimata('');
      setGarajDin('');
      setCamioaneOriginal('');
      setDataIncarcarii('');
    }
  }, [open, trip, allTrips, flota]);

  if (!open) return null;

  const oldTrailer = trip ? parteNr(trip.cells[1]).remorca : '';
  const isOldSwap = /^schimb/i.test(oldTrailer);
  const isNewSwap = /^schimb/i.test(remorca.trim());
  const trailerChanged =
    !isOldSwap &&
    !isNewSwap &&
    remorca.trim().toUpperCase() !== oldTrailer.trim().toUpperCase() &&
    Boolean(remorca.trim() || oldTrailer.trim());
  const existingSwapped =
    Boolean(trip && oldTrailer && remorca.trim() && !isOldSwap && !isNewSwap) &&
    remorca.trim().toUpperCase() !== oldTrailer.trim().toUpperCase();

  const handleCamionChange = (nextCamion: string) => {
    setCamion(nextCamion);
    const auto = computeFleetAutoFill(
      { camion: nextCamion, remorca, soferi: `${sofer1}, ${sofer2}` },
      flota
    );
    if (!nextCamion.trim()) {
      setAnFabricatie('');
      setCamioaneOriginal('');
    } else {
      if (auto.anFabricatie) setAnFabricatie(auto.anFabricatie);
      else if (!trip?.cells[11]) setAnFabricatie('');
      if (auto.camioaneOriginal) setCamioaneOriginal(auto.camioaneOriginal);
      else if (!trip?.cells[14]) setCamioaneOriginal('');
    }
  };

  const handleTrailerChange = (nextRem: string) => {
    setRemorca(nextRem);
    const trimmed = nextRem.trim();
    const key = normRemKey(trimmed);
    const isSameAsOld = Boolean(trip) && key === normRemKey(oldTrailer);

    const auto = computeFleetAutoFill(
      { camion, remorca: nextRem, soferi: `${sofer1}, ${sofer2}` },
      flota
    );
    if (!trimmed || /^schimb/i.test(trimmed)) {
      setTipAuto('');
    } else if (auto.tipAuto) {
      setTipAuto(auto.tipAuto);
    } else if (!isSameAsOld) {
      setTipAuto('');
    }

    if (!trimmed || /^schimb/i.test(trimmed) || isSameAsOld) {
      if (autoFilledTrailer && trip) {
        setDataText(trip.cells[2] || '');
        setTara(trip.cells[3] || '');
        setLocalitate(trip.cells[4] || '');
      }
      setAutoFilledTrailer(null);
      return;
    }

    const found = key ? trailerLatestData[key] : undefined;
    if (found) {
      if (found.dataDesc) setDataText(found.dataDesc);
      if (found.tara) setTara(found.tara);
      if (found.localitate) setLocalitate(found.localitate);
      setAutoFilledTrailer(trimmed);
    } else if (autoFilledTrailer) {
      if (trip) {
        setDataText(trip.cells[2] || '');
        setTara(trip.cells[3] || '');
        setLocalitate(trip.cells[4] || '');
      }
      setAutoFilledTrailer(null);
    }
  };

  const handleDriversChange = (nextS1: string, nextS2: string) => {
    setSofer1(nextS1);
    setSofer2(nextS2);
    const combined = [nextS1.trim(), nextS2.trim()].filter(Boolean).join(', ');
    if (!combined) {
      setTelefon('');
      setRezerva('');
      return;
    }
    const auto = computeFleetAutoFill(
      { camion, remorca, soferi: combined },
      flota
    );
    if (auto.telefon || auto.rezerva) {
      setTelefon(auto.telefon);
      setRezerva(auto.rezerva);
    }
  };

  // Live hints: driver leave overlap + trailer Flotă col D status
  const liveHints: string[] = [];
  const today = todayRo();
  const limit14 = new Date(today.getTime() + 14 * 86400000);
  [sofer1, sofer2]
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((drv) => {
      const k = normRo(drv);
      const matchLeave = leaves.find(
        (l) =>
          normRo(l.nume) === k &&
          l.endDate &&
          l.startDate &&
          l.endDate >= today &&
          l.startDate <= limit14
      );
      if (matchLeave) {
        const msg =
          matchLeave.startDate && matchLeave.startDate <= today
            ? `în concediu (${matchLeave.type}) până la ${matchLeave.endStr}`
            : `concediu ${matchLeave.type} din ${matchLeave.startStr}`;
        liveHints.push(`${drv}: ${msg}`);
      }
    });
  const selectedTrailerKey = normRemKey(remorca);
  const remNote =
    (selectedTrailerKey && fleetLists.trailerNotes[selectedTrailerKey]) ||
    (!remorca.trim() || /^schimb/i.test(remorca.trim())
      ? fleetLists.trailerNotes[normRemKey(camion)] || ''
      : '');
  const remNoteIsSwap = isFlotaSwapTag(remNote);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!camion.trim() && !remorca.trim()) {
      setLocalError('Introdu cel puțin numărul camionului sau al remorcii.');
      return;
    }

    const statusLower = plainRo(dataText);
    const isSpecialStatus =
      statusLower === 'curte' || statusLower === 'sofer' || isNewSwap;

    if (!isSpecialStatus && !dataIncarcarii.trim()) {
      setLocalError(
        'Data încărcării (coloana P) este obligatorie înainte de salvare.'
      );
      return;
    }

    if (trailerChanged && !locSwap.trim()) {
      setLocalError(
        'Localitatea predării/preluării remorcii este obligatorie (coloana F din istoric remorci).'
      );
      return;
    }

    if (
      existingSwapped &&
      !isSpecialStatus &&
      (!tara.trim() || !localitate.trim())
    ) {
      setLocalError(
        'Remorcă schimbată: completează data, țara și localitatea noii curse.'
      );
      return;
    }

    const nr = remorca.trim()
      ? `${camion.trim()}/${remorca.trim()}`
      : hasSlash
        ? `${camion.trim()}/`
        : camion.trim();

    const soferi = [sofer1.trim(), sofer2.trim()]
      .filter((s, idx, arr) => Boolean(s) && arr.indexOf(s) === idx)
      .join(', ');

    const autoFallback = computeFleetAutoFill(
      { camion: camion.trim(), remorca: remorca.trim(), soferi },
      flota
    );

    const values = [
      idVal.trim(),
      nr,
      dataText.trim(),
      tara.trim(),
      localitate.trim(),
      detalii.trim(),
      obs.trim(),
      soferi,
      telefon.trim() || autoFallback.telefon,
      rezerva.trim() || autoFallback.rezerva,
      tipAuto.trim() || autoFallback.tipAuto,
      anFabricatie.trim() || autoFallback.anFabricatie,
      perioadaEstimata.trim(),
      garajDin.trim(),
      camioaneOriginal.trim() || autoFallback.camioaneOriginal,
      dataIncarcarii.trim(),
    ];

    await onSave({
      row: trip ? trip.rowIndex : undefined,
      values,
      loc: locSwap.trim() || undefined,
    });
  };

  const labelFor = (idx: number, fallback?: string) =>
    headers[idx] && headers[idx].trim()
      ? headers[idx].trim()
      : fallback || SHEET1_DEFAULT_HEADERS[idx] || `Col ${idx + 1}`;

  const displayError = localError || error;
  const isoPickerValue = roToIsoDate(dataText);
  const isoLoadingPickerValue = roToIsoDate(dataIncarcarii);
  const dataLowerLive = plainRo(dataText);
  const loadingRequired =
    dataLowerLive !== 'curte' && dataLowerLive !== 'sofer' && !isNewSwap;
  const sofer1Adr = hasDriverAdr(sofer1, adrDrivers);
  const sofer2Adr = hasDriverAdr(sofer2, adrDrivers);
  const liveTripDays = computeTripDays(dataIncarcarii, dataText);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl pb-[env(safe-area-inset-bottom)]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {trip ? `Editează rândul ${trip.rowIndex}` : 'Cursă nouă'}
            </h2>
            <p className="text-xs text-slate-500">
              Coloane compatibile 1:1 cu „sheet 1” (A–P, cu auto-completare din Flotă)
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {displayError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {labelFor(0, 'id')}
              </label>
              <input
                type="text"
                value={idVal}
                onChange={(e) => setIdVal(e.target.value)}
                placeholder="ex. 148 (sau gol la SCHIMB)"
                className="w-full px-3 py-2.5 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Camion ({labelFor(1, 'Nr camion')})
              </label>
              <input
                type="text"
                list="fleet-trucks-list"
                value={camion}
                onChange={(e) => handleCamionChange(e.target.value)}
                placeholder="ex. SB-01-TLN"
                className="w-full px-3 py-2.5 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <datalist id="fleet-trucks-list">
                {fleetLists.trucks.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Remorcă / SCHIMB
              </label>
              <input
                type="text"
                list="fleet-trailers-list"
                value={remorca}
                onChange={(e) => handleTrailerChange(e.target.value)}
                placeholder="ex. SB-09-TAL sau SCHIMB"
                className="w-full px-3 py-2.5 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <datalist id="fleet-trailers-list">
                {fleetLists.trailers.map((r) => {
                  const note = fleetLists.trailerNotes[normRemKey(r)];
                  return (
                    <option key={r} value={r}>
                      {note ? `${r} · ${note}` : r}
                    </option>
                  );
                })}
                <option value="SCHIMB" />
                <option value="SCHIMB TARA" />
              </datalist>
            </div>
          </div>

          {remNote && (
            <div
              className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs ${
                remNoteIsSwap
                  ? 'bg-blue-50 border-blue-200 text-blue-950'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div>
                <span className="font-semibold">Flotă (coloana D):</span>{' '}
                Remorca{' '}
                <span className="font-mono font-semibold">
                  {(remorca.trim() || camion.trim()).toUpperCase()}
                </span>{' '}
                are statusul în Flotă:
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded font-semibold uppercase tracking-wide text-[11px] border ${
                  remNoteIsSwap
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-800 border-slate-300'
                }`}
              >
                {remNote}
              </span>
            </div>
          )}

          {existingSwapped && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="font-semibold">
                Schimbare remorcă detectată ({oldTrailer} → {remorca})
              </div>
              <div>
                Remorca predată <strong>{oldTrailer}</strong> a descărcat:{' '}
                {trip?.cells[2] || '—'} · {trip?.cells[3] || '—'} ·{' '}
                {trip?.cells[4] || '—'}. Aceste date merg în istoric; mai jos
                poți verifica sau edita datele pentru noua remorcă.
              </div>
              {autoFilledTrailer && (
                <div className="pt-1 font-medium text-blue-800">
                  Datele (data descărcării, țara, localitatea) au fost completate automat pentru remorca {autoFilledTrailer} și pot fi editate liber mai jos.
                </div>
              )}
            </div>
          )}

          {!existingSwapped && autoFilledTrailer && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
              Datele (data descărcării, țara, localitatea) au fost preluate automat pentru remorca <strong>{autoFilledTrailer}</strong> și le poți edita mai jos.
            </div>
          )}

          {trailerChanged && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
              <label className="block text-xs font-medium text-blue-900">
                Localitatea predării/preluării remorcii * <span className="font-normal text-blue-700">(obligatoriu în aplicație · coloana F din istoric remorci)</span>
              </label>
              <input
                type="text"
                required
                value={locSwap}
                onChange={(e) => setLocSwap(e.target.value)}
                placeholder="ex. Sibiu / Arad / Curtici"
                className="w-full px-3 py-2 text-sm bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs font-medium text-slate-700">
                  {labelFor(7, 'nume sofer')} (Șofer 1)
                </label>
                {sofer1Adr && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 text-[10px] font-bold">
                    <Flame className="h-3 w-3 text-orange-600" />
                    ADR
                  </span>
                )}
              </div>
              <input
                type="text"
                list="fleet-drivers-list"
                value={sofer1}
                onChange={(e) => handleDriversChange(e.target.value, sofer2)}
                placeholder="ex. PACURARIU MIHAIL-DANIEL"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <datalist id="fleet-drivers-list">
                {fleetLists.drivers.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-xs font-medium text-slate-700">
                  Șofer 2 (opțional · echipaj dublu)
                </label>
                {sofer2Adr && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 text-[10px] font-bold">
                    <Flame className="h-3 w-3 text-orange-600" />
                    ADR
                  </span>
                )}
              </div>
              <input
                type="text"
                list="fleet-drivers-list"
                value={sofer2}
                onChange={(e) => handleDriversChange(sofer1, e.target.value)}
                placeholder="opțional"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {liveHints.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              {liveHints.map((h, i) => (
                <div key={i}>{h}</div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={
                loadingRequired && !dataIncarcarii.trim()
                  ? 'p-3 rounded-lg border border-amber-300 bg-amber-50/50'
                  : 'p-3 rounded-lg border border-slate-200 bg-slate-50/50'
              }
            >
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-800">
                  P · {labelFor(15, 'data incarcarii')}{' '}
                  {loadingRequired ? (
                    <span className="text-red-600 font-bold">*</span>
                  ) : (
                    <span className="text-[11px] font-normal text-slate-500">
                      (opțional)
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setDataIncarcarii(fmtRoDate(todayRo()))}
                  className="text-[11px] text-blue-700 hover:underline font-medium"
                >
                  Azi
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required={loadingRequired}
                  value={dataIncarcarii}
                  onChange={(e) => setDataIncarcarii(e.target.value)}
                  placeholder="zz.ll.aaaa (obligatoriu)"
                  className="flex-1 min-w-0 px-3 py-2.5 bg-white font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <input
                  type="date"
                  value={isoLoadingPickerValue}
                  onChange={(e) => {
                    if (e.target.value) setDataIncarcarii(isoToRoDate(e.target.value));
                  }}
                  aria-label="Alege data încărcării din calendar"
                  className="w-[44px] px-2 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-800">
                  C · {labelFor(2, 'data descarcarii')}
                </label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDataText(fmtRoDate(todayRo()))}
                    className="text-blue-700 hover:underline font-medium"
                  >
                    Azi
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setDataText('curte')}
                    className="text-amber-700 hover:underline font-medium"
                  >
                    curte
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setDataText('sofer')}
                    className="text-amber-700 hover:underline font-medium"
                  >
                    sofer
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dataText}
                  onChange={(e) => setDataText(e.target.value)}
                  placeholder="zz.ll.aaaa, curte sau sofer"
                  className="flex-1 min-w-0 px-3 py-2.5 bg-white font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <input
                  type="date"
                  value={isoPickerValue}
                  onChange={(e) => {
                    if (e.target.value) setDataText(isoToRoDate(e.target.value));
                  }}
                  aria-label="Alege data descărcării din calendar"
                  className="w-[44px] px-2 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {liveTripDays && (
            <div className="px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between gap-2">
              <span>
                Durată cursă calculată:{' '}
                <strong>
                  {liveTripDays.days} {liveTripDays.days === 1 ? 'zi' : 'zile'}
                </strong>
              </span>
              <span className="font-mono text-[11px] text-blue-700 tabular-nums">
                {fmtRoDate(liveTripDays.startDate)} → {fmtRoDate(liveTripDays.endDate)}
                {liveTripDays.ongoing ? ' (până azi)' : ''}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {labelFor(3, 'tara')}
              </label>
              <input
                type="text"
                value={tara}
                onChange={(e) => setTara(e.target.value)}
                placeholder="RO, DE, FR..."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="sm:col-span-9">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {labelFor(4, 'localitatea')}
              </label>
              <input
                type="text"
                value={localitate}
                onChange={(e) => setLocalitate(e.target.value)}
                placeholder="ex. DE-26723 EMDEN/06:00"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {labelFor(5, 'detalii')}
              </label>
              <textarea
                rows={2}
                value={detalii}
                onChange={(e) => setDetalii(e.target.value)}
                placeholder="ex. NICA, MIRCEA-ABC, PREIA??"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {labelFor(6, 'observații')}
              </label>
              <textarea
                rows={2}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="ex. PLECAT CU SB26TTA, CO, SCHIMB ULEI"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Date flotă & detalii suplimentare (coloanele I–O)
              </span>
              <span className="text-[11px] text-slate-500">
                I, J, K, L, O se completează automat din Flotă
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  I · {labelFor(8)}
                </label>
                <input
                  type="text"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  placeholder="auto din Flotă E"
                  className="w-full px-3 py-2 bg-white font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  J · {labelFor(9)}
                </label>
                <input
                  type="text"
                  value={rezerva}
                  onChange={(e) => setRezerva(e.target.value)}
                  placeholder="auto din Flotă F"
                  className="w-full px-3 py-2 bg-white font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  K · {labelFor(10)}
                </label>
                <input
                  type="text"
                  value={tipAuto}
                  onChange={(e) => setTipAuto(e.target.value)}
                  placeholder="auto din Flotă H (remorcă)"
                  className="w-full px-3 py-2 bg-white font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  L · {labelFor(11)}
                </label>
                <input
                  type="text"
                  value={anFabricatie}
                  onChange={(e) => setAnFabricatie(e.target.value)}
                  placeholder="auto din Flotă G (camion)"
                  className="w-full px-3 py-2 bg-white font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  M · {labelFor(12)}
                </label>
                <input
                  type="text"
                  value={perioadaEstimata}
                  onChange={(e) => setPerioadaEstimata(e.target.value)}
                  placeholder="ex. 5 zile"
                  className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  N · {labelFor(13)}
                </label>
                <input
                  type="text"
                  value={garajDin}
                  onChange={(e) => setGarajDin(e.target.value)}
                  placeholder="ex. Sibiu"
                  className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  O · {labelFor(14)}
                </label>
                <input
                  type="text"
                  value={camioaneOriginal}
                  onChange={(e) => setCamioaneOriginal(e.target.value)}
                  placeholder="auto din Flotă A/B (camion/remorcă titulară)"
                  className="w-full px-3 py-2 bg-white font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {displayError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Se salvează...' : trip ? 'Salvează modificările' : 'Adaugă cursa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
