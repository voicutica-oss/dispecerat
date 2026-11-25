import { ArrowRight, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  FreeTrailer,
  LeaveRecord,
  NavTab,
  TripRecord,
  VisaRecord,
} from '../types/fleet';
import {
  diffDaysFromToday,
  LEAVE_TYPE_META,
  normRo,
  splitDrivers,
} from '../utils/roDates';
import { CountryFlag } from './CountryFlag';
import { SyncedScrollTable } from './SyncedScrollTable';
import { TripsDistributionChart } from './TripsDistributionChart';

interface OverviewViewProps {
  trips: TripRecord[];
  freeTrailers: FreeTrailer[];
  visas: VisaRecord[];
  leaves: LeaveRecord[];
  history: string[][];
  flota?: string[][];
  istoricRemorci?: string[][];
  onNavigate: (tab: NavTab) => void;
  onEditTrip: (trip: TripRecord) => void;
  onEditVisa: (visa: VisaRecord) => void;
  onEnableNotifications: () => Promise<void>;
  notifPermission: NotificationPermission | 'unsupported';
}

const ALERTS_HIDDEN_KEY = 'dispecerat_alerts_hidden_v1';

export function OverviewView({
  trips,
  freeTrailers,
  visas,
  leaves,
  history,
  flota = [],
  istoricRemorci = [],
  onNavigate,
  onEditTrip,
  onEditVisa,
  onEnableNotifications,
  notifPermission,
}: OverviewViewProps) {
  const [alertsHidden, setAlertsHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ALERTS_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [expandedAlert, setExpandedAlert] = useState<'v' | 'c' | null>(null);
  const [selectedAlertCountry, setSelectedAlertCountry] = useState<string | null>(
    null
  );

  const toggleAlertsHidden = () => {
    setAlertsHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ALERTS_HIDDEN_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const tripsWithTractor = trips.filter((t) => Boolean(t.camion.trim()));
  const activeTrips = tripsWithTractor.filter((t) => t.isActive);

  // Urgent unloadings: 0..2 days (only active trips with both tara and localitatea)
  const urgentUnloadings = trips
    .map((t) => {
      if (!t.isActive) return null;
      const days = t.dataDescDate ? diffDaysFromToday(t.dataDescDate) : null;
      return days !== null && days >= 0 && days <= 2 ? { trip: t, days } : null;
    })
    .filter((x): x is { trip: TripRecord; days: number } => Boolean(x))
    .sort((a, b) => a.days - b.days);

  // Drivers currently in active trips
  const activeTripByDriver = new Map<string, TripRecord>();
  trips.forEach((t) => {
    if (t.isActive && t.sofer) {
      splitDrivers(t.sofer).forEach((drv) => {
        activeTripByDriver.set(normRo(drv), t);
      });
    }
  });
  const driversInTrips = new Set(activeTripByDriver.keys());

  const getLeaveStatus = (l: LeaveRecord) => {
    const activeTrip = activeTripByDriver.get(normRo(l.nume));
    const conflict = Boolean(
      activeTrip &&
        activeTrip.dataDescDate &&
        l.startDate &&
        l.endDate &&
        activeTrip.dataDescDate >= l.startDate &&
        activeTrip.dataDescDate <= l.endDate
    );
    if (conflict && activeTrip) {
      return {
        conflict: true,
        label: `Conflict cursă activă (${activeTrip.dataDesc})`,
        cls: 'text-red-600 font-medium',
        rank: 0,
      };
    }
    if (l.isActiveToday) {
      return {
        conflict: false,
        label: `Absent azi (${l.type})`,
        cls: 'text-blue-700 font-medium',
        rank: 1,
      };
    }
    if (l.isUpcoming) {
      return {
        conflict: false,
        label: 'Programat în 14 zile',
        cls: 'text-amber-700 font-medium',
        rank: 2,
      };
    }
    return {
      conflict: false,
      label: 'Planificat / Efectuat',
      cls: 'text-slate-500',
      rank: 3,
    };
  };

  const urgentVisas7 = visas
    .filter((v) => v.daysLeft !== null && v.daysLeft <= 7)
    .map((v) => ({
      visa: v,
      inTrips: driversInTrips.has(normRo(v.cells[1])),
    }))
    .sort((a, b) => (a.visa.daysLeft ?? 999) - (b.visa.daysLeft ?? 999));

  const urgentVisas30 = visas
    .filter((v) => v.status === 'expired' || v.status === 'expiring')
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));

  const activeOrUpcomingLeaves = leaves
    .map((l) => ({ leave: l, status: getLeaveStatus(l) }))
    .filter(
      ({ leave, status }) =>
        status.conflict || leave.isActiveToday || leave.isUpcoming
    )
    .sort((a, b) => {
      if (a.status.rank !== b.status.rank) return a.status.rank - b.status.rank;
      const tA = a.leave.startDate ? a.leave.startDate.getTime() : 0;
      const tB = b.leave.startDate ? b.leave.startDate.getTime() : 0;
      return tA - tB;
    });
  const activeLeavesCount = leaves.filter((l) => l.isActiveToday).length;
  const leaveConflictsCount = activeOrUpcomingLeaves.filter(
    (x) => x.status.conflict
  ).length;

  const dayLabel = (n: number) =>
    n === 0 ? 'AZI' : n === 1 ? 'MÂINE' : n === 2 ? 'POIMÂINE' : `în ${n} zile`;

  const urgentUnloadingsByCountry = useMemo(() => {
    const map = new Map<string, Array<{ trip: TripRecord; days: number }>>();
    for (const item of urgentUnloadings) {
      const country =
        String(item.trip.tara || '').trim().toUpperCase() || 'Fără țară';
      const arr = map.get(country) || [];
      arr.push(item);
      map.set(country, arr);
    }
    return Array.from(map.entries())
      .map(([country, items]) => ({ country, items }))
      .sort((a, b) => b.items.length - a.items.length || a.country.localeCompare(b.country));
  }, [urgentUnloadings]);

  const selectedAlertCountryItems = useMemo(() => {
    if (!selectedAlertCountry) return [];
    return (
      urgentUnloadingsByCountry.find((c) => c.country === selectedAlertCountry)
        ?.items || []
    );
  }, [urgentUnloadingsByCountry, selectedAlertCountry]);

  const hasAlerts =
    urgentUnloadings.length > 0 ||
    urgentVisas7.some((x) => x.inTrips) ||
    activeOrUpcomingLeaves.length > 0;

  return (
    <div className="space-y-6">
      {hasAlerts && (
        <section
          aria-label="Alerte operative"
          className="bg-red-50/80 border border-red-200 rounded-lg p-4 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-red-900">
              Alerte operative imediate
            </h2>
            <div className="flex items-center gap-2">
              {notifPermission === 'default' && (
                <button
                  type="button"
                  onClick={onEnableNotifications}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors whitespace-nowrap"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>Activează notificările</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleAlertsHidden}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-900 bg-white/80 border border-red-200 rounded-lg hover:bg-white transition-colors whitespace-nowrap"
              >
                {alertsHidden ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>Arată</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Ascunde</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {!alertsHidden && (
            <div className="space-y-2 text-xs text-red-900">
              {urgentUnloadings.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {urgentUnloadings.length}{' '}
                      {urgentUnloadings.length === 1
                        ? 'camion descarcă'
                        : 'camioane descarcă'}{' '}
                      în următoarele 2 zile:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {urgentUnloadingsByCountry.map(({ country, items }) => {
                        const active = selectedAlertCountry === country;
                        return (
                          <button
                            key={country}
                            type="button"
                            onClick={() =>
                              setSelectedAlertCountry((prev) =>
                                prev === country ? null : country
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border transition-colors tabular-nums ${
                              active
                                ? 'bg-red-700 text-white border-red-700'
                                : 'bg-white text-red-900 border-red-200 hover:bg-red-100'
                            }`}
                          >
                            <CountryFlag code={country} className="w-3.5 h-2.5" />
                            <span>
                              {country} {items.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedAlertCountry && selectedAlertCountryItems.length > 0 && (
                    <div className="mt-1.5 pl-3 border-l-2 border-red-300 space-y-1 text-red-800">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-red-900">
                        <span className="inline-flex items-center gap-1.5">
                          <CountryFlag code={selectedAlertCountry} className="w-3.5 h-2.5" />
                          <span>
                            Detalii {selectedAlertCountry} ({selectedAlertCountryItems.length})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedAlertCountry(null)}
                          className="underline font-medium text-red-800"
                        >
                          Ascunde
                        </button>
                      </div>
                      {selectedAlertCountryItems.map(({ trip, days }) => (
                        <div key={trip.rowIndex}>
                          <strong>{trip.camion || trip.cells[1]}</strong> ·{' '}
                          {trip.sofer || 'Fără șofer'} · {trip.localitate || '—'} ·{' '}
                          <strong>{dayLabel(days)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {urgentVisas7.filter((x) => x.inTrips).length > 0 && (
                <div>
                  <span className="font-semibold">
                    {urgentVisas7.filter((x) => x.inTrips).length} documente de
                    șoferi în curse expiră în ≤ 7 zile
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAlert(expandedAlert === 'v' ? null : 'v')
                    }
                    className="ml-2 underline font-medium text-red-800"
                  >
                    {expandedAlert === 'v' ? 'Ascunde' : 'Arată care'}
                  </button>
                  {expandedAlert === 'v' && (
                    <div className="mt-1.5 pl-3 space-y-1 text-red-800">
                      {urgentVisas7
                        .filter((x) => x.inTrips)
                        .map(({ visa }) => (
                          <div key={visa.rowIndex}>
                            <strong>{visa.cells[1]}</strong> · {visa.cells[2]} ·{' '}
                            <strong>
                              {(visa.daysLeft ?? 0) < 0
                                ? `EXPIRAT de ${Math.abs(visa.daysLeft ?? 0)} zile`
                                : visa.daysLeft === 0
                                  ? 'expiră AZI'
                                  : `expiră în ${visa.daysLeft} zile`}
                            </strong>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {activeOrUpcomingLeaves.length > 0 && (
                <div>
                  <span className="font-semibold">
                    {activeOrUpcomingLeaves.length}{' '}
                    {activeOrUpcomingLeaves.length === 1
                      ? 'șofer cu concediu'
                      : 'șoferi cu concediu'}{' '}
                    în următoarele 14 zile
                    {leaveConflictsCount > 0
                      ? ` (${leaveConflictsCount} cu conflict cursă activă)`
                      : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAlert(expandedAlert === 'c' ? null : 'c')
                    }
                    className="ml-2 underline font-medium text-red-800"
                  >
                    {expandedAlert === 'c' ? 'Ascunde' : 'Arată care'}
                  </button>
                  {expandedAlert === 'c' && (
                    <div className="mt-1.5 pl-3 space-y-1 text-red-800">
                      {activeOrUpcomingLeaves.map(({ leave: l, status }, idx) => (
                        <div key={`${l.nume}-${idx}`}>
                          <strong>{l.nume}</strong> · {l.type} ·{' '}
                          {l.startStr === l.endStr
                            ? l.startStr
                            : `${l.startStr} – ${l.endStr}`}{' '}
                          · <strong>{status.label}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4-column KPI Strip */}
      <section
        aria-label="Indicatori principali"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <button
          type="button"
          onClick={() => onNavigate('curse')}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">Curse active</div>
          <div className="mt-2 font-display text-3xl font-semibold text-slate-900 tabular-nums">
            {activeTrips.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            din {tripsWithTractor.length} camioane ·{' '}
            {
              tripsWithTractor.filter(
                (t) => t.statusType === 'yard' || t.statusType === 'driver_wait'
              ).length
            }{' '}
            în curte / fără șofer
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('remorci_libere')}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">Remorci libere</div>
          <div className="mt-2 font-display text-3xl font-semibold text-slate-900 tabular-nums">
            {freeTrailers.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            disponibile pentru alocare
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('vize')}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">
            Vize expirate sau ≤ 30 zile
          </div>
          <div
            className={`mt-2 font-display text-3xl font-semibold tabular-nums ${
              urgentVisas30.some((v) => v.status === 'expired')
                ? 'text-red-600'
                : urgentVisas30.length > 0
                  ? 'text-amber-600'
                  : 'text-slate-900'
            }`}
          >
            {urgentVisas30.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {urgentVisas30.filter((v) => v.status === 'expired').length} expirate ·{' '}
            {urgentVisas30.filter((v) => v.status === 'expiring').length} în curând
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('concedii')}
          className="p-5 text-left hover:bg-slate-50/80 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">
            Șoferi în concediu azi
          </div>
          <div className="mt-2 font-display text-3xl font-semibold text-slate-900 tabular-nums">
            {activeLeavesCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {leaveConflictsCount > 0 ? (
              <span className="text-red-600 font-medium">
                {leaveConflictsCount}{' '}
                {leaveConflictsCount === 1
                  ? 'conflict cursă activă'
                  : 'conflicte curse active'}
              </span>
            ) : (
              `${leaves.filter((l) => l.isUpcoming).length} programate în 14 zile`
            )}
          </div>
        </button>
      </section>

      <TripsDistributionChart
        trips={trips}
        flota={flota}
        istoricRemorci={istoricRemorci}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Curse active și programate
              </h2>
              <p className="text-xs text-slate-500">
                Data descărcării ≥ azi, cu țară și localitate completate
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('curse')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              <span>Vezi toate</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {activeTrips.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nu există curse active pentru astăzi sau zilele următoare.
            </div>
          ) : (
            <SyncedScrollTable maxHeightClass="max-h-[380px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Camion / Remorcă
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Destinație
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Descărcare
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Șofer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeTrips.slice(0, 6).map((trip) => (
                    <tr
                      key={trip.rowIndex}
                      onClick={() => onEditTrip(trip)}
                      className="group hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                        {trip.cells[1] || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                          <CountryFlag code={trip.tara} className="w-4 h-3" />
                          <span>{trip.tara || '—'}</span>
                        </span>
                        {trip.localitate ? (
                          <span className="text-slate-500"> · {trip.localitate}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                        {trip.dataDesc || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {trip.sofer || (
                          <span className="text-amber-700 text-xs">Nealocat</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncedScrollTable>
          )}
        </section>

        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Remorci libere
              </h2>
              <p className="text-xs text-slate-500">
                Ordonate de la cea mai veche neutilizare
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('remorci_libere')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              <span>Vezi toate</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {freeTrailers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Toate remorcile din flotă sunt alocate în curse active.
            </div>
          ) : (
            <SyncedScrollTable maxHeightClass="max-h-[380px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Remorcă
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Nefolosită din
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-2.5 px-4 whitespace-nowrap">
                      Ultimul șofer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {freeTrailers.slice(0, 6).map((item) => (
                    <tr key={item.remorca} className="group hover:bg-slate-50">
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 py-2.5 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                        {item.remorca}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        {item.nefolositaDin}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {item.ultimulSofer || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncedScrollTable>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Alerte vize și documente
              </h2>
              <p className="text-xs text-slate-500">
                Documente expirate sau care expiră în următoarele 30 de zile
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('vize')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              <span>Gestionează</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {urgentVisas30.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Toate vizele medicale sunt valabile peste 30 de zile.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {urgentVisas30.slice(0, 5).map((v) => (
                <div
                  key={v.rowIndex}
                  onClick={() => onEditVisa(v)}
                  className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {v.cells[1] || 'Șofer necunoscut'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {v.cells[2] || 'Document'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-medium tabular-nums ${
                        v.status === 'expired' ? 'text-red-600' : 'text-amber-700'
                      }`}
                    >
                      {v.status === 'expired'
                        ? `Expirată (${Math.abs(v.daysLeft || 0)} zile)`
                        : v.daysLeft === 0
                          ? 'Expiră azi'
                          : `Expiră în ${v.daysLeft} zile`}
                    </div>
                    <div className="font-mono text-xs text-slate-500 tabular-nums">
                      {v.cells[3] || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Concedii curente și apropiate
              </h2>
              <p className="text-xs text-slate-500">
                Concedii active azi sau cu început în următoarele 14 zile
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('concedii')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              <span>Calendar</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {activeOrUpcomingLeaves.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Niciun șofer nu are concediu activ sau programat în următoarele 14 zile.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeOrUpcomingLeaves.slice(0, 6).map(({ leave: l, status }, idx) => (
                <div
                  key={`${l.nume}-${l.type}-${l.startStr}-${idx}`}
                  onClick={() => onNavigate('concedii')}
                  className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {l.nume}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {l.daysCount} {l.daysCount === 1 ? 'zi calendaristică' : 'zile calendaristice'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs ${status.cls}`}>
                      {status.label}
                    </div>
                    <div className="inline-flex items-center justify-end gap-1.5 font-mono text-xs text-slate-500 tabular-nums mt-0.5">
                      <span
                        className={`px-1 py-0.5 text-[10px] font-semibold border rounded ${LEAVE_TYPE_META[l.type].badgeClass}`}
                      >
                        {l.type}
                      </span>
                      <span>
                        {l.startStr === l.endStr
                          ? l.startStr
                          : `${l.startStr} – ${l.endStr}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div className="border-t border-slate-200 px-5 py-2.5 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate">
                Ultima acțiune: {history[history.length - 1]?.[1] || '—'} ·{' '}
                {history[history.length - 1]?.[2] || '—'} (
                {history[history.length - 1]?.[4] || '—'})
              </span>
              <button
                type="button"
                onClick={() => onNavigate('istoric')}
                className="text-blue-700 hover:text-blue-800 font-medium whitespace-nowrap ml-3"
              >
                Istoric
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
