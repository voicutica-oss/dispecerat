export function normalizeCountryCode(raw: string | undefined | null): string {
  const clean = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '');
  if (!clean) return '';

  const firstToken = clean.split(/[\s\-/,]+/)[0] || clean;

  const aliases: Record<string, string> = {
    RO: 'RO',
    ROM: 'RO',
    ROMANIA: 'RO',
    DE: 'DE',
    D: 'DE',
    DEU: 'DE',
    GER: 'DE',
    GERMANIA: 'DE',
    GERMANY: 'DE',
    FR: 'FR',
    F: 'FR',
    FRA: 'FR',
    FRANTA: 'FR',
    FRANCE: 'FR',
    IT: 'IT',
    I: 'IT',
    ITA: 'IT',
    ITALIA: 'IT',
    ITALY: 'IT',
    ES: 'ES',
    E: 'ES',
    ESP: 'ES',
    SPANIA: 'ES',
    SPAIN: 'ES',
    GB: 'GB',
    UK: 'GB',
    GBR: 'GB',
    ANGLIA: 'GB',
    GR: 'GR',
    GRE: 'GR',
    GRECIA: 'GR',
    GREECE: 'GR',
    HU: 'HU',
    H: 'HU',
    HUN: 'HU',
    UNGARIA: 'HU',
    HUNGARY: 'HU',
    NL: 'NL',
    NLD: 'NL',
    OLANDA: 'NL',
    NETHERLANDS: 'NL',
    CH: 'CH',
    CHE: 'CH',
    ELVETIA: 'CH',
    SWITZERLAND: 'CH',
    AT: 'AT',
    A: 'AT',
    AUT: 'AT',
    AUSTRIA: 'AT',
    BE: 'BE',
    B: 'BE',
    BEL: 'BE',
    BELGIA: 'BE',
    BELGIUM: 'BE',
    PL: 'PL',
    POL: 'PL',
    POLONIA: 'PL',
    POLAND: 'PL',
    BG: 'BG',
    BGR: 'BG',
    BULGARIA: 'BG',
    CZ: 'CZ',
    CZE: 'CZ',
    CEHIA: 'CZ',
    SK: 'SK',
    SVK: 'SK',
    SLOVACIA: 'SK',
    PT: 'PT',
    P: 'PT',
    PRT: 'PT',
    PORTUGALIA: 'PT',
    LU: 'LU',
    L: 'LU',
    LUX: 'LU',
    LUXEMBURG: 'LU',
    SE: 'SE',
    S: 'SE',
    SWE: 'SE',
    SUEDIA: 'SE',
    DK: 'DK',
    DNK: 'DK',
    DANEMARCA: 'DK',
    NO: 'NO',
    N: 'NO',
    NOR: 'NO',
    NORVEGIA: 'NO',
    FI: 'FI',
    FIN: 'FI',
    FINLANDA: 'FI',
    IE: 'IE',
    IRL: 'IE',
    IRLANDA: 'IE',
    SI: 'SI',
    SLO: 'SI',
    SVN: 'SI',
    SLOVENIA: 'SI',
    HR: 'HR',
    HRV: 'HR',
    CROATIA: 'HR',
    RS: 'RS',
    SRB: 'RS',
    SERBIA: 'RS',
    TR: 'TR',
    TUR: 'TR',
    TURCIA: 'TR',
    MD: 'MD',
    MDA: 'MD',
    MOLDOVA: 'MD',
    UA: 'UA',
    UKR: 'UA',
    UCRAINA: 'UA',
    LT: 'LT',
    LV: 'LV',
    EE: 'EE',
  };

  if (aliases[clean]) return aliases[clean];
  if (aliases[firstToken]) return aliases[firstToken];
  if (/^[A-Z]{2}$/.test(firstToken)) return firstToken;
  return '';
}

export function getCountryFlagEmoji(raw: string | undefined | null): string {
  const iso = normalizeCountryCode(raw);
  if (!iso || iso.length !== 2) return '';
  const codePoints = Array.from(iso).map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

export function formatCountryOption(raw: string | undefined | null): string {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  const emoji = getCountryFlagEmoji(clean);
  return emoji ? `${emoji} ${clean}` : clean;
}
