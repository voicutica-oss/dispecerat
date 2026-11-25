import { Check, Copy, Download, Monitor, Share, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;
  const appUrl =
    typeof window !== 'undefined' ? window.location.origin : '';

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
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Instalare pe Telefon & Calculator
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rulează ca aplicație dedicată pe ecranul principal sau Desktop.
                </p>
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

            {isInIframe && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2">
                <p>
                  <strong>Important:</strong> Aplicația este deschisă acum în fereastra de previzualizare.
                  Pentru instalare, deschide linkul aplicației <strong>direct în Chrome sau Safari</strong> (într-o filă nouă sau pe telefon):
                </p>
                {appUrl && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 bg-white border border-amber-200 rounded font-mono text-[11px] truncate">
                      {appUrl}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-900 text-white rounded text-[11px] font-medium shrink-0"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Copiat</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copiază link</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-slate-700" />
                  <span>Calculator (Chrome / Edge)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Deschide linkul aplicației într-o filă normală de <strong>Chrome</strong>.</li>
                  <li>
                    Apasă iconița de instalare din dreapta barei de adrese sau meniul{' '}
                    <strong>⋮ → Proiectează, salvează și trimite → Instalează pagina ca aplicație…</strong>
                  </li>
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
                  <Share className="h-3.5 w-3.5 text-blue-700" />
                  <span>iPhone / iPad (Safari)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Deschide linkul aplicației în browserul <strong>Safari</strong>.</li>
                  <li>Apasă butonul <strong>Partajare</strong> (pătratul cu săgeată în sus).</li>
                  <li>Alege <strong>Adaugă pe ecranul principal</strong> (Add to Home Screen).</li>
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
