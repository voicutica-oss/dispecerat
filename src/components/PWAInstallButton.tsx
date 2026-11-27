import { Check, Copy, Download, Monitor, Share, Share2, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  buildPhoneShareUrl,
  getPublicBaseUrl,
  isPrivateAppOrigin,
  readStoredGasConfig,
} from '../utils/appUrl';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;
  const isPrivateOrigin = isPrivateAppOrigin();
  const storedConfig = readStoredGasConfig();
  const appUrl = storedConfig
    ? buildPhoneShareUrl(storedConfig.scriptUrl, storedConfig.key, storedConfig.user)
    : getPublicBaseUrl();

  const handleCopyUrl = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleShareUrl = async () => {
    if (!appUrl) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Dispecerat Transport',
          text: 'Deschide linkul în browser (Safari pe iPhone / Chrome pe Android):',
          url: appUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await handleCopyUrl();
  };

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
          compact
            ? 'px-2.5 py-1.5 min-h-[36px] text-xs bg-slate-900 text-white hover:bg-slate-800'
            : 'w-full justify-center px-3 py-2 text-xs bg-blue-700 text-white hover:bg-blue-800'
        }`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>Instalează aplicația</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
          compact
            ? 'px-2.5 py-1.5 min-h-[36px] text-xs text-slate-700 bg-slate-100 hover:bg-slate-200'
            : 'w-full justify-start px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100'
        }`}
      >
        <Smartphone className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span>{isIOS ? 'Instalează pe iPhone' : 'Instalează aplicația'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-xl p-6 space-y-4 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={`${import.meta.env.BASE_URL}logo-camion.png`}
                  alt="Sigla Dispecerat"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-xl object-cover shrink-0 ring-1 ring-slate-200"
                />
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Instalare pe Telefon (Android &amp; iOS)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instalare rapidă ca aplicație sau fișier nativ APK / iOS.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                aria-label="Închide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {appUrl && (
              <div
                className={`p-3 rounded-lg text-xs space-y-2 border ${
                  isInIframe || isPrivateOrigin
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-blue-50 border-blue-200 text-blue-950'
                }`}
              >
                <p>
                  {isInIframe || isPrivateOrigin ? (
                    <>
                      <strong>Link public pentru alte telefoane / iPhone:</strong> Aplicația rulează local/în previzualizare. Trimite linkul public de mai jos către iPhone (Safari) sau alt telefon (Chrome):
                    </>
                  ) : (
                    <>
                      <strong>Link rapid pentru iPhone / alt telefon:</strong> Deschide direct în <strong>Safari</strong> (iPhone) sau <strong>Chrome</strong> (Android):
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded font-mono text-[11px] truncate text-slate-800">
                    {appUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white rounded text-[11px] font-medium shrink-0"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Copiat</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copiază</span>
                      </>
                    )}
                  </button>
                  {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                    <button
                      type="button"
                      onClick={handleShareUrl}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-700 text-white rounded text-[11px] font-medium shrink-0"
                    >
                      <Share2 className="h-3 w-3" />
                      <span>Trimite</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Share className="h-3.5 w-3.5 text-blue-700" />
                  <span>iPhone / iPad (Safari)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Deschide linkul public de mai sus în browserul <strong>Safari</strong> (nu în browserul din WhatsApp/Facebook).</li>
                  <li>Apasă butonul <strong>Partajare</strong> (pătratul cu săgeată în sus).</li>
                  <li>Alege <strong>Adaugă pe ecranul principal</strong> (Add to Home Screen).</li>
                </ol>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Android (Chrome)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Deschide linkul aplicației în <strong>Google Chrome</strong> pe telefon.</li>
                  <li>Apasă meniul <strong>⋮</strong> din colțul dreapta sus.</li>
                  <li>Alege <strong>Instalează aplicația</strong> sau <strong>Adaugă pe ecranul de pornire</strong>.</li>
                </ol>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-slate-700" />
                  <span>Calculator (Chrome / Edge)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Deschide linkul aplicației într-o filă normală de <strong>Chrome</strong> sau <strong>Edge</strong>.</li>
                  <li>
                    Apasă iconița de instalare din dreapta barei de adrese sau meniul{' '}
                    <strong>⋮ → Instalează pagina ca aplicație…</strong>
                  </li>
                </ol>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                <div className="font-semibold text-blue-950 flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-blue-700" />
                  <span>Fișier nativ Android (.apk) &amp; iOS (.ipa)</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  Proiectul include <strong>Capacitor</strong> (<code>android/</code>, <code>ios/</code>) și fluxuri în GitHub:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                  <li>Pe GitHub → fila <strong>Actions</strong> → <strong>Construiește APK (Android)</strong> → descarci <code>Dispecerat-Flota-Android-APK</code>.</li>
                  <li>Pentru iPhone/iPad: <strong>Actions</strong> → <strong>Construiește iOS (IPA nesemnat)</strong> → descarci <code>Dispecerat-Flota-iOS-IPA</code> (instalabil cu AltStore / Sideloadly / Xcode).</li>
                </ol>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              Am înțeles
            </button>
          </div>
        </div>
      )}
    </>
  );
}
