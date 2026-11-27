import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionModal } from './components/ConnectionModal';
import { FleetView } from './components/FleetView';
import { FreeTrailersView } from './components/FreeTrailersView';
import { HistoryView } from './components/HistoryView';
import { LeaveModal } from './components/LeaveModal';
import { LeaveView } from './components/LeaveView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OverviewView } from './components/OverviewView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TrailerHistoryView } from './components/TrailerHistoryView';
import { TripModal } from './components/TripModal';
import { TripsView } from './components/TripsView';
import { VisaModal } from './components/VisaModal';
import { VisasView } from './components/VisasView';
import { ZileCurseView } from './components/ZileCurseView';
import { createDemoData } from './data/demoData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { mutateGas, syncFromGas } from './services/gasClient';
import type {
  GasConfig,
  GasMutatePayload,
  GasPayload,
  NavTab,
  TripRecord,
  VisaRecord,
} from './types/fleet';
import {
  computeFleetAutoFill,
  computeFreeTrailers,
  countFleetUnits,
  countLeaveDaysByType,
  diffDaysFromToday,
  fmtRoDate,
  fmtRoDateTime,
  isLeaveMatrix,
  LEAVE_TYPES,
  normRo,
  parseLeaves,
  parseMonthLeaveCell,
  parseRoDate,
  parseTrips,
  parseVisas,
  parteNr,
  plainRo,
  splitDrivers,
  todayRo,
} from './utils/roDates';

const MONTHS_RO = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

const STORAGE_KEY = 'dispecerat_gas_config_v1';
const DATA_CACHE_KEY = 'dispecerat_cached_data_v1';
const REFRESH_SEC = 25;

const DEFAULT_CONFIG: GasConfig = {
  scriptUrl: '',
  key: 'TRANSPORT',
  user: 'Dispecer',
  mode: 'demo',
};

