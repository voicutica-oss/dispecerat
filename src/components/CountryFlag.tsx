import { getCountryFlagEmoji, normalizeCountryCode } from '../utils/countryFlags';

interface CountryFlagProps {
  code: string | undefined | null;
  className?: string;
}

function renderFlagPaths(iso: string) {
  switch (iso) {
    case 'RO':
      return (
        <>
          <rect width="8" height="18" x="0" y="0" fill="#002B7F" />
          <rect width="8" height="18" x="8" y="0" fill="#FCD116" />
          <rect width="8" height="18" x="16" y="0" fill="#CE1126" />
        </>
      );
    case 'DE':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#111827" />
          <rect width="24" height="6" x="0" y="6" fill="#DD0000" />
          <rect width="24" height="6" x="0" y="12" fill="#FFCE00" />
        </>
      );
    case 'FR':
      return (
        <>
          <rect width="8" height="18" x="0" y="0" fill="#0055A4" />
          <rect width="8" height="18" x="8" y="0" fill="#FFFFFF" />
          <rect width="8" height="18" x="16" y="0" fill="#EF4135" />
        </>
      );
    case 'IT':
      return (
        <>
          <rect width="8" height="18" x="0" y="0" fill="#009246" />
          <rect width="8" height="18" x="8" y="0" fill="#FFFFFF" />
          <rect width="8" height="18" x="16" y="0" fill="#CE2B37" />
        </>
      );
    case 'ES':
      return (
        <>
          <rect width="24" height="4.5" x="0" y="0" fill="#AA151B" />
          <rect width="24" height="9" x="0" y="4.5" fill="#F1BF00" />
          <rect width="24" height="4.5" x="0" y="13.5" fill="#AA151B" />
          <rect width="2.4" height="3.6" x="5.2" y="7.2" rx="0.5" fill="#AA151B" />
        </>
      );
    case 'GB':
      return (
        <>
          <rect width="24" height="18" fill="#012169" />
          <path d="M0,0 L24,18 M24,0 L0,18" stroke="#FFFFFF" strokeWidth="3.2" />
          <path d="M0,0 L24,18 M24,0 L0,18" stroke="#C8102E" strokeWidth="1.6" />
          <path d="M12,0 V18 M0,9 H24" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M12,0 V18 M0,9 H24" stroke="#C8102E" strokeWidth="3" />
        </>
      );
    case 'GR':
      return (
        <>
          <rect width="24" height="18" fill="#0D5EAF" />
          <rect width="24" height="2" y="2" fill="#FFFFFF" />
          <rect width="24" height="2" y="6" fill="#FFFFFF" />
          <rect width="24" height="2" y="10" fill="#FFFFFF" />
          <rect width="24" height="2" y="14" fill="#FFFFFF" />
          <rect width="10" height="10" x="0" y="0" fill="#0D5EAF" />
          <rect width="10" height="2" x="0" y="4" fill="#FFFFFF" />
          <rect width="2" height="10" x="4" y="0" fill="#FFFFFF" />
        </>
      );
    case 'HU':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#CE2939" />
          <rect width="24" height="6" x="0" y="6" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="12" fill="#477050" />
        </>
      );
    case 'NL':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#AE1C28" />
          <rect width="24" height="6" x="0" y="6" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="12" fill="#21468B" />
        </>
      );
    case 'BE':
      return (
        <>
          <rect width="8" height="18" x="0" y="0" fill="#111827" />
          <rect width="8" height="18" x="8" y="0" fill="#FAE042" />
          <rect width="8" height="18" x="16" y="0" fill="#ED2939" />
        </>
      );
    case 'AT':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#ED2939" />
          <rect width="24" height="6" x="0" y="6" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="12" fill="#ED2939" />
        </>
      );
    case 'CH':
      return (
        <>
          <rect width="24" height="18" fill="#D52B1E" />
          <rect width="10" height="3.2" x="7" y="7.4" fill="#FFFFFF" />
          <rect width="3.2" height="10" x="10.4" y="4" fill="#FFFFFF" />
        </>
      );
    case 'PL':
      return (
        <>
          <rect width="24" height="9" x="0" y="0" fill="#FFFFFF" />
          <rect width="24" height="9" x="0" y="9" fill="#DC143C" />
        </>
      );
    case 'BG':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="6" fill="#00966E" />
          <rect width="24" height="6" x="0" y="12" fill="#D62612" />
        </>
      );
    case 'CZ':
      return (
        <>
          <rect width="24" height="9" x="0" y="0" fill="#FFFFFF" />
          <rect width="24" height="9" x="0" y="9" fill="#D7141A" />
          <polygon points="0,0 11,9 0,18" fill="#11457E" />
        </>
      );
    case 'SK':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="6" fill="#0B4EA2" />
          <rect width="24" height="6" x="0" y="12" fill="#EE1C25" />
          <rect width="4" height="5" x="5" y="6.5" rx="1" fill="#EE1C25" stroke="#FFFFFF" strokeWidth="0.6" />
        </>
      );
    case 'PT':
      return (
        <>
          <rect width="9" height="18" x="0" y="0" fill="#006600" />
          <rect width="15" height="18" x="9" y="0" fill="#FF0000" />
          <circle cx="9" cy="9" r="3.2" fill="#FFCC00" />
        </>
      );
    case 'LU':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#EF3340" />
          <rect width="24" height="6" x="0" y="6" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="12" fill="#00A3E0" />
        </>
      );
    case 'SE':
      return (
        <>
          <rect width="24" height="18" fill="#006AA7" />
          <rect width="24" height="3.2" x="0" y="7.4" fill="#FECC00" />
          <rect width="3.2" height="18" x="7" y="0" fill="#FECC00" />
        </>
      );
    case 'DK':
      return (
        <>
          <rect width="24" height="18" fill="#C60C30" />
          <rect width="24" height="2.8" x="0" y="7.6" fill="#FFFFFF" />
          <rect width="2.8" height="18" x="7" y="0" fill="#FFFFFF" />
        </>
      );
    case 'NO':
      return (
        <>
          <rect width="24" height="18" fill="#BA0C2F" />
          <rect width="24" height="4.4" x="0" y="6.8" fill="#FFFFFF" />
          <rect width="4.4" height="18" x="6.8" y="0" fill="#FFFFFF" />
          <rect width="24" height="2.4" x="0" y="7.8" fill="#00205B" />
          <rect width="2.4" height="18" x="7.8" y="0" fill="#00205B" />
        </>
      );
    case 'FI':
      return (
        <>
          <rect width="24" height="18" fill="#FFFFFF" />
          <rect width="24" height="3.8" x="0" y="7.1" fill="#003580" />
          <rect width="3.8" height="18" x="7" y="0" fill="#003580" />
        </>
      );
    case 'IE':
      return (
        <>
          <rect width="8" height="18" x="0" y="0" fill="#169B62" />
          <rect width="8" height="18" x="8" y="0" fill="#FFFFFF" />
          <rect width="8" height="18" x="16" y="0" fill="#FF883E" />
        </>
      );
    case 'SI':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="6" fill="#005DA4" />
          <rect width="24" height="6" x="0" y="12" fill="#ED1C24" />
        </>
      );
    case 'HR':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#FF0000" />
          <rect width="24" height="6" x="0" y="6" fill="#FFFFFF" />
          <rect width="24" height="6" x="0" y="12" fill="#171796" />
          <rect width="4" height="4.5" x="10" y="6.7" fill="#FF0000" />
        </>
      );
    case 'RS':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#C6363C" />
          <rect width="24" height="6" x="0" y="6" fill="#0C4076" />
          <rect width="24" height="6" x="0" y="12" fill="#FFFFFF" />
        </>
      );
    case 'TR':
      return (
        <>
          <rect width="24" height="18" fill="#E30A17" />
          <circle cx="9.5" cy="9" r="4.2" fill="#FFFFFF" />
          <circle cx="10.7" cy="9" r="3.3" fill="#E30A17" />
          <polygon points="14.5,7.3 15.1,9 16.8,9 15.4,10 15.9,11.6 14.5,10.6 13.1,11.6 13.6,10 12.2,9 13.9,9" fill="#FFFFFF" />
        </>
      );
    case 'MD':
      return (
        <>
          <rect width="8" height="18" x="0" y="0" fill="#0046AE" />
          <rect width="8" height="18" x="8" y="0" fill="#FFD200" />
          <rect width="8" height="18" x="16" y="0" fill="#CC092F" />
          <rect width="3.2" height="4.5" x="10.4" y="6.8" fill="#8B5A2B" />
        </>
      );
    case 'UA':
      return (
        <>
          <rect width="24" height="9" x="0" y="0" fill="#0057B7" />
          <rect width="24" height="9" x="0" y="9" fill="#FFD700" />
        </>
      );
    case 'LT':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#FDB913" />
          <rect width="24" height="6" x="0" y="6" fill="#006A44" />
          <rect width="24" height="6" x="0" y="12" fill="#C1272D" />
        </>
      );
    case 'LV':
      return (
        <>
          <rect width="24" height="7" x="0" y="0" fill="#9E3039" />
          <rect width="24" height="4" x="0" y="7" fill="#FFFFFF" />
          <rect width="24" height="7" x="0" y="11" fill="#9E3039" />
        </>
      );
    case 'EE':
      return (
        <>
          <rect width="24" height="6" x="0" y="0" fill="#0072CE" />
          <rect width="24" height="6" x="0" y="6" fill="#111827" />
          <rect width="24" height="6" x="0" y="12" fill="#FFFFFF" />
        </>
      );
    default:
      return null;
  }
}

