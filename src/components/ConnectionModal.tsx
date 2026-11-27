import { AlertCircle, Check, CheckCircle2, Copy, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import fullCodeGs from '../../Code.gs?raw';
import type { GasConfig } from '../types/fleet';
import {
  buildPhoneShareUrl,
  getPublicBaseUrl,
  isPrivateAppOrigin,
  parsePhoneShareOrGasInput,
  savePublicBaseUrl,
} from '../utils/appUrl';

const FULL_CODE_GS = fullCodeGs;

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
  const [publicBaseUrl, setPublicBaseUrl] = useState(() => getPublicBaseUrl());
  const isPrivateOrigin = isPrivateAppOrigin();

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setScriptUrl(config.scriptUrl);
    setKey(config.key);
    setUser(config.user);
    setPublicBaseUrl(getPublicBaseUrl());
    setCopied(false);
    setCopiedLink(false);
  }, [open, config, initialTab]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPrivateOrigin && publicBaseUrl.trim()) {
      savePublicBaseUrl(publicBaseUrl);
    }
    await onSaveAndConnect({
      scriptUrl: scriptUrl.trim(),
      key: key.trim(),
      user: user.trim() || 'Dispecer',
      mode: 'live',
    });
  };

  const handleScriptUrlChange = (rawValue: string) => {
    const parsedShare = parsePhoneShareOrGasInput(rawValue);
    if (parsedShare) {
      setScriptUrl(parsedShare.scriptUrl);
      if (parsedShare.key) setKey(parsedShare.key);
      if (parsedShare.user) setUser(parsedShare.user);
      return;
    }
    setScriptUrl(rawValue);
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

  const getPhoneShareLink = () => {
    const effectiveBase = isPrivateOrigin
      ? savePublicBaseUrl(publicBaseUrl)
      : undefined;
    return buildPhoneShareUrl(
      scriptUrl.trim(),
      key.trim() || 'TRANSPORT',
      user.trim() || 'Dispecer',
      effectiveBase
    );
  };

  const handleCopyPhoneLink = async () => {
    if (!scriptUrl.trim()) return;
    const shareUrl = getPhoneShareLink();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleSharePhoneLink = async () => {
    if (!scriptUrl.trim()) return;
    const shareUrl = getPhoneShareLink();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Dispecerat Transport — Conectare Telefon',
          text: 'Deschide acest link în Safari (iPhone) sau Chrome (Android) pentru conectare automată:',
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await handleCopyPhoneLink();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl pb-[env(safe-area-inset-bottom)]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Google Apps Script &amp; Instalare Mobil
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
            Script Google (Code.gs) &amp; iOS/Android
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
                <span>Conectat la Google Sheets Live (versiunea 3.7 bidirecțională).</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  URL aplicație web Google Apps Script (sau lipește linkul de telefon)
                </label>
                <input
                  type="url"
                  required
                  value={scriptUrl}
                  onChange={(e) => handleScriptUrlChange(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              {isPrivateOrigin && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Adresă web publică pentru alte telefoane &amp; iPhone (GitHub Pages)
                  </label>
                  <input
                    type="url"
                    value={publicBaseUrl}
                    onChange={(e) => setPublicBaseUrl(e.target.value)}
                    placeholder="https://voicutica-oss.github.io/dispecerat/"
                    className="w-full px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Aplicația de Android rulează local (<code className="font-mono">localhost</code>). Linkul pt. telefon folosește această adresă publică ca să meargă și pe iPhone / alte telefoane.
                  </p>
                </div>
              )}

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
                  <>
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
                    {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                      <button
                        type="button"
                        onClick={handleSharePhoneLink}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Trimite</span>
                      </button>
                    )}
                  </>
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
                2. Instalare pe telefon (iOS &amp; Android)
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