function loadSavedConfig(): GasConfig {
  try {
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const urlGas = (params.get('gas') || '').trim();
      if (urlGas.startsWith('https://script.google.com/')) {
        const nextCfg: GasConfig = {
          scriptUrl: urlGas,
          key: (params.get('key') || 'TRANSPORT').trim() || 'TRANSPORT',
          user: (params.get('user') || 'Dispecer').trim() || 'Dispecer',
          mode: 'live',
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCfg));
        window.history.replaceState({}, '', window.location.pathname);
        return nextCfg;
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      scriptUrl: typeof parsed.scriptUrl === 'string' ? parsed.scriptUrl : '',
      key: typeof parsed.key === 'string' ? parsed.key : 'TRANSPORT',
      user:
        typeof parsed.user === 'string' && parsed.user.trim()
          ? parsed.user
          : 'Dispecer',
      mode: parsed.mode === 'live' && parsed.scriptUrl ? 'live' : 'demo',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadInitialData(mode: 'demo' | 'live'): GasPayload {
  if (mode === 'live') {
    try {
      const cached = localStorage.getItem(DATA_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.curse)) return parsed;
      }
    } catch {
      // ignore cache errors
    }
  }
  return createDemoData();
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [config, setConfig] = useState<GasConfig>(() => loadSavedConfig());
  const [data, setData] = useState<GasPayload>(() =>
    loadInitialData(loadSavedConfig().mode)
  );
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fleetOnlyCheckedBifa, setFleetOnlyCheckedBifa] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dispecerat_fleet_bifa_v1');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  const handleFleetBifaChange = useCallback((checked: boolean) => {
    setFleetOnlyCheckedBifa(checked);
    try {
      localStorage.setItem('dispecerat_fleet_bifa_v1', checked ? '1' : '0');
    } catch {
      // ignore
    }
  }, []);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [bgSaveError, setBgSaveError] = useState<{
    message: string;
    payload: GasMutatePayload;
    scriptUrl: string;
  } | null>(null);

  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null);
  const [tripSaving, setTripSaving] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);

  const [visaModalOpen, setVisaModalOpen] = useState(false);
  const [editingVisa, setEditingVisa] = useState<VisaRecord | null>(null);
  const [visaSaving, setVisaSaving] = useState(false);
  const [visaError, setVisaError] = useState<string | null>(null);

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveInitialDriver, setLeaveInitialDriver] = useState<string>('');
  const [leaveInitialMonth, setLeaveInitialMonth] = useState<number | undefined>(
    undefined
  );

  const [connectionOpen, setConnectionOpen] = useState(false);
  const [connectionInitialTab, setConnectionInitialTab] = useState<
    'connect' | 'audit'
  >('connect');
  const [scriptOutdated, setScriptOutdated] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const lastSigRef = useRef('');
  const lastSyncAtMsRef = useRef(0);
  const pendingSavesRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const syncTimerRef = useRef<number | null>(null);
  const cacheTimerRef = useRef<number | null>(null);
  const recentOptimisticLogsRef = useRef<
    { row: string; tab: string; entry: string[]; createdAt: number }[]
  >([]);
  const preSaveServerLogSigRef = useRef('');

  const persistConfig = (next: GasConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const scheduleCachePersist = useCallback((snapshot: GasPayload) => {
    if (cacheTimerRef.current) {
      window.clearTimeout(cacheTimerRef.current);
    }
    cacheTimerRef.current = window.setTimeout(() => {
      cacheTimerRef.current = null;
      try {
        const sig = JSON.stringify(snapshot);
        lastSigRef.current = sig;
        localStorage.setItem(DATA_CACHE_KEY, sig);
      } catch {
        // ignore quota errors
      }
    }, 150);
  }, []);

  const applyLocalData = useCallback(
    (updater: (prev: GasPayload) => GasPayload) => {
      setData((prev) => {
        const next = updater(prev);
        scheduleCachePersist(next);
        return next;
      });
    },
    [scheduleCachePersist]
  );

  const performSync = useCallback(
    async (cfg: GasConfig, silent = false) => {
      if (cfg.mode !== 'live' || !cfg.scriptUrl) {
        if (!silent) {
          setData(createDemoData());
          setSyncError(null);
          setLastSyncedAt(
            new Date().toLocaleTimeString('ro-RO', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        }
        return;
      }

      if (!navigator.onLine) return;
      if (silent && pendingSavesRef.current > 0) return;

      if (!silent) setSyncing(true);
      setSyncError(null);
      try {
        const fresh = await syncFromGas(cfg.scriptUrl, cfg.key);
        setScriptOutdated(Number(fresh.scriptVersion || 0) < 3.2);
        if (pendingSavesRef.current > 0) return;

        const now = Date.now();
        const serverTail = fresh.istoric.slice(-25);
        const serverSigChanged =
          JSON.stringify(fresh.istoric.slice(-2)) !==
          preSaveServerLogSigRef.current;

        recentOptimisticLogsRef.current = recentOptimisticLogsRef.current.filter(
          (opt) => {
            if (now - opt.createdAt > 90000) return false;
            const matchedInServer =
              serverSigChanged &&
              serverTail.some(
                (r) =>
                  String(r[3] || '').trim() === opt.row &&
                  String(r[1] || '').trim().toLowerCase() ===
                    String(opt.entry[1] || '').trim().toLowerCase()
              );
            return !matchedInServer;
          }
        );

        preSaveServerLogSigRef.current = JSON.stringify(
          fresh.istoric.slice(-2)
        );

        const merged: GasPayload =
          recentOptimisticLogsRef.current.length > 0
            ? {
                ...fresh,
                istoric: [
                  ...fresh.istoric,
                  ...recentOptimisticLogsRef.current.map((o) => o.entry),
                ],
              }
            : fresh;

        const sig = JSON.stringify(merged);
        if (sig !== lastSigRef.current) {
          lastSigRef.current = sig;
          setData(merged);
          try {
            localStorage.setItem(DATA_CACHE_KEY, sig);
          } catch {
            // ignore quota errors
          }
        }
        lastSyncAtMsRef.current = Date.now();
        setLastSyncedAt(
          new Date().toLocaleTimeString('ro-RO', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      } catch (err) {
        if (!silent) {
          const msg =
            err instanceof Error ? err.message : 'Eroare la sincronizare.';
          setSyncError(msg);
        }
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    []
  );

  const enqueueLiveMutation = useCallback(
    (cfg: GasConfig, gasPayload: GasMutatePayload) => {
      pendingSavesRef.current += 1;
      setPendingSaves(pendingSavesRef.current);
      setBgSaveError(null);

      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await mutateGas(cfg.scriptUrl, gasPayload);
          setLastSyncedAt(
            new Date().toLocaleTimeString('ro-RO', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Eroare la salvarea modificării în Google Sheets.';
          recentOptimisticLogsRef.current = [];
          if (msg.toLowerCase().includes('necunoscut')) {
            setScriptOutdated(true);
          }
          setBgSaveError({
            message: msg,
            payload: gasPayload,
            scriptUrl: cfg.scriptUrl,
          });
        } finally {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setPendingSaves(pendingSavesRef.current);
          if (pendingSavesRef.current === 0) {
            if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
            syncTimerRef.current = window.setTimeout(() => {
              performSync(cfg, true);
            }, 1000);
          }
        }
      });
    },
    [performSync]
  );

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
      if (cacheTimerRef.current) {
        window.clearTimeout(cacheTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (config.mode === 'live' && config.scriptUrl) {
      performSync(config);
    }
  }, [config.mode, config.scriptUrl, performSync]);

  // 25-second background polling when online, live, and no modal is open
  useEffect(() => {
    if (config.mode !== 'live' || !config.scriptUrl) return;
    const id = window.setInterval(() => {
      if (
        !document.hidden &&
        isOnline &&
        !tripModalOpen &&
        !visaModalOpen &&
        !leaveModalOpen &&
        !connectionOpen
      ) {
        performSync(config, true);
      }
    }, REFRESH_SEC * 1000);

    const onVisibilityOrFocus = () => {
      if (
        !document.hidden &&
        isOnline &&
        pendingSavesRef.current === 0 &&
        Date.now() - lastSyncAtMsRef.current >= 10000
      ) {
        performSync(config, true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
    };
  }, [
    config,
    isOnline,
    tripModalOpen,
    visaModalOpen,
    leaveModalOpen,
    connectionOpen,
    performSync,
  ]);

  const trips = useMemo(() => parseTrips(data.curse), [data.curse]);
  const visas = useMemo(() => parseVisas(data.vize), [data.vize]);
  const leaves = useMemo(() => parseLeaves(data.concediu), [data.concediu]);
  const freeTrailers = useMemo(
    () => computeFreeTrailers(data.flota, data.curse, data.istoricRemorci),
    [data.flota, data.curse, data.istoricRemorci]
  );

  const fleetUnits = useMemo(
    () => countFleetUnits(data.flota, fleetOnlyCheckedBifa),
    [data.flota, fleetOnlyCheckedBifa]
  );

  const counts = useMemo(
    () => ({
      activeTrips: trips.filter((t) => t.isActive).length,
      fleetCount: fleetUnits.rows,
      fleetTrucks: fleetUnits.trucks,
      fleetTrailers: fleetUnits.trailers,
      fleetOnlyCheckedBifa,
      freeTrailers: freeTrailers.length,
      visaAlerts: visas.filter(
        (v) => v.status === 'expired' || v.status === 'expiring'
      ).length,
      activeLeaves: leaves.filter((l) => l.isActiveToday).length,
      trailerHistoryCount: (data.istoricRemorci || [])
        .slice(1)
        .filter((r) => Array.isArray(r) && r.some((c) => String(c || '').trim() !== '')).length,
      historyCount: data.istoric.filter(
        (r) =>
          Array.isArray(r) &&
          r.some((c) => String(c || '').trim() !== '') &&
          !(r[0] === 'Data și ora' && r[1] === 'Utilizator')
      ).length,
    }),
    [
      trips,
      fleetUnits,
      fleetOnlyCheckedBifa,
      freeTrailers,
      visas,
      leaves,
      data.istoricRemorci,
      data.istoric,
    ]
  );

  const sendLocalAlertsIfPermitted = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const urgentUnloadings = trips.filter((t) => {
      if (!t.isActive) return false;
      const d = t.dataDescDate ? diffDaysFromToday(t.dataDescDate) : null;
      return d !== null && d >= 0 && d <= 2;
    });

    const driversInTrips = new Set(
      trips
        .filter((t) => t.isActive)
        .flatMap((t) => splitDrivers(t.sofer).map(normRo))
        .filter(Boolean)
    );
    const urgentVisas = visas.filter(
      (v) =>
        v.daysLeft !== null &&
        v.daysLeft <= 7 &&
        driversInTrips.has(normRo(v.cells[1]))
    );
    const upcomingLeaves = leaves.filter(
      (l) => l.isActiveToday || l.isUpcoming
    );

    const storageKey = 'nf-' + fmtRoDate(todayRo());
    let sent: string[] = [];
    try {
      sent = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      sent = [];
    }

    const msgs: [string, string, string][] = [];
    if (urgentUnloadings.length > 0) {
      msgs.push([
        'Descărcări',
        `${urgentUnloadings.length} ${urgentUnloadings.length === 1 ? 'camion descarcă' : 'camioane descarcă'} în următoarele 2 zile`,
        't' + urgentUnloadings.map((t) => `${t.rowIndex}${t.dataDesc}`).join(''),
      ]);
    }
    if (urgentVisas.length > 0) {
      msgs.push([
        'Vize medicale',
        `${urgentVisas.length} documente ale șoferilor în curse expiră în ≤ 7 zile`,
        'v' + urgentVisas.map((v) => `${v.rowIndex}${v.cells[3]}`).join(''),
      ]);
    }
    if (upcomingLeaves.length > 0) {
      msgs.push([
        'Concedii',
        `${upcomingLeaves.length} ${upcomingLeaves.length === 1 ? 'șofer cu concediu' : 'șoferi cu concediu'} în următoarele 14 zile`,
        'c' + upcomingLeaves.map((l) => `${l.nume}${l.startStr}`).join(''),
      ]);
    }

    const show = async (title: string, body: string) => {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: title,
          });
          return;
        }
      } catch {
        // fallback below
      }
      try {
        new Notification(title, { body, icon: '/pwa-192x192.png' });
      } catch {
        // ignore if blocked
      }
    };

    for (const [title, body, sig] of msgs) {
      if (!sent.includes(sig)) {
        sent.push(sig);
        await show(title, body);
      }
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(sent));
    } catch {
      // ignore
    }
  }, [trips, visas, leaves]);

  useEffect(() => {
    if (notifPermission === 'granted') {
      sendLocalAlertsIfPermitted();
    }
  }, [notifPermission, sendLocalAlertsIfPermitted]);

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      await sendLocalAlertsIfPermitted();
    }
  };

  const handleSaveTrip = async (payload: {
    row?: number;
    values: string[];
    loc?: string;
  }) => {
    setTripError(null);
    setTripSaving(false);

    const userName = config.user || 'Dispecer';
    const nowStr = fmtRoDateTime(new Date());

    const nrParts = parteNr(payload.values[1] || '');
    const autoFill = computeFleetAutoFill(
      {
        camion: nrParts.camion,
        remorca: nrParts.remorca,
        soferi: payload.values[7] || '',
      },
      data.flota
    );
    const values16 = Array.from({ length: 16 }, (_, idx) =>
      String(payload.values[idx] || '').trim()
    );
    if (!values16[8]) values16[8] = autoFill.telefon;
    if (!values16[9]) values16[9] = autoFill.rezerva;
    if (!values16[10]) values16[10] = autoFill.tipAuto;
    if (!values16[11]) values16[11] = autoFill.anFabricatie;
    if (!values16[14]) values16[14] = autoFill.camioaneOriginal;

    applyLocalData((prev) => {
      if (pendingSavesRef.current === 0) {
        preSaveServerLogSigRef.current = JSON.stringify(
          prev.istoric.slice(-2)
        );
      }
      const nextCurse = [...prev.curse];
      const rowNum = payload.row || nextCurse.length + 1;

      let oldRowCells: string[] = [];
      let before = '';
      let oldNr = '';
      if (payload.row && payload.row - 1 < nextCurse.length) {
        oldRowCells = [...nextCurse[payload.row - 1]];
        oldNr = String(oldRowCells[1] || '');
        before = oldRowCells.join(' | ');
        nextCurse[payload.row - 1] = [...values16];
      } else {
        nextCurse.push([...values16]);
      }

      const logRow = [
        nowStr,
        userName,
        'sheet 1',
        String(rowNum),
        payload.row ? 'Modificare' : 'Adăugare',
        before,
        values16.join(' | '),
      ];

      const extraLogs: string[][] = [logRow];
      recentOptimisticLogsRef.current.push({
        row: String(rowNum),
        tab: 'sheet 1',
        entry: logRow,
        createdAt: Date.now(),
      });

      const oldRemRaw = (oldNr.split('/')[1] || '').trim();
      const newRemRaw = (String(values16[1] || '').split('/')[1] || '').trim();
      const oldRem = !oldRemRaw || /^schimb/i.test(oldRemRaw) ? '' : oldRemRaw;
      const newRem = !newRemRaw || /^schimb/i.test(newRemRaw) ? '' : newRemRaw;
      let nextIstoricRemorci = prev.istoricRemorci || [];

      if ((oldRem || newRem) && oldRem.toUpperCase() !== newRem.toUpperCase()) {
        nextIstoricRemorci = nextIstoricRemorci.map((r) => [...r]);
        const swapLoc = payload.loc || values16[4] || '';
        const swapLog = [
          nowStr,
          userName,
          'istoric remorci',
          String(rowNum),
          'Schimb remorcă',
          oldNr,
          swapLoc ? `${values16[1]} (${swapLoc})` : values16[1],
        ];
        extraLogs.push(swapLog);
        recentOptimisticLogsRef.current.push({
          row: String(rowNum),
          tab: 'istoric remorci',
          entry: swapLog,
          createdAt: Date.now(),
        });

        const camNew =
          (String(values16[1] || '').split('/')[0] || '').trim() ||
          (oldNr.split('/')[0] || '').trim();
        const todayStr = fmtRoDate(todayRo());
        let maxNr = 0;
        for (let i = 1; i < nextIstoricRemorci.length; i++) {
          const a = String(nextIstoricRemorci[i]?.[0] || '').trim();
          if (/^\d+$/.test(a)) maxNr = Math.max(maxNr, parseInt(a, 10));
        }
        let matchedPrev = false;
        if (newRem) {
          for (let i = nextIstoricRemorci.length - 1; i >= 1; i--) {
            if (
              String(nextIstoricRemorci[i]?.[2] || '').trim().toUpperCase() === newRem.toUpperCase() &&
              !String(nextIstoricRemorci[i]?.[11] || '').trim()
            ) {
              while (nextIstoricRemorci[i].length < 17) nextIstoricRemorci[i].push('');
              nextIstoricRemorci[i][11] = camNew;
              nextIstoricRemorci[i][12] = values16[7] || '';
              nextIstoricRemorci[i][13] = todayStr;
              nextIstoricRemorci[i][14] = values16[3] || '';
              nextIstoricRemorci[i][15] = values16[4] || '';
              nextIstoricRemorci[i][16] = values16[2] || '';
              matchedPrev = true;
              break;
            }
          }
          if (!oldRem && !matchedPrev && nextIstoricRemorci.length > 0) {
            nextIstoricRemorci.push([
              String(maxNr + 1),
              camNew,
              '',
              newRem,
              '',
              String(payload.loc || ''),
              '',
              '',
              '',
              '',
              '',
              camNew,
              values16[7] || '',
              todayStr,
              values16[3] || '',
              values16[4] || '',
              values16[2] || '',
            ]);
          }
        }
        if (oldRem && nextIstoricRemorci.length > 0) {
          nextIstoricRemorci.push([
            String(maxNr + 1),
            camNew,
            oldRem,
            newRem,
            '',
            String(payload.loc || ''),
            todayStr,
            oldRowCells[3] || '',
            oldRowCells[4] || '',
            oldRowCells[2] || '',
            oldRowCells[7] || values16[7] || '',
            '',
            '',
            '',
            '',
            '',
            '',
          ]);
        }
      }

      return {
        ...prev,
        curse: nextCurse,
        istoric: [...prev.istoric, ...extraLogs],
        istoricRemorci: nextIstoricRemorci,
      };
    });

    setTripModalOpen(false);
    setEditingTrip(null);

    if (config.mode === 'live' && config.scriptUrl) {
      enqueueLiveMutation(config, {
        key: config.key,
        user: userName,
        kind: 'curse',
        row: payload.row,
        values: values16,
        loc: payload.loc || '',
      });
    }
  };

  const handleSaveFleet = async (payload: { row?: number; values: string[] }) => {
    const userName = config.user || 'Dispecer';
    const nowStr = fmtRoDateTime(new Date());

    applyLocalData((prev) => {
      if (pendingSavesRef.current === 0) {
        preSaveServerLogSigRef.current = JSON.stringify(
          prev.istoric.slice(-2)
        );
      }
      const nextFlota = [...prev.flota];
      const rowNum = payload.row || nextFlota.length + 1;
      let before = '';
      if (payload.row && payload.row - 1 < nextFlota.length) {
        before = nextFlota[payload.row - 1].join(' | ');
        nextFlota[payload.row - 1] = [...payload.values];
      } else {
        nextFlota.push([...payload.values]);
      }
      const logRow = [
        nowStr,
        userName,
        'flota',
        String(rowNum),
        payload.row ? 'Modificare Flotă' : 'Adăugare Flotă',
        before,
        payload.values.join(' | '),
      ];
      recentOptimisticLogsRef.current.push({
        row: String(rowNum),
        tab: 'flota',
        entry: logRow,
        createdAt: Date.now(),
      });
      return {
        ...prev,
        flota: nextFlota,
        istoric: [...prev.istoric, logRow],
      };
    });

    if (config.mode === 'live' && config.scriptUrl) {
      enqueueLiveMutation(config, {
        key: config.key,
        user: userName,
        kind: 'flota',
        row: payload.row,
        values: payload.values,
      });
    }
  };

  const handleSaveTrailerHistory = async (payload: {
    row: number;
    values: string[];
  }) => {
    const userName = config.user || 'Dispecer';
    const nowStr = fmtRoDateTime(new Date());
    const v17 = Array.from({ length: 17 }, (_, i) =>
      String(payload.values[i] || '')
    );

    applyLocalData((prev) => {
      if (pendingSavesRef.current === 0) {
        preSaveServerLogSigRef.current = JSON.stringify(
          prev.istoric.slice(-2)
        );
      }
      const nextIstRem = [...(prev.istoricRemorci || [])];
      const idx = payload.row - 1;
      const before =
        idx >= 0 && idx < nextIstRem.length
          ? nextIstRem[idx].join(' | ')
          : '';
      if (idx >= 0 && idx < nextIstRem.length) {
        if (!v17[0] && nextIstRem[idx][0]) {
          v17[0] = String(nextIstRem[idx][0]);
        }
        nextIstRem[idx] = [...v17];
      }

      const logRow = [
        nowStr,
        userName,
        'istoric remorci',
        String(payload.row),
        'Modificare',
        before,
        v17.join(' | '),
      ];

      recentOptimisticLogsRef.current.push({
        row: String(payload.row),
        tab: 'istoric remorci',
        entry: logRow,
        createdAt: Date.now(),
      });

      return {
        ...prev,
        istoricRemorci: nextIstRem,
        istoric: [...prev.istoric, logRow],
      };
    });

    if (config.mode === 'live' && config.scriptUrl) {
      enqueueLiveMutation(config, {
        key: config.key,
        user: userName,
        kind: 'istoricRemorci',
        row: payload.row,
        values: v17,
      });
    }
  };

  const handleSaveVisa = async (payload: { row?: number; values: string[] }) => {
    setVisaError(null);
    setVisaSaving(false);

    const userName = config.user || 'Dispecer';
    const nowStr = fmtRoDateTime(new Date());

    applyLocalData((prev) => {
      if (pendingSavesRef.current === 0) {
        preSaveServerLogSigRef.current = JSON.stringify(
          prev.istoric.slice(-2)
        );
      }
      const nextVize = [...prev.vize];
      const rowNum = payload.row || nextVize.length + 1;
      let before = '';
      if (payload.row && payload.row - 1 < nextVize.length) {
        const existing = nextVize[payload.row - 1];
        before = existing.slice(1, 4).join(' | ');
        nextVize[payload.row - 1] = [
          existing[0] || String(rowNum - 1),
          ...payload.values,
        ];
      } else {
        nextVize.push([String(nextVize.length), ...payload.values]);
      }

      const logRow = [
        nowStr,
        userName,
        'vize medicale',
        String(rowNum),
        payload.row ? 'Modificare' : 'Adăugare',
        before,
        payload.values.join(' | '),
      ];

      recentOptimisticLogsRef.current.push({
        row: String(rowNum),
        tab: 'vize medicale',
        entry: logRow,
        createdAt: Date.now(),
      });

      return {
        ...prev,
        vize: nextVize,
        istoric: [...prev.istoric, logRow],
      };
    });

    setVisaModalOpen(false);
    setEditingVisa(null);

    if (config.mode === 'live' && config.scriptUrl) {
      enqueueLiveMutation(config, {
        key: config.key,
        user: userName,
        kind: 'vize',
        row: payload.row,
        values: payload.values,
      });
    }
  };

  const handleSaveLeave = async (payload: {
    nume: string;
    monthIdx: number;
    cellText: string;
  }) => {
    const userName = config.user || 'Dispecer';
    const nowStr = fmtRoDateTime(new Date());
    const currentYear = todayRo().getFullYear();
    const cleanCell = payload.cellText.trim();
    const monthName = MONTHS_RO[payload.monthIdx] || `Luna ${payload.monthIdx + 1}`;

    applyLocalData((prev) => {
      if (pendingSavesRef.current === 0) {
        preSaveServerLogSigRef.current = JSON.stringify(
          prev.istoric.slice(-2)
        );
      }

      let nextConcediu = [...prev.concediu];
      let rowNum = nextConcediu.length + 1;
      let beforeCell = '';

      if (isLeaveMatrix(nextConcediu)) {
        const header = nextConcediu[0] || [];
        const monthPrefixes = [
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
        ];
        const monthCols: Record<number, number> = {};
        let totalCol = -1;
        const typeCols: Partial<Record<(typeof LEAVE_TYPES)[number], number>> = {};
        header.forEach((h, idx) => {
          const p = plainRo(h);
          if (p.includes('total') && !/\b(co|cm|l|cfp)\b/.test(p)) {
            totalCol = idx;
          }
          for (const t of LEAVE_TYPES) {
            const tl = t.toLowerCase();
            if (p === tl || p === `total ${tl}` || p.endsWith(` ${tl}`)) {
              typeCols[t] = idx;
            }
          }
          monthPrefixes.forEach((pref, m) => {
            if (p.startsWith(pref) || (m === 10 && p.startsWith('nov'))) {
              monthCols[m] = idx;
            }
          });
        });

        const colLen = Math.max(header.length, 14);
        let rowIdx = nextConcediu.findIndex(
          (r, idx) => idx > 0 && normRo(r[0]) === normRo(payload.nume)
        );
        if (rowIdx === -1) {
          const emptyRow = Array.from({ length: colLen }, (_, idx) =>
            idx === 0 ? payload.nume : idx === totalCol ? '0' : ''
          );
          nextConcediu.push(emptyRow);
          rowIdx = nextConcediu.length - 1;
        }
        rowNum = rowIdx + 1;
        const targetRow = [...nextConcediu[rowIdx]];
        nextConcediu[rowIdx] = targetRow;
        while (targetRow.length < colLen) targetRow.push('');

        const colIdx = monthCols[payload.monthIdx] ?? payload.monthIdx + 1;
        beforeCell = String(targetRow[colIdx] || '').trim();
        targetRow[colIdx] = cleanCell;

        const totals = { total: 0, CO: 0, CM: 0, L: 0, CFP: 0 };
        for (let m = 0; m < 12; m++) {
          const cIdx = monthCols[m] ?? m + 1;
          const txt = String(targetRow[cIdx] || '').trim();
          if (!txt) continue;
          const monthCounts = countLeaveDaysByType(
            parseMonthLeaveCell(txt, m, currentYear)
          );
          totals.total += monthCounts.total;
          totals.CO += monthCounts.CO;
          totals.CM += monthCounts.CM;
          totals.L += monthCounts.L;
          totals.CFP += monthCounts.CFP;
        }
        if (totalCol >= 0) {
          targetRow[totalCol] = String(totals.total);
        }
        for (const t of LEAVE_TYPES) {
          const tCol = typeCols[t];
          if (typeof tCol === 'number' && tCol >= 0) {
            targetRow[tCol] = String(totals[t]);
          }
        }
      } else {
        const targetDriver = normRo(payload.nume);
        const removed: string[] = [];
        nextConcediu = nextConcediu.filter((r) => {
          if (normRo(r[0]) !== targetDriver) return true;
          const d = parseRoDate(r[1]);
          if (d && d.getMonth() === payload.monthIdx) {
            removed.push(
              r[1] === r[2] || !r[2] ? r[1] : `${r[1]}-${r[2]}`
            );
            return false;
          }
          return true;
        });
        beforeCell = removed.join('; ');
        if (cleanCell) {
          const periods = parseMonthLeaveCell(
            cleanCell,
            payload.monthIdx,
            currentYear
          );
          periods.forEach((p) => {
            nextConcediu.push([
              payload.nume,
              fmtRoDate(p.start),
              fmtRoDate(p.end),
              p.type,
            ]);
          });
        }
        rowNum = nextConcediu.length;
      }

      const logRow = [
        nowStr,
        userName,
        'CONCEDIU SOFERI',
        String(rowNum),
        beforeCell ? 'Modificare' : 'Adăugare',
        `${payload.nume} (${monthName}: ${beforeCell || 'gol'})`,
        `${payload.nume} (${monthName}: ${cleanCell || 'șters'})`,
      ];

      recentOptimisticLogsRef.current.push({
        row: String(rowNum),
        tab: 'CONCEDIU SOFERI',
        entry: logRow,
        createdAt: Date.now(),
      });

      return {
        ...prev,
        concediu: nextConcediu,
        istoric: [...prev.istoric, logRow],
      };
    });

    setLeaveModalOpen(false);
    setLeaveInitialDriver('');
    setLeaveInitialMonth(undefined);

    if (config.mode === 'live' && config.scriptUrl) {
      enqueueLiveMutation(config, {
        key: config.key,
        user: userName,
        kind: 'concediu',
        values: [payload.nume, String(payload.monthIdx), cleanCell],
      });
    }
  };

  const handleConnectLive = async (nextConfig: GasConfig) => {
    setConnectionTesting(true);
    setConnectionError(null);
    try {
      const fresh = await syncFromGas(nextConfig.scriptUrl, nextConfig.key);
      persistConfig(nextConfig);
      const sig = JSON.stringify(fresh);
      lastSigRef.current = sig;
      try {
        localStorage.setItem(DATA_CACHE_KEY, sig);
      } catch {
        // ignore
      }
      setData(fresh);
      setScriptOutdated(Number(fresh.scriptVersion || 0) < 3.2);
      setSyncError(null);
      setLastSyncedAt(
        new Date().toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      setConnectionOpen(false);
    } catch (err) {
      setConnectionError(
        err instanceof Error ? err.message : 'Conexiunea a eșuat.'
      );
    } finally {
      setConnectionTesting(false);
    }
  };

  const handleSwitchToDemo = () => {
    const demoCfg: GasConfig = {
      ...config,
      mode: 'demo',
    };
    persistConfig(demoCfg);
    setData(createDemoData());
    setSyncError(null);
    setConnectionError(null);
    setConnectionOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenConnection={() => {
          setConnectionError(null);
          setConnectionInitialTab('connect');
          setConnectionOpen(true);
        }}
        mode={config.mode}
        counts={counts}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <OfflineIndicator />
        <TopBar
          activeTab={activeTab}
          mode={config.mode}
          userName={config.user}
          lastSyncedAt={lastSyncedAt}
          syncing={syncing}
          pendingSaves={pendingSaves}
          onSync={() => performSync(config)}
          onAddTrip={() => {
            setEditingTrip(null);
            setTripError(null);
            setTripModalOpen(true);
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6 max-w-[1440px] w-full mx-auto space-y-4">
          {config.mode === 'demo' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
              <div>
                <span className="font-semibold">
                  Mod demonstrativ activ (9 curse de test).
                </span>{' '}
                După instalare pe telefon, memoria este separată — conectează linkul <code className="font-mono">/exec</code> al Google Sheet-ului ca să apară toate cursele tale.
              </div>
              <button
                type="button"
                onClick={() => {
                  setConnectionError(null);
                  setConnectionInitialTab('connect');
                  setConnectionOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-700 text-white rounded-md hover:bg-blue-800 font-medium whitespace-nowrap self-start sm:self-auto"
              >
                Conectează Google Sheet
              </button>
            </div>
          )}

          {scriptOutdated && config.mode === 'live' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
              <span>
                <strong>Script Google Apps Script neactualizat la acest link.</strong>{' '}
                În Apps Script apasă <strong>Implementare → Gestionați implementările → Editați → Versiune nouă → Implementează</strong> (sau lipește noul URL <code className="font-mono">/exec</code>), altfel coloanele I–O și concediile nu se pot actualiza automat în Google Sheet.
              </span>
              <button
                type="button"
                onClick={() => {
                  setConnectionError(null);
                  setConnectionInitialTab('audit');
                  setConnectionOpen(true);
                }}
                className="font-semibold underline whitespace-nowrap self-start sm:self-auto"
              >
                Vezi Script & Pași
              </button>
            </div>
          )}

          {bgSaveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-800">
              <span>
                Nu s-a putut trimite modificarea către Google Sheets: {bgSaveError.message}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    enqueueLiveMutation(config, bgSaveError.payload)
                  }
                  className="font-semibold underline whitespace-nowrap"
                >
                  Reîncearcă salvarea
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConnectionError(null);
                    setConnectionInitialTab('audit');
                    setConnectionOpen(true);
                  }}
                  className="font-medium underline whitespace-nowrap"
                >
                  Verifică Scriptul
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBgSaveError(null);
                    performSync(config);
                  }}
                  className="font-medium text-red-700 hover:underline whitespace-nowrap"
                >
                  Reîncarcă din Sheet
                </button>
              </div>
            </div>
          )}

          {syncError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-800">
              <span>{syncError}</span>
              <button
                type="button"
                onClick={() => setConnectionOpen(true)}
                className="font-medium underline whitespace-nowrap self-start sm:self-auto"
              >
                Verifică setările
              </button>
            </div>
          )}

          {syncing && data.curse.length <= 1 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3 animate-pulse">
              <div className="h-5 w-48 bg-slate-200 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  trips={trips}
                  freeTrailers={freeTrailers}
                  visas={visas}
                  leaves={leaves}
                  history={data.istoric}
                  flota={data.flota}
                  istoricRemorci={data.istoricRemorci || []}
                  onNavigate={setActiveTab}
                  onEditTrip={(trip) => {
                    setEditingTrip(trip);
                    setTripError(null);
                    setTripModalOpen(true);
                  }}
                  onEditVisa={(visa) => {
                    setEditingVisa(visa);
                    setVisaError(null);
                    setVisaModalOpen(true);
                  }}
                  onEnableNotifications={handleEnableNotifications}
                  notifPermission={notifPermission}
                />
              )}

              {activeTab === 'curse' && (
                <TripsView
                  headers={data.curse[0] || []}
                  trips={trips}
                  flota={data.flota}
                  onAddTrip={() => {
                    setEditingTrip(null);
                    setTripError(null);
                    setTripModalOpen(true);
                  }}
                  onEditTrip={(trip) => {
                    setEditingTrip(trip);
                    setTripError(null);
                    setTripModalOpen(true);
                  }}
                />
              )}

              {activeTab === 'flota' && (
                <FleetView
                  flota={data.flota}
                  freeTrailers={freeTrailers}
                  trips={trips}
                  leaves={leaves}
                  onlyCheckedBifa={fleetOnlyCheckedBifa}
                  onOnlyCheckedBifaChange={handleFleetBifaChange}
                  onSaveFleet={handleSaveFleet}
                />
              )}

              {activeTab === 'remorci_libere' && (
                <FreeTrailersView freeTrailers={freeTrailers} />
              )}

              {activeTab === 'zile_curse' && (
                <ZileCurseView
                  zileCurse={data.zileCurse || []}
                  trips={trips}
                  flota={data.flota}
                />
              )}

              {activeTab === 'vize' && (
                <VisasView
                  headers={data.vize[0] || []}
                  visas={visas}
                  onAddVisa={() => {
                    setEditingVisa(null);
                    setVisaError(null);
                    setVisaModalOpen(true);
                  }}
                  onEditVisa={(visa) => {
                    setEditingVisa(visa);
                    setVisaError(null);
                    setVisaModalOpen(true);
                  }}
                />
              )}

              {activeTab === 'concedii' && (
                <LeaveView
                  leaves={leaves}
                  rawConcediu={data.concediu}
                  trips={trips}
                  mode={config.mode}
                  onAddLeave={(driverName, monthIdx) => {
                    setLeaveInitialDriver(driverName || '');
                    setLeaveInitialMonth(monthIdx);
                    setLeaveModalOpen(true);
                  }}
                  onOpenConnection={() => {
                    setConnectionError(null);
                    setConnectionInitialTab('audit');
                    setConnectionOpen(true);
                  }}
                />
              )}

              {activeTab === 'istoric_remorci' && (
                <TrailerHistoryView
                  istoricRemorci={data.istoricRemorci || []}
                  mode={config.mode}
                  onOpenConnection={() => {
                    setConnectionError(null);
                    setConnectionInitialTab('audit');
                    setConnectionOpen(true);
                  }}
                  onSaveRow={handleSaveTrailerHistory}
                />
              )}

              {activeTab === 'istoric' && <HistoryView istoric={data.istoric} />}
            </>
          )}
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      <TripModal
        open={tripModalOpen}
        trip={editingTrip}
        allTrips={trips}
        headers={data.curse[0] || []}
        flota={data.flota}
        leaves={leaves}
        istoricRemorci={data.istoricRemorci || []}
        saving={tripSaving}
        error={tripError}
        onClose={() => {
          setTripModalOpen(false);
          setEditingTrip(null);
        }}
        onSave={handleSaveTrip}
      />

      <VisaModal
        open={visaModalOpen}
        visa={editingVisa}
        headers={data.vize[0] || []}
        flota={data.flota}
        saving={visaSaving}
        error={visaError}
        onClose={() => {
          setVisaModalOpen(false);
          setEditingVisa(null);
        }}
        onSave={handleSaveVisa}
      />

      <LeaveModal
        open={leaveModalOpen}
        initialDriver={leaveInitialDriver}
        initialMonth={leaveInitialMonth}
        flota={data.flota}
        rawConcediu={data.concediu}
        trips={trips}
        onClose={() => {
          setLeaveModalOpen(false);
          setLeaveInitialDriver('');
          setLeaveInitialMonth(undefined);
        }}
        onSave={handleSaveLeave}
      />

      <ConnectionModal
        open={connectionOpen}
        config={config}
        initialTab={connectionInitialTab}
        scriptOutdated={scriptOutdated}
        testing={connectionTesting}
        error={connectionError}
        onClose={() => setConnectionOpen(false)}
        onSaveAndConnect={handleConnectLive}
        onSwitchToDemo={handleSwitchToDemo}
      />
    </div>
  );
}
