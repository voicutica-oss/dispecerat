import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TripRecord } from '../types/fleet';
import {
  diffDaysFromToday,
  fmtRoDate,
  normRemKey,
  normRo,
  parseRoDate,
  splitDrivers,
  todayRo,
} from '../utils/roDates';
import {
  CountryFlag,
  CountrySvgGroup,
  hasSvgCountryFlag,
} from './CountryFlag';

interface TripsDistributionChartProps {
  trips: TripRecord[];
  flota?: string[][];
  istoricRemorci?: string[][];
}

type ChartMode = 'byCountry' | 'byDriver' | 'byTruck';
type TripScope = 'discharging' | 'all';

const CHART_HIDDEN_STORAGE_KEY = 'dispecerat_overview_chart_hidden_v1';
const NO_TRIP_KEY = 'Fără cursă';

const STACK_COLORS = [
  '#1d4ed8', // blue-700
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#e11d48', // rose-600
  '#4f46e5', // indigo-600
  '#0d9488', // teal-600
  '#64748b', // slate-500 (Altele)
];

const HORIZON_SERIES = [
  { key: 'Fără cursă', color: '#64748b' },
  { key: 'Fără dată / Alt status', color: '#0891b2' },
  { key: 'Finalizate', color: '#94a3b8' },
  { key: '0–2 zile', color: '#d97706' },
  { key: '3–4 zile', color: '#1d4ed8' },
  { key: '5–7 zile', color: '#059669' },
  { key: 'Peste 7 zile', color: '#7c3aed' },
] as const;

type HorizonKey = (typeof HORIZON_SERIES)[number]['key'];

interface CountryTruckItem {
  camion: string;
  remorca: string;
  driver: string;
  loc: string;
  dateText: string;
  country: string;
  daysLeft: number | null;
  horizon: HorizonKey;
}

interface TruckTooltipRow {
  unit: string;
  driver: string;
  loc: string;
  dateText: string;
  daysLabel: string;
}

interface CountryTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: {
      country?: string;
      _total?: number;
      trucksDetail?: TruckTooltipRow[];
    };
  }>;
}

