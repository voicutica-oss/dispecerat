import type { GasConfig } from '../types/fleet';

export const DEFAULT_PUBLIC_APP_URL = 'https://voicutica-oss.github.io/dispecerat/';
const PUBLIC_URL_STORAGE_KEY = 'dispecerat_public_web_url_v1';

export function isPrivateAppOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  const host = window.location.hostname.toLowerCase();
  return (
    proto === 'capacitor:' ||
    proto === 'file:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('ais-dev-')
  );
}

export function normalizeBaseWebUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return DEFAULT_PUBLIC_APP_URL;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return DEFAULT_PUBLIC_APP_URL;
    }
    u.search = '';
    u.hash = '';
    const pathname = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
    return `${u.origin}${pathname}`;
  } catch {
    return DEFAULT_PUBLIC_APP_URL;
  }
}

export function getPublicBaseUrl(): string {
  if (typeof window !== 'undefined' && !isPrivateAppOrigin()) {
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.startsWith('/') ? base : `/${base}`;
    return `${window.location.origin}${cleanBase.endsWith('/') ? cleanBase : `${cleanBase}/`}`;
  }
  try {
    const saved = localStorage.getItem(PUBLIC_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      return normalizeBaseWebUrl(saved);
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_PUBLIC_APP_URL;
}

export function savePublicBaseUrl(rawUrl: string): string {
  const normalized = normalizeBaseWebUrl(rawUrl);
  try {
    localStorage.setItem(PUBLIC_URL_STORAGE_KEY, normalized);
  } catch {
    // ignore
  }
  return normalized;
}

export function buildPhoneShareUrl(
  scriptUrl: string,
  key: string,
  user: string,
  customBaseUrl?: string
): string {
  const base = customBaseUrl
    ? normalizeBaseWebUrl(customBaseUrl)
    : getPublicBaseUrl();
  const params = new URLSearchParams({
    gas: scriptUrl.trim(),
    key: key.trim() || 'TRANSPORT',
    user: user.trim() || 'Dispecer',
  });
  return `${base}?${params.toString()}`;
}

export function parsePhoneShareOrGasInput(raw: string): {
  scriptUrl: string;
  key?: string;
  user?: string;
} | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const gasParam = (parsed.searchParams.get('gas') || '').trim();
    if (gasParam.startsWith('https://script.google.com/')) {
      const k = (parsed.searchParams.get('key') || '').trim();
      const u = (parsed.searchParams.get('user') || '').trim();
      return {
        scriptUrl: gasParam,
        key: k || undefined,
        user: u || undefined,
      };
    }
  } catch {
    // not a valid URL with ?gas=
  }
  return null;
}

export function readStoredGasConfig(): GasConfig | null {
  try {
    const raw = localStorage.getItem('dispecerat_gas_config_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GasConfig>;
    if (parsed.mode === 'live' && parsed.scriptUrl) {
      return {
        scriptUrl: parsed.scriptUrl,
        key: parsed.key || 'TRANSPORT',
        user: parsed.user || 'Dispecer',
        mode: 'live',
      };
    }
  } catch {
    // ignore
  }
  return null;
}
