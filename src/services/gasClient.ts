import type { GasMutatePayload, GasPayload } from '../types/fleet';

function isDirectGasEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
    return true;
  }
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  if (import.meta.env.VITE_STATIC_HOST === 'true') return true;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('.github.io') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app')
  );
}

function validateGasUrlClient(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(
      'URL Google Apps Script invalid. Trebuie să înceapă cu https://script.google.com/...'
    );
  }
  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== 'https:' ||
    (host !== 'script.google.com' && host !== 'script.googleusercontent.com')
  ) {
    throw new Error(
      'URL Google Apps Script invalid. Trebuie să înceapă cu https://script.google.com/...'
    );
  }
  return parsed;
}

async function parseDirectGasResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (/<\s*html|<!doctype/i.test(text)) {
      throw new Error(
        'Google Apps Script a returnat o pagină HTML. Verificați că aplicația web este publicată cu acces „Oricine” (Anyone).'
      );
    }
    throw new Error(`Răspuns invalid de la Google Apps Script (HTTP ${res.status}).`);
  }
}

async function directGasSync(scriptUrl: string, key: string): Promise<Record<string, unknown>> {
  const target = validateGasUrlClient(scriptUrl);
  target.searchParams.set('action', 'all');
  target.searchParams.set('key', key);

  const res = await fetch(target.toString(), {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
  });
  const data = await parseDirectGasResponse(res);
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data;
}

async function directGasMutate(
  scriptUrl: string,
  payload: GasMutatePayload
): Promise<{ ok: boolean }> {
  const target = validateGasUrlClient(scriptUrl);
  const res = await fetch(target.toString(), {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action: 'write', ...payload }),
  });
  const data = await parseDirectGasResponse(res);
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return { ok: Boolean(data?.ok ?? true) };
}

function normalizeGasPayload(data: Record<string, unknown>): GasPayload {
  const rawLeave = data.concediu ?? data.concedii ?? data.concediuSoferi ?? [];
  const normalizedLeave: string[][] = Array.isArray(rawLeave)
    ? rawLeave.map((row: unknown) => {
        if (Array.isArray(row)) {
          return row.map((c) => String(c ?? ''));
        }
        if (row && typeof row === 'object') {
          const obj = row as Record<string, unknown>;
          return [
            String(obj.nume ?? obj.name ?? obj.sofer ?? ''),
            String(obj.start ?? obj.deLa ?? obj.startStr ?? ''),
            String(obj.end ?? obj.panaLa ?? obj.endStr ?? obj.start ?? ''),
          ];
        }
        return [];
      })
    : [];

  return {
    scriptVersion:
      typeof data.scriptVersion === 'string' ? data.scriptVersion : undefined,
    curse: Array.isArray(data.curse) ? (data.curse as string[][]) : [],
    vize: Array.isArray(data.vize) ? (data.vize as string[][]) : [],
    flota: Array.isArray(data.flota) ? (data.flota as string[][]) : [],
    concediu: normalizedLeave,
    istoric: Array.isArray(data.istoric) ? (data.istoric as string[][]) : [],
    istoricRemorci: Array.isArray(data.istoricRemorci)
      ? (data.istoricRemorci as string[][])
      : [],
    zileCurse: Array.isArray(data.zileCurse)
      ? (data.zileCurse as string[][])
      : [],
  };
}

export async function syncFromGas(
  scriptUrl: string,
  key: string
): Promise<GasPayload> {
  if (isDirectGasEnvironment()) {
    const data = await directGasSync(scriptUrl, key);
    return normalizeGasPayload(data);
  }

  let data: Record<string, unknown> | null = null;
  let shouldFallbackDirect = false;

  try {
    const response = await fetch('/api/gas/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl, key }),
    });

    if (response.status === 404 || response.status === 405) {
      shouldFallbackDirect = true;
    } else {
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        shouldFallbackDirect = true;
      } else {
        const json = (await response.json()) as Record<string, unknown>;
        if (!response.ok) {
          throw new Error(
            String(json?.error || 'Eroare la sincronizarea cu Google Sheets.')
          );
        }
        data = json;
      }
    }
  } catch (err) {
    if (err instanceof TypeError || err instanceof SyntaxError) {
      shouldFallbackDirect = true;
    } else {
      throw err;
    }
  }

  if (shouldFallbackDirect || !data) {
    data = await directGasSync(scriptUrl, key);
  }

  return normalizeGasPayload(data);
}

export async function mutateGas(
  scriptUrl: string,
  payload: GasMutatePayload
): Promise<{ ok: boolean }> {
  if (isDirectGasEnvironment()) {
    return directGasMutate(scriptUrl, payload);
  }

  try {
    const response = await fetch('/api/gas/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptUrl,
        payload: { action: 'write', ...payload },
      }),
    });

    if (response.status === 404 || response.status === 405) {
      return directGasMutate(scriptUrl, payload);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return directGasMutate(scriptUrl, payload);
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(String(data?.error || 'Eroare la salvarea modificării.'));
    }
    return { ok: Boolean(data?.ok ?? true) };
  } catch (err) {
    if (err instanceof TypeError || err instanceof SyntaxError) {
      return directGasMutate(scriptUrl, payload);
    }
    throw err;
  }
}
