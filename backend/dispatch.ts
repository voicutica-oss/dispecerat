import express from 'express';
import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

function validateGasUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (host !== 'script.google.com' && host !== 'script.googleusercontent.com') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

type GasParseResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

async function parseGasResponse(res: Response): Promise<GasParseResult> {
  const text = await res.text();
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    const looksLikeHtml = /<\s*html|<!doctype/i.test(text);
    if (looksLikeHtml) {
      return {
        ok: false,
        status: 502,
        error:
          'Google Apps Script a returnat o pagină HTML (probabil de autentificare). Verificați că aplicația web este publicată cu acces „Oricine” (Anyone).',
      };
    }
    return {
      ok: false,
      status: 502,
      error: `Răspuns invalid de la Google Apps Script (HTTP ${res.status}).`,
    };
  }
}

type ManagedSheet = { scriptUrl: string; key: string; sheetId: string };

function requestManagedScript(managed: ManagedSheet, payload: object, timeout: number) {
  return fetch(managed.scriptUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ ...payload, key: managed.key, sheetId: managed.sheetId }),
  });
}

export function createDispatchServer(managedSheet?: () => ManagedSheet) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/maps/grounding', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Cheia GEMINI_API_KEY nu este configurată pe server. Verificați Settings > Secrets.',
      });
      return;
    }

    const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const rawDestination =
      typeof req.body?.destination === 'string' ? req.body.destination.trim() : '';
    const rawCountry =
      typeof req.body?.country === 'string' ? req.body.country.trim() : '';
    const latLng = req.body?.latLng;

    const searchSubject = rawQuery || [rawCountry, rawDestination].filter(Boolean).join(' - ');
    if (!searchSubject) {
      res.status(400).json({ error: 'Introduceți o localitate sau o căutare pentru Google Maps.' });
      return;
    }

    const promptParts = [
      'Ești asistent de dispecerat transport marfă în Europa.',
      `Oferă informații reale, scurte și utile din Google Maps pentru destinația sau interogarea: "${searchSubject}".`,
      'Include unde este relevant: localizarea exactă / zona industrială, opțiuni de parcare camioane sau stații/servicii rutiere din apropiere și recomandări practice de acces.',
      'Răspunde concis în limba română folosind Markdown.',
    ];

    const config: {
      tools: Array<{ googleMaps: Record<string, never> }>;
      toolConfig?: {
        retrievalConfig: {
          latLng: { latitude: number; longitude: number };
        };
      };
    } = {
      tools: [{ googleMaps: {} }],
    };

    if (
      latLng &&
      typeof latLng === 'object' &&
      typeof latLng.latitude === 'number' &&
      typeof latLng.longitude === 'number' &&
      Number.isFinite(latLng.latitude) &&
      Number.isFinite(latLng.longitude)
    ) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: latLng.latitude,
            longitude: latLng.longitude,
          },
        },
      };
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptParts.join(' '),
        config,
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const places: Array<{
        title: string;
        uri: string;
        placeId?: string;
        reviewSnippets: string[];
      }> = [];
      const seenUris = new Set<string>();

      if (Array.isArray(rawChunks)) {
        for (const chunk of rawChunks) {
          const maps = (chunk as {
            maps?: {
              uri?: string;
              title?: string;
              placeId?: string;
              placeAnswerSources?: {
                reviewSnippets?: Array<string | { content?: string; text?: string }>;
              };
            };
          })?.maps;
          if (!maps?.uri) continue;
          if (seenUris.has(maps.uri)) continue;
          seenUris.add(maps.uri);

          const rawSnippets = maps.placeAnswerSources?.reviewSnippets;
          const reviewSnippets: string[] = [];
          if (Array.isArray(rawSnippets)) {
            for (const item of rawSnippets) {
              if (typeof item === 'string' && item.trim()) {
                reviewSnippets.push(item.trim());
              } else if (item && typeof item === 'object') {
                const text = String(item.content || item.text || '').trim();
                if (text) reviewSnippets.push(text);
              }
            }
          }

          places.push({
            title: String(maps.title || 'Locație Google Maps').trim(),
            uri: maps.uri,
            placeId: maps.placeId,
            reviewSnippets,
          });
        }
      }

      res.json({
        text: (response.text ?? '').trim(),
        places,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const statusMatch = message.match(/\b(400|403|404|429)\b/);
      const status = statusMatch ? Number(statusMatch[1]) : 502;

      let friendlyError = `Eroare Google Maps Grounding: ${message}`;
      if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) {
        friendlyError =
          'Cota Gemini API pentru Google Maps Grounding a fost depășită (429). Verificați planul/cota sau selectați o cheie cu facturare activă în Settings > Secrets.';
      } else if (status === 403 || status === 400 || /API_KEY|PERMISSION_DENIED/i.test(message)) {
        friendlyError =
          'Cheia Gemini API este invalidă sau nu are permisiune pentru acest serviciu. Verificați Settings > Secrets.';
      } else if (status === 404 || /NOT_FOUND/i.test(message)) {
        friendlyError =
          'Serviciul sau modelul solicitat nu a fost găsit (404).';
      }

      res.status(status).json({
        error: friendlyError,
      });
    }
  });

  app.post('/api/gas/sync', async (req, res) => {
    const managed = managedSheet?.();
    const scriptUrl = validateGasUrl(managed ? managed.scriptUrl : req.body?.scriptUrl);
    const key = managed ? managed.key : typeof req.body?.key === 'string' ? req.body.key : '';

    if (!scriptUrl) {
      res.status(400).json({
        error:
          'URL Google Apps Script invalid. Trebuie să înceapă cu https://script.google.com/...',
      });
      return;
    }

    if (!key.trim()) {
      res.status(400).json({ error: 'Parola (key) este obligatorie.' });
      return;
    }

    try {
      const target = new URL(scriptUrl);
      target.searchParams.set('action', 'all');
      target.searchParams.set('key', key);
      const upstream = managed ? await requestManagedScript(managed, { action: 'read' }, 25000) : await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
        headers: {
          Accept: 'application/json',
        },
      });

      const parsed = await parseGasResponse(upstream);
      if (!parsed.ok) {
        res.status(parsed.status).json({ error: parsed.error });
        return;
      }

      if (parsed.data && typeof parsed.data === 'object' && 'error' in parsed.data) {
        res.status(managed ? 502 : 401).json({ error: managed ? 'Conexiunea la foaia Google nu este configurată corect.' : String(parsed.data.error) });
        return;
      }

      if (managed && (!parsed.data || typeof parsed.data !== 'object' || !('sheetId' in parsed.data) || parsed.data.sheetId !== managed.sheetId)) {
        res.status(502).json({ error: 'Scriptul nu confirmă foaia Google configurată.' });
        return;
      }

      res.json(parsed.data);
    } catch {
      res.status(502).json({ error: 'Nu s-a putut conecta la Google Apps Script.' });
    }
  });

  app.post('/api/gas/mutate', async (req, res) => {
    const managed = managedSheet?.();
    const scriptUrl = validateGasUrl(managed ? managed.scriptUrl : req.body?.scriptUrl);
    const payload = req.body?.payload;

    if (!scriptUrl) {
      res.status(400).json({
        error:
          'URL Google Apps Script invalid. Trebuie să înceapă cu https://script.google.com/...',
      });
      return;
    }

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Datele trimise lipsesc.' });
      return;
    }

    try {
      if (managed) {
        const verification = await requestManagedScript(managed, { action: 'verifySheet' }, 8000);
        const result = verification.ok ? await verification.json() : null;
        if (result?.ok !== true || result?.sheetId !== managed.sheetId) {
          res.status(502).json({ error: 'Scriptul nu confirmă foaia Google configurată.' });
          return;
        }
      }
      const upstream = managed ? await requestManagedScript(managed, {
        action: 'write', kind: payload.kind, row: payload.row, values: payload.values,
        loc: payload.loc, user: res.locals.googleEmail,
      }, 25000) : await fetch(scriptUrl, {
        method: 'POST',
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const parsed = await parseGasResponse(upstream);
      if (!parsed.ok) {
        res.status(parsed.status).json({ error: parsed.error });
        return;
      }

      if (parsed.data && typeof parsed.data === 'object' && 'error' in parsed.data) {
        res.status(400).json({ error: String(parsed.data.error) });
        return;
      }

      res.json(parsed.data);
    } catch {
      res.status(502).json({ error: 'Nu s-a putut salva în Google Apps Script.' });
    }
  });

  return app;
}