function CountryChartTooltip({ active, label, payload }: CountryTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const meta = payload[0]?.payload;
  const country = meta?.country || String(label || '');
  const total =
    meta?._total ??
    payload.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const nonZero = payload.filter((p) => Number(p.value || 0) > 0);
  const details = meta?.trucksDetail || [];

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3.5 py-2.5 text-xs w-[300px] sm:w-[340px]">
      <div className="font-semibold text-slate-900 mb-1.5 border-b border-slate-100 pb-1 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5">
          {country !== NO_TRIP_KEY && (
            <CountryFlag code={country} className="w-4 h-3" />
          )}
          <span>{country === NO_TRIP_KEY ? NO_TRIP_KEY : `Țară: ${country}`}</span>
        </span>
        <span className="font-mono text-blue-700 tabular-nums">
          {total} {total === 1 ? 'camion' : 'camioane'}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
        {nonZero.map((entry, idx) => (
          <div key={`${entry.name}-${idx}`} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color || '#1d4ed8' }}
            />
            <span className="text-slate-600">{String(entry.name || '')}:</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {entry.value}
            </span>
          </div>
        ))}
      </div>

      {details.length > 0 && (
        <div className="pt-1.5 border-t border-slate-100 space-y-1.5 max-h-[240px] overflow-y-auto">
          {details.map((row, idx) => (
            <div
              key={`${row.unit}-${idx}`}
              className="flex items-start justify-between gap-2 text-[11px] leading-snug"
            >
              <div className="min-w-0">
                <div className="font-mono font-semibold text-slate-900 truncate">
                  {row.unit}
                </div>
                <div className="text-slate-600 truncate">
                  {row.driver}
                  {row.loc ? ` · ${row.loc}` : ''}
                </div>
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <div className="text-slate-800">{row.dateText}</div>
                <div className="text-blue-700 font-medium">{row.daysLabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CountryAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}

function CountryAxisTick({ x = 0, y = 0, payload }: CountryAxisTickProps) {
  const val = String(payload?.value || '');
  const showFlag = val !== NO_TRIP_KEY && hasSvgCountryFlag(val);
  return (
    <g transform={`translate(${x},${y})`}>
      {showFlag && <CountrySvgGroup code={val} x={-8} y={3} width={16} height={12} />}
      <text
        x={0}
        y={showFlag ? 24 : 15}
        textAnchor="middle"
        fill="#1e293b"
        fontSize={11}
        fontWeight={600}
      >
        {val}
      </text>
    </g>
  );
}

interface TripEvent {
  driver: string;
  truck: string;
  dateStr: string;
}

interface GenericTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name?: string | number;
    value?: number | string;
    color?: string;
    payload?: { fullLabel?: string; _total?: number };
  }>;
}

function StackedRangeTooltip({ active, label, payload }: GenericTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const fullLabel = payload[0]?.payload?.fullLabel || String(label || '');
  const total =
    payload[0]?.payload?._total ??
    payload.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const nonZero = payload.filter((p) => Number(p.value || 0) > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3.5 py-2.5 text-xs max-w-[280px]">
      <div className="font-semibold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
        {fullLabel}
      </div>
      <div className="space-y-1">
        {nonZero.map((entry, idx) => (
          <div
            key={`${entry.name}-${idx}`}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color || '#1d4ed8' }}
              />
              <span className="text-slate-700 truncate">{String(entry.name || '')}</span>
            </div>
            <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Total interval</span>
        <span className="font-mono font-semibold text-slate-900 tabular-nums">
          {total} {total === 1 ? 'cursă' : 'curse'}
        </span>
      </div>
    </div>
  );
}

function shortDriverLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  if (name.length <= 14) return name;
  return `${parts[0]} ${parts[1][0]}.`;
}

function getHorizonKey(daysLeft: number | null): HorizonKey {
  if (daysLeft === null) return 'Fără dată / Alt status';
  if (daysLeft < 0) return 'Finalizate';
  if (daysLeft <= 2) return '0–2 zile';
  if (daysLeft <= 4) return '3–4 zile';
  if (daysLeft <= 7) return '5–7 zile';
  return 'Peste 7 zile';
}

function toIsoInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseIsoInput(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function getCurrentMonthRange(): { from: string; to: string } {
  const azi = todayRo();
  const firstDay = new Date(azi.getFullYear(), azi.getMonth(), 1);
  const lastDay = new Date(azi.getFullYear(), azi.getMonth() + 1, 0);
  return {
    from: toIsoInput(firstDay),
    to: toIsoInput(lastDay),
  };
}

function loadInitialHidden(): boolean {
  try {
    return localStorage.getItem(CHART_HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function TripsDistributionChart({
  trips,
  flota = [],
  istoricRemorci = [],
}: TripsDistributionChartProps) {
  const defaultMonth = useMemo(() => getCurrentMonthRange(), []);
  const [chartHidden, setChartHidden] = useState<boolean>(loadInitialHidden);
  const [chartMode, setChartMode] = useState<ChartMode>('byCountry');
  const [tripScope, setTripScope] = useState<TripScope>('discharging');
  const [hideWithin2Days, setHideWithin2Days] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(defaultMonth.from);
  const [dateTo, setDateTo] = useState<string>(defaultMonth.to);

  const toggleChartHidden = () => {
    setChartHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CHART_HIDDEN_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const isDefaultCurrentMonth =
    dateFrom === defaultMonth.from && dateTo === defaultMonth.to;

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    const parsedFrom = parseIsoInput(dateFrom) || parseIsoInput(defaultMonth.from)!;
    const parsedTo = parseIsoInput(dateTo) || parseIsoInput(defaultMonth.to)!;
    const start = parsedFrom <= parsedTo ? parsedFrom : parsedTo;
    const end = parsedFrom <= parsedTo ? parsedTo : parsedFrom;
    return {
      rangeStart: start,
      rangeEnd: end,
      rangeLabel: `${fmtRoDate(start)} – ${fmtRoDate(end)}`,
    };
  }, [dateFrom, dateTo, defaultMonth]);

  // 1) Camioane pe țări + coloana "Fără cursă"
  const {
    visibleTruckCount,
    hiddenWithin2DaysCount,
    countryOptions,
    countryChartData,
    activeHorizons,
  } = useMemo(() => {
    const azi = todayRo();
    const isFutureOrCurrentWindow = rangeEnd >= azi;
    const allItems: CountryTruckItem[] = [];
    const seenCountryTruck = new Set<string>();
    const trucksWithActiveOrAssignedTrip = new Set<string>();
    const noTripSeen = new Set<string>();
    const idleCandidates: Array<{
      noTripId: string;
      truckNorm: string;
      item: CountryTruckItem;
    }> = [];

    for (const t of trips) {
      if (t.statusType === 'swap') continue;
      const truckName = String(t.camion || '').trim().toUpperCase();
      const remName = String(t.remorca || '').trim().toUpperCase();
      const truckNorm = normRemKey(truckName);
      const rawCountry = String(t.tara || '').trim().toUpperCase();
      const hasLoc = Boolean(String(t.localitate || '').trim());
      const hasUnloadingDest = Boolean(rawCountry && hasLoc);
      const isIdleRow =
        t.statusType === 'yard' ||
        t.statusType === 'driver_wait' ||
        !hasUnloadingDest;

      if (isIdleRow) {
        const noTripId = truckNorm || `row-${t.rowIndex}`;
        if (truckName && !noTripSeen.has(noTripId)) {
          noTripSeen.add(noTripId);
          idleCandidates.push({
            noTripId,
            truckNorm,
            item: {
              camion: truckName,
              remorca: remName,
              driver: t.sofer || 'Nealocat',
              loc: t.localitate ? t.localitate.split('/')[0].trim() : '',
              dateText:
                t.dataDesc ||
                (t.statusType === 'yard'
                  ? 'curte'
                  : t.statusType === 'driver_wait'
                    ? 'șofer'
                    : 'Fără descărcare'),
              country: NO_TRIP_KEY,
              daysLeft: null,
              horizon: 'Fără cursă',
            },
          });
        }
        continue;
      }

      if (truckNorm && (t.isActive || (t.dataDescDate && t.dataDescDate >= azi))) {
        trucksWithActiveOrAssignedTrip.add(truckNorm);
      }

      if (tripScope === 'discharging') {
        if (!t.dataDescDate) continue;
        if (t.dataDescDate < rangeStart || t.dataDescDate > rangeEnd) continue;
        const daysLeft = diffDaysFromToday(t.dataDescDate);
        if (isFutureOrCurrentWindow && daysLeft < 0) continue;

        const dedupKey = truckNorm
          ? `${truckNorm}|${rawCountry}`
          : `row-${t.rowIndex}`;
        if (seenCountryTruck.has(dedupKey)) continue;
        seenCountryTruck.add(dedupKey);

        allItems.push({
          camion: truckName || t.cells[1] || '—',
          remorca: remName,
          driver: t.sofer || 'Nealocat',
          loc: t.localitate ? t.localitate.split('/')[0].trim() : '',
          dateText: t.dataDesc || '—',
          country: rawCountry,
          daysLeft,
          horizon: getHorizonKey(daysLeft),
        });
      } else {
        // Toate cursele: doar cursele cu țară și localitate de descărcare
        if (t.dataDescDate) {
          if (t.dataDescDate < rangeStart || t.dataDescDate > rangeEnd) continue;
        }
        const daysLeft = t.dataDescDate ? diffDaysFromToday(t.dataDescDate) : null;
        const dedupKey = truckNorm
          ? `${truckNorm}|${rawCountry}`
          : `row-${t.rowIndex}`;
        if (seenCountryTruck.has(dedupKey)) continue;
        seenCountryTruck.add(dedupKey);
        if (truckNorm) trucksWithActiveOrAssignedTrip.add(truckNorm);

        allItems.push({
          camion: truckName || t.cells[1] || '—',
          remorca: remName,
          driver: t.sofer || 'Nealocat',
          loc: t.localitate ? t.localitate.split('/')[0].trim() : '',
          dateText: t.dataDesc || '—',
          country: rawCountry,
          daysLeft,
          horizon: getHorizonKey(daysLeft),
        });
      }
    }

    for (const cand of idleCandidates) {
      if (cand.truckNorm && trucksWithActiveOrAssignedTrip.has(cand.truckNorm)) {
        continue;
      }
      allItems.push(cand.item);
    }

    // Add trucks from Flotă that have no active/assigned trip and weren't already in noTripSeen
    for (let i = 1; i < flota.length; i++) {
      const fRow = flota[i] || [];
      const fTruck = String(fRow[0] || '').trim().toUpperCase();
      if (!fTruck) continue;
      const fNorm = normRemKey(fTruck);
      if (!fNorm) continue;
      if (trucksWithActiveOrAssignedTrip.has(fNorm)) continue;
      if (noTripSeen.has(fNorm)) continue;

      const hasAnyTrip = trips.some(
        (t) =>
          normRemKey(t.camion) === fNorm &&
          t.statusType !== 'yard' &&
          t.statusType !== 'driver_wait' &&
          t.statusType !== 'swap' &&
          Boolean(String(t.tara || '').trim()) &&
          Boolean(String(t.localitate || '').trim()) &&
          (tripScope === 'all' || Boolean(t.dataDescDate))
      );
      if (hasAnyTrip && tripScope === 'discharging') {
        const hasUpcoming = trips.some(
          (t) => normRemKey(t.camion) === fNorm && t.isActive
        );
        if (hasUpcoming) continue;
      } else if (hasAnyTrip) {
        continue;
      }

      noTripSeen.add(fNorm);
      allItems.push({
        camion: fTruck,
        remorca: String(fRow[1] || '').trim().toUpperCase(),
        driver: String(fRow[2] || '').trim() || 'Nealocat',
        loc: String(fRow[3] || '').trim() || 'Disponibil în flotă',
        dateText: 'Fără cursă',
        country: NO_TRIP_KEY,
        daysLeft: null,
        horizon: 'Fără cursă',
      });
    }

    const hiddenCount = allItems.filter(
      (item) =>
        item.country !== NO_TRIP_KEY &&
        item.daysLeft !== null &&
        item.daysLeft >= 0 &&
        item.daysLeft <= 2
    ).length;

    const visible = hideWithin2Days
      ? allItems.filter(
          (item) =>
            item.country === NO_TRIP_KEY ||
            item.daysLeft === null ||
            item.daysLeft < 0 ||
            item.daysLeft > 2
        )
      : allItems;

    const byCountryMap = new Map<string, CountryTruckItem[]>();
    for (const item of visible) {
      const arr = byCountryMap.get(item.country) || [];
      arr.push(item);
      byCountryMap.set(item.country, arr);
    }

    const sortedCountries = Array.from(byCountryMap.entries())
      .map(([country, items]) => ({
        country,
        count: items.length,
        items: [...items].sort(
          (a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)
        ),
      }))
      .sort((a, b) => {
        if (a.country === NO_TRIP_KEY) return 1;
        if (b.country === NO_TRIP_KEY) return -1;
        return b.count - a.count || a.country.localeCompare(b.country);
      });

    const effectiveCountry =
      selectedCountry !== 'ALL' && byCountryMap.has(selectedCountry)
        ? selectedCountry
        : 'ALL';

    const chartCountries =
      effectiveCountry === 'ALL'
        ? sortedCountries
        : sortedCountries.filter((c) => c.country === effectiveCountry);

    const usedHorizons = new Set<HorizonKey>();

    const chartRows = chartCountries.map(({ country, items }) => {
      const counts: Record<HorizonKey, number> = {
        'Fără cursă': 0,
        'Fără dată / Alt status': 0,
        Finalizate: 0,
        '0–2 zile': 0,
        '3–4 zile': 0,
        '5–7 zile': 0,
        'Peste 7 zile': 0,
      };

      const trucksDetail: TruckTooltipRow[] = items.map((it) => {
        counts[it.horizon] += 1;
        usedHorizons.add(it.horizon);
        return {
          unit: `${it.camion}${it.remorca ? `/${it.remorca}` : ''}`,
          driver: it.driver,
          loc: it.loc,
          dateText: it.dateText,
          daysLabel:
            it.country === NO_TRIP_KEY
              ? 'fără cursă'
              : it.daysLeft === null
                ? 'fără dată'
                : it.daysLeft < 0
                  ? `acum ${Math.abs(it.daysLeft)}z`
                  : it.daysLeft === 0
                    ? 'azi'
                    : it.daysLeft === 1
                      ? '1 zi'
                      : `${it.daysLeft} zile`,
        };
      });

      return {
        country,
        _total: items.length,
        trucksDetail,
        ...counts,
      };
    });

    const visibleHorizons = HORIZON_SERIES.filter((h) => usedHorizons.has(h.key));

    return {
      visibleTruckCount: visible.length,
      hiddenWithin2DaysCount: hiddenCount,
      countryOptions: sortedCountries.map((c) => ({
        country: c.country,
        count: c.count,
      })),
      countryChartData: chartRows,
      activeHorizons: visibleHorizons,
    };
  }, [
    trips,
    flota,
    tripScope,
    rangeStart,
    rangeEnd,
    hideWithin2Days,
    selectedCountry,
  ]);

  // 2) Pe șoferi / Pe camioane în intervalul selectat
  const eventsInRange = useMemo(() => {
    const list: TripEvent[] = [];
    const seen = new Set<string>();

    const pushEvent = (truckRaw: string, driverRaw: string, date: Date | null) => {
      if (!date || date < rangeStart || date > rangeEnd) return;
      const truck = String(truckRaw || '').trim().toUpperCase() || 'Fără camion';
      const dateStr = fmtRoDate(date);
      const drivers = splitDrivers(driverRaw);
      const driverList = drivers.length > 0 ? drivers : ['Nealocat'];

      for (const drv of driverList) {
        const cleanDriver = drv.trim() || 'Nealocat';
        const dedupKey = `${normRemKey(truck)}|${normRo(cleanDriver)}|${dateStr}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        list.push({
          driver: cleanDriver,
          truck,
          dateStr,
        });
      }
    };

    for (const t of trips) {
      if (!t.tara.trim() || !t.localitate.trim()) continue;
      if (!t.camion && !t.sofer) continue;
      pushEvent(t.camion, t.sofer, t.dataDescDate);
    }

    for (let i = 1; i < istoricRemorci.length; i++) {
      const row = istoricRemorci[i] || [];
      const truck1 = String(row[1] || '').trim();
      const drv1 = String(row[10] || '').trim();
      const date1 = parseRoDate(row[6]) || parseRoDate(row[9]);
      if (truck1 || drv1) {
        pushEvent(truck1, drv1, date1);
      }

      const truck2 = String(row[11] || '').trim();
      const drv2 = String(row[12] || '').trim();
      const date2 = parseRoDate(row[13]) || parseRoDate(row[16]);
      if (truck2 || drv2) {
        pushEvent(truck2, drv2, date2);
      }
    }

    return list;
  }, [trips, istoricRemorci, rangeStart, rangeEnd]);

  const { chartDataRange, stackKeysRange, uniqueDriversCount, uniqueTrucksCount } =
    useMemo(() => {
      const driverSet = new Set<string>();
      const truckSet = new Set<string>();
      const seriesTotals = new Map<string, number>();

      eventsInRange.forEach((ev) => {
        driverSet.add(ev.driver);
        truckSet.add(ev.truck);
        const stackKey = chartMode === 'byDriver' ? ev.truck : ev.driver;
        seriesTotals.set(stackKey, (seriesTotals.get(stackKey) || 0) + 1);
      });

      const sortedSeries = Array.from(seriesTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

      const MAX_STACK_SERIES = 8;
      const otherLabel =
        chartMode === 'byDriver' ? 'Alte camioane' : 'Alți șoferi';
      const topSeries = sortedSeries.slice(0, MAX_STACK_SERIES);
      const hasOthers = sortedSeries.length > MAX_STACK_SERIES;
      const finalKeys = hasOthers ? [...topSeries, otherLabel] : topSeries;
      const topSeriesSet = new Set(topSeries);

      const buckets = new Map<
        string,
        {
          fullLabel: string;
          shortLabel: string;
          total: number;
          counts: Record<string, number>;
        }
      >();

      eventsInRange.forEach((ev) => {
        const xRaw = chartMode === 'byDriver' ? ev.driver : ev.truck;
        const xNorm = chartMode === 'byDriver' ? normRo(xRaw) : normRemKey(xRaw);
        const stackRaw = chartMode === 'byDriver' ? ev.truck : ev.driver;
        const stackBucket = topSeriesSet.has(stackRaw) ? stackRaw : otherLabel;

        let bucket = buckets.get(xNorm);
        if (!bucket) {
          bucket = {
            fullLabel: xRaw,
            shortLabel: chartMode === 'byDriver' ? shortDriverLabel(xRaw) : xRaw,
            total: 0,
            counts: {},
          };
          buckets.set(xNorm, bucket);
        }
        bucket.total += 1;
        bucket.counts[stackBucket] = (bucket.counts[stackBucket] || 0) + 1;
      });

      const rows = Array.from(buckets.values())
        .sort(
          (a, b) => b.total - a.total || a.fullLabel.localeCompare(b.fullLabel)
        )
        .slice(0, 14)
        .map((b) => {
          const entry: Record<string, string | number> = {
            name: b.shortLabel,
            fullLabel: b.fullLabel,
            _total: b.total,
          };
          for (const key of finalKeys) {
            entry[key] = b.counts[key] || 0;
          }
          return entry;
        });

      return {
        chartDataRange: rows,
        stackKeysRange: finalKeys,
        uniqueDriversCount: driverSet.size,
        uniqueTrucksCount: truckSet.size,
      };
    }, [eventsInRange, chartMode]);

  const effectiveCountryFilter =
    selectedCountry !== 'ALL' &&
    countryOptions.some((c) => c.country === selectedCountry)
      ? selectedCountry
      : 'ALL';

  const countriesOnlyCount = countryOptions.filter(
    (c) => c.country !== NO_TRIP_KEY
  ).length;

  return (
    <section
      aria-label="Grafic distribuție camioane și curse"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-700 shrink-0" />
            <h2 className="font-display text-sm font-semibold text-slate-900">
              {chartMode === 'byCountry'
                ? 'Camioane pe țări'
                : 'Distribuția curselor pe șoferi și camioane'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {chartMode === 'byCountry' ? (
              <>
                Interval {rangeLabel} · {visibleTruckCount}{' '}
                {visibleTruckCount === 1 ? 'camion' : 'camioane'} în{' '}
                {countriesOnlyCount}{' '}
                {countriesOnlyCount === 1 ? 'țară' : 'țări'}
                {hideWithin2Days && hiddenWithin2DaysCount > 0
                  ? ` · ${hiddenWithin2DaysCount} ascunse (≤ 2 zile)`
                  : ''}
              </>
            ) : (
              <>
                Interval {rangeLabel} · {eventsInRange.length}{' '}
                {eventsInRange.length === 1 ? 'cursă' : 'curse'} ·{' '}
                {uniqueDriversCount} șoferi · {uniqueTrucksCount} camioane
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!chartHidden && (
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setChartMode('byCountry')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  chartMode === 'byCountry'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Camioane pe țări
              </button>
              <button
                type="button"
                onClick={() => setChartMode('byDriver')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  chartMode === 'byDriver'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Șoferi
              </button>
              <button
                type="button"
                onClick={() => setChartMode('byTruck')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  chartMode === 'byTruck'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Camioane
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={toggleChartHidden}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            {chartHidden ? (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                <span>Arată grafic</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                <span>Ascunde grafic</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!chartHidden && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Interval:
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  if (e.target.value) setDateFrom(e.target.value);
                }}
                aria-label="Data de început"
                className="px-2.5 py-1.5 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  if (e.target.value) setDateTo(e.target.value);
                }}
                aria-label="Data de sfârșit"
                className="px-2.5 py-1.5 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              />
              {!isDefaultCurrentMonth && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom(defaultMonth.from);
                    setDateTo(defaultMonth.to);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  Luna în curs
                </button>
              )}
            </div>

            {chartMode === 'byCountry' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTripScope('discharging')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      tripScope === 'discharging'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Doar ce descarcă
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripScope('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      tripScope === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Toate cursele
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setHideWithin2Days((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                    hideWithin2Days
                      ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100/70'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {hideWithin2Days ? (
                    <EyeOff className="h-3.5 w-3.5 text-amber-700" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                  )}
                  <span>
                    {hideWithin2Days
                      ? 'Ascunse descărcările ≤ 2 zile'
                      : 'Include descărcările ≤ 2 zile'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {chartMode === 'byCountry' ? (
            <>
              {countryOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 mr-1">
                    <Filter className="h-3 w-3" />
                    Filtre pe țări:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCountry('ALL')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                      effectiveCountryFilter === 'ALL'
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Toate ({visibleTruckCount})
                  </button>
                  {countryOptions.map((opt) => (
                    <button
                      key={opt.country}
                      type="button"
                      onClick={() =>
                        setSelectedCountry((prev) =>
                          prev === opt.country ? 'ALL' : opt.country
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors tabular-nums ${
                        effectiveCountryFilter === opt.country
                          ? 'bg-blue-700 text-white border-blue-700'
                          : opt.country === NO_TRIP_KEY
                            ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200/70'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      {opt.country !== NO_TRIP_KEY && (
                        <CountryFlag code={opt.country} className="w-3.5 h-2.5" />
                      )}
                      <span>
                        {opt.country} ({opt.count})
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {countryChartData.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {hideWithin2Days && hiddenWithin2DaysCount > 0
                    ? `Toate cele ${hiddenWithin2DaysCount} camioane din intervalul ${rangeLabel} descarcă în ≤ 2 zile și sunt ascunse.`
                    : `Nu există camioane de afișat în intervalul ${rangeLabel}.`}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="h-[300px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={countryChartData}
                        margin={{ top: 10, right: 16, left: -12, bottom: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="country"
                          interval={0}
                          height={36}
                          tick={<CountryAxisTick />}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          content={<CountryChartTooltip />}
                          cursor={{ fill: '#f8fafc' }}
                          wrapperStyle={{ zIndex: 40, pointerEvents: 'auto' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                          iconType="square"
                        />
                        {activeHorizons.map((h, idx) => (
                          <Bar
                            key={h.key}
                            dataKey={h.key}
                            name={h.key}
                            stackId="camioane"
                            fill={h.color}
                            radius={
                              idx === activeHorizons.length - 1
                                ? [4, 4, 0, 0]
                                : [0, 0, 0, 0]
                            }
                            maxBarSize={56}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-slate-400 text-right">
                    Atinge sau trece cu cursorul peste o bară pentru a vedea camioanele.
                  </p>
                </div>
              )}
            </>
          ) : chartDataRange.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nu există curse înregistrate în intervalul {rangeLabel}.
            </div>
          ) : (
            <div className="h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDataRange}
                  margin={{ top: 10, right: 16, left: -12, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={chartDataRange.length > 5 ? -22 : 0}
                    textAnchor={chartDataRange.length > 5 ? 'end' : 'middle'}
                    height={chartDataRange.length > 5 ? 64 : 34}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<StackedRangeTooltip />}
                    cursor={{ fill: '#f8fafc' }}
                    wrapperStyle={{ zIndex: 40 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    iconType="square"
                  />
                  {stackKeysRange.map((key, idx) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={key}
                      stackId="curse"
                      fill={
                        key === 'Alte camioane' || key === 'Alți șoferi'
                          ? STACK_COLORS[8]
                          : STACK_COLORS[idx % (STACK_COLORS.length - 1)]
                      }
                      radius={
                        idx === stackKeysRange.length - 1
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                      }
                      maxBarSize={48}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
