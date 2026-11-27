import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import express, { type Request, type RequestHandler } from 'express';
import { createDispatchServer } from '../../backend/dispatch.ts';

export const config = { path: '/api/*' };

const origin = 'https://dispecerat.netlify.app';
const redirectUri = `${origin}/api/auth/google/callback`;
const stateCookie = '__Host-dispecerat_oauth';
const sessionCookie = '__Host-dispecerat_session';
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };
const driveScope = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const googleTimeout = () => AbortSignal.timeout(8000);

function settings() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const sheet = process.env.DISPECERAT_SHEET_ID?.trim() || '';
  const sheetId = sheet.match(/^(?:https:\/\/docs\.google\.com\/spreadsheets\/d\/)?([\w-]+)(?:[/\?#].*)?$/)?.[1];
  const scriptUrl = process.env.DISPECERAT_SCRIPT_URL?.trim();
  const key = process.env.DISPECERAT_SCRIPT_KEY?.trim();
  if (!clientId || !clientSecret || !sheetId || !key || !scriptUrl ||
      !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(scriptUrl)) return null;
  return { clientId, clientSecret, sheetId, scriptUrl, key };
}

type Settings = NonNullable<ReturnType<typeof settings>>;
type Session = { accessToken: string; email: string; expires: number };
type OAuthState = { state: string; verifier: string; email: string; expires: number };

function cookie(req: Request, name: string) {
  return req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

function cookieKey(secret: string, purpose: string) {
  return createHmac('sha256', secret).update(`dispecerat-cookie:${purpose}:v1`).digest();
}

function seal(payload: Session | OAuthState, secret: string, purpose: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cookieKey(secret, purpose), nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function openCookie<Payload extends { expires: number }>(req: Request, purpose: string, secret: string): Payload | null {
  const raw = cookie(req, purpose);
  if (!raw || raw.length > 4000 || !/^[\w-]+$/.test(raw)) return null;
  try {
    const buffer = Buffer.from(raw, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', cookieKey(secret, purpose), buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    const payload: Payload = JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8'));
    return payload.expires > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

async function identityEmail(req: Request) {
  const identityToken = cookie(req, 'nf_jwt');
  if (!/^[\w.-]+$/.test(identityToken)) return null;
  const response = await fetch(`${origin}/.netlify/identity/user`, {
    headers: { Authorization: `Bearer ${identityToken}`, Accept: 'application/json' },
    redirect: 'error', signal: googleTimeout(),
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user.app_metadata?.provider === 'google' && user.confirmed_at && typeof user.email === 'string'
    ? user.email.trim().toLowerCase() : null;
}

async function sheetAccess(accessToken: string, sheetId: string) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sheetId)}`);
  url.search = new URLSearchParams({ fields: 'mimeType,trashed,capabilities(canEdit,canModifyContent)', supportsAllDrives: 'true' }).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'error', signal: googleTimeout(),
  });
  if (response.status === 401) return { status: 401 as const };
  if (response.status === 403 || response.status === 404) return { status: 403 as const };
  if (!response.ok) return { status: 502 as const };
  const file = await response.json();
  if (file.trashed || file.mimeType !== 'application/vnd.google-apps.spreadsheet') return { status: 403 as const };
  return { status: 200 as const, canEdit: file.capabilities?.canEdit === true && file.capabilities?.canModifyContent === true };
}

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  next();
});

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.get('origin') !== origin) {
    res.status(403).json({ error: 'Cererea nu vine de pe adresa oficială a dispeceratului.' });
    return;
  }
  next();
});

app.post('/api/auth/google/start', async (req, res) => {
  const current = settings();
  if (!current) return void res.redirect(303, '/?auth=config');
  try {
    const email = await identityEmail(req);
    if (!email) return void res.redirect(303, '/?auth=identity');
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const maxAge = 10 * 60_000;
    res.cookie(stateCookie, seal({ state, verifier, email, expires: Date.now() + maxAge }, current.clientSecret, stateCookie), { ...cookieOptions, maxAge });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: current.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: `openid email ${driveScope}`,
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      login_hint: email,
    }).toString();
    res.redirect(303, url.toString());
  } catch {
    res.redirect(303, '/?auth=unavailable');
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  const current = settings();
  if (!current) return void res.redirect(303, '/?auth=config');
  const state = openCookie<OAuthState>(req, stateCookie, current.clientSecret);
  res.clearCookie(stateCookie, cookieOptions);
  if (!state || req.query.state !== state.state) return void res.redirect(303, '/?auth=expired');
  if (typeof req.query.code !== 'string') return void res.redirect(303, '/?auth=cancelled');
  try {
    if (await identityEmail(req) !== state.email) return void res.redirect(303, '/?auth=identity');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', redirect: 'error', signal: googleTimeout(),
      body: new URLSearchParams({ client_id: current.clientId, client_secret: current.clientSecret,
        redirect_uri: redirectUri, code: req.query.code, code_verifier: state.verifier, grant_type: 'authorization_code' }),
    });
    if (!tokenResponse.ok) return void res.redirect(303, '/?auth=unavailable');
    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in)) return void res.redirect(303, '/?auth=unavailable');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }, redirect: 'error', signal: googleTimeout(),
    });
    if (!profileResponse.ok) return void res.redirect(303, '/?auth=unavailable');
    const profile = await profileResponse.json();
    if (profile.email_verified !== true || typeof profile.email !== 'string' || profile.email.toLowerCase() !== state.email) {
      return void res.redirect(303, '/?auth=account');
    }
    const access = await sheetAccess(token.access_token, current.sheetId);
    if (access.status !== 200) return void res.redirect(303, access.status === 403 ? '/?auth=denied' : '/?auth=unavailable');
    const maxAge = Math.min(token.expires_in, 3600) * 1000;
    const sealed = seal({ accessToken: token.access_token, email: state.email, expires: Date.now() + maxAge }, current.clientSecret, sessionCookie);
    if (maxAge <= 0 || sealed.length > 3800) return void res.redirect(303, '/?auth=unavailable');
    res.cookie(sessionCookie, sealed, { ...cookieOptions, maxAge });
    res.redirect(303, '/');
  } catch {
    res.redirect(303, '/?auth=unavailable');
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(sessionCookie, cookieOptions);
  res.clearCookie(stateCookie, cookieOptions);
  res.status(204).end();
});

const requireSheet: RequestHandler = async (req, res, next) => {
  const current = settings();
  if (!current) return void res.status(503).json({ error: 'Conectarea la foaia Google nu este încă configurată.' });
  const session = openCookie<Session>(req, sessionCookie, current.clientSecret);
  if (!session) return void res.status(401).json({ error: 'Conectează-te cu contul Google.' });
  try {
    const access = await sheetAccess(session.accessToken, current.sheetId);
    if (access.status !== 200) {
      return void res.status(access.status).json({ error: access.status === 403 ? 'Acest cont Google nu are acces la foaia dispeceratului.' : 'Permisiunea Google nu a putut fi verificată.' });
    }
    res.locals.googleEmail = session.email;
    res.locals.canEdit = access.canEdit;
    next();
  } catch {
    res.status(502).json({ error: 'Permisiunea Google nu a putut fi verificată.' });
  }
};

app.use(requireSheet);
app.get('/api/auth/session', (_req, res) => {
  res.json({ email: res.locals.googleEmail, canEdit: res.locals.canEdit });
});
app.post('/api/gas/mutate', (_req, res, next) => {
  if (!res.locals.canEdit) return void res.status(403).json({ error: 'Acest cont are doar acces de vizualizare în Google Sheets.' });
  next();
});
app.use(createDispatchServer(() => settings()!));

export default app;
