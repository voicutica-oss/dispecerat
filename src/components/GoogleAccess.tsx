import { useEffect, useRef, useState } from 'react';
import { getUser, handleAuthCallback, logout, oauthLogin } from '@netlify/identity';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import App from '../App';

const errors: Record<string, string> = {
  account: 'Folosește același cont Google în ambele etape ale conectării.',
  cancelled: 'Ai anulat conectarea. Poți încerca din nou.',
  config: 'Conectarea cu Google nu este activă încă. Datele dispeceratului nu sunt disponibile.',
  denied: 'Acest cont Google nu are acces la foaia dispeceratului. Cere acces proprietarului foii sau schimbă contul.',
  expired: 'Sesiunea de conectare a expirat. Încearcă din nou.',
  identity: 'Sesiunea Google nu a putut fi confirmată. Încearcă din nou.',
  unavailable: 'Nu am putut verifica accesul prin Google. Încearcă din nou.',
};

type Access = { email: string; canEdit: boolean };

export function GoogleAccess() {
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [error, setError] = useState('');
  const authorize = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let current = true;

    async function refresh(initial = false) {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!current) return false;
        const available = response.ok || response.status === 401 || response.status === 403;
        setConfigured(available);
        if (available) setError((message) => message === errors.config ? '' : message);
        if (response.ok) {
          const session: Access = await response.json();
          if (current) setAccess(session);
        } else if (available || response.status === 503 || initial) {
          setAccess(null);
          if (response.status === 403) setError(errors.denied);
          else if (response.status === 503) setError(errors.config);
          else if (response.status !== 401) setError(errors.unavailable);
        }
        return available;
      } catch {
        if (initial && current) setError(errors.unavailable);
        return false;
      }
    }

    async function initialize() {
      try {
        if (!(await refresh(true))) return;
        const callback = await handleAuthCallback();
        if (!current) return;
        const user = await getUser();
        if (!current) return;
        const googleUser = user?.appMetadata?.provider === 'google';
        setIdentityReady(googleUser);
        if (callback?.type === 'oauth' && googleUser) {
          authorize.current?.submit();
          return;
        }
        const authError = new URLSearchParams(window.location.search).get('auth');
        if (authError && Object.hasOwn(errors, authError)) {
          setError(errors[authError]);
          window.history.replaceState(null, '', '/');
        }
      } catch {
        if (current) setError(errors.identity);
      } finally {
        if (current) setLoading(false);
      }
    }

    try {
      localStorage.removeItem('dispecerat_gas_config_v1');
      localStorage.removeItem('dispecerat_cached_data_v1');
      Object.keys(localStorage).filter((key) => /^nf-\d/.test(key)).forEach((key) => localStorage.removeItem(key));
    } catch {
      setError('Browserul nu permite stocarea locală pentru autentificare.');
    }
    void initialize();
    const focus = () => void refresh();
    const interval = window.setInterval(focus, 30_000);
    window.addEventListener('focus', focus);
    return () => {
      current = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', focus);
    };
  }, []);

  function connect() {
    if (!configured) return;
    setBusy(true);
    setError('');
    try {
      if (identityReady) authorize.current?.submit();
      else oauthLogin('google');
    } catch {
      setError(errors.unavailable);
      setBusy(false);
    }
  }

  async function disconnect(switchAccount = false) {
    setBusy(true);
    setAccess(null);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
      if (!response.ok) throw new Error();
      await logout().catch(() => undefined);
      setIdentityReady(false);
      if (switchAccount) oauthLogin('google');
      else window.location.replace('/');
    } catch {
      setBusy(false);
      setError('Deconectarea nu a reușit. Încearcă din nou.');
    }
  }

  if (access && !busy) return <App managedAccess={access} onSignOut={() => void disconnect()} />;

  return (
    <main className="min-h-dvh bg-[#eef3f8] px-5 py-10 sm:py-20 flex items-center justify-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-200">
        <div className="flex items-center gap-4 bg-[#093363] px-6 py-6 text-white sm:px-10">
          <img src="/logo-camion.png" width="48" height="48" alt="" className="rounded-xl bg-white shadow-sm" />
          <p className="font-display text-lg font-bold">Dispecerat Transport</p>
        </div>
        <section className="space-y-5 px-6 py-8 sm:px-10 sm:py-10" aria-labelledby="login-title">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-700">
            <LockKeyhole className="size-4" aria-hidden="true" /> Acces pentru echipă
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950" id="login-title">Intră în dispecerat</h1>
          <p className="max-w-md text-sm leading-6 text-slate-600">Folosește contul Google care are acces la foaia de lucru a dispeceratului.</p>
          <form ref={authorize} action="/api/auth/google/start" method="post" hidden />
          {error && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">{error}</p>}
          <button type="button" disabled={!configured || loading || busy} onClick={connect} className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:opacity-60 sm:w-auto">
            {loading || busy ? 'Se verifică accesul…' : 'Continuă cu Google'} <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          {configured && identityReady && error && <button type="button" disabled={busy} onClick={() => void disconnect(true)} className="block text-sm font-semibold text-blue-800 underline underline-offset-4">Schimbă contul Google</button>}
        </section>
      </div>
    </main>
  );
}