export function hasSvgCountryFlag(code: string | undefined | null): boolean {
  const iso = normalizeCountryCode(code);
  return renderFlagPaths(iso) !== null;
}

export function CountryFlag({
  code,
  className = 'w-4 h-3',
}: CountryFlagProps) {
  const iso = normalizeCountryCode(code);
  if (!iso) return null;

  const paths = renderFlagPaths(iso);
  if (paths) {
    return (
      <svg
        viewBox="0 0 24 18"
        aria-hidden="true"
        className={`${className} inline-block shrink-0 rounded-[2px] ring-1 ring-black/15 overflow-hidden align-middle`}
      >
        {paths}
      </svg>
    );
  }

  const emoji = getCountryFlagEmoji(iso);
  return emoji ? (
    <span aria-hidden="true" className="inline-block shrink-0 leading-none">
      {emoji}
    </span>
  ) : null;
}

export function CountrySvgGroup({
  code,
  x = 0,
  y = 0,
  width = 16,
  height = 12,
}: {
  code: string | undefined | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const iso = normalizeCountryCode(code);
  const paths = iso ? renderFlagPaths(iso) : null;
  if (!paths) return null;
  return (
    <svg x={x} y={y} width={width} height={height} viewBox="0 0 24 18">
      <rect width="24" height="18" fill="#ffffff" />
      {paths}
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="17"
        fill="none"
        stroke="rgba(15,23,42,0.2)"
        strokeWidth="1"
      />
    </svg>
  );
}
