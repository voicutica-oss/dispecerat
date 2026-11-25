import { ExternalLink, Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  queryMapsGrounding,
  type MapsGroundingResult,
} from '../services/mapsClient';

interface MapsLookupPanelProps {
  title?: string;
  subtitle?: string;
  quickSuggestions?: Array<{ label: string; query: string }>;
  initialQuery?: string;
  compact?: boolean;
}

export function MapsLookupPanel({
  title = 'Asistent Locații & Parcări Camioane (Google Maps)',
  subtitle = 'Verifică destinații de descărcare, zone industriale și parcări camioane cu date actualizate Google Maps.',
  quickSuggestions = [],
  initialQuery = '',
  compact = false,
}: MapsLookupPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [useGeo, setUseGeo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MapsGroundingResult | null>(null);

  const runSearch = async (textToSearch: string) => {
    const clean = textToSearch.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queryMapsGrounding({
        query: clean,
        useGeolocation: useGeo,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSearch(query);
  };

  return (
    <section
      aria-label={title}
      className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${
        compact ? 'p-3.5 space-y-3 bg-slate-50/60' : ''
      }`}
    >
      <div className={compact ? 'space-y-1' : 'px-5 py-3.5 border-b border-slate-200'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-700 shrink-0" />
            <h2 className="font-display text-sm font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useGeo}
              onChange={(e) => setUseGeo(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <Navigation className="h-3 w-3 text-slate-400" />
            <span>Folosește locația curentă</span>
          </label>
        </div>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className={compact ? 'space-y-3' : 'p-5 space-y-4'}>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex. Parcare camioane lângă DE-26723 Emden sau zonă industrială Vitoria"
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Se caută...</span>
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5" />
                <span>Caută pe Maps</span>
              </>
            )}
          </button>
        </form>

        {quickSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500 mr-1">
              Destinații active:
            </span>
            {quickSuggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={loading}
                onClick={() => {
                  setQuery(s.query);
                  void runSearch(s.query);
                }}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-md transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3 pt-1">
            {result.text && (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 space-y-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold">
                <ReactMarkdown>{result.text}</ReactMarkdown>
              </div>
            )}

            {result.places.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Locații Google Maps identificate ({result.places.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {result.places.map((place, idx) => (
                    <a
                      key={`${place.uri}-${idx}`}
                      href={place.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-blue-700">
                          {place.title}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      </div>
                      {place.reviewSnippets.length > 0 && (
                        <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                          {place.reviewSnippets.slice(0, 2).map((snip, sIdx) => (
                            <li key={sIdx} className="line-clamp-2">
                              „{snip}”
                            </li>
                          ))}
                        </ul>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
