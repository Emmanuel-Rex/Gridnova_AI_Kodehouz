
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3000);
const BACKEND_URL = 'https://gridnova-ai-kodehouz.onrender.com';
const ADMIN_KEY = process.env.GRIDNOVA_ADMIN_KEY;
const DASHBOARD_PASSWORD = process.env.GRIDNOVA_DASHBOARD_PASSWORD;
const SESSION_SECRET = process.env.GRIDNOVA_SESSION_SECRET;

if (!ADMIN_KEY || !DASHBOARD_PASSWORD || !SESSION_SECRET ||
    SESSION_SECRET.length < 32) {
  throw new Error(
    'Set GRIDNOVA_ADMIN_KEY, GRIDNOVA_DASHBOARD_PASSWORD ' +
    'and GRIDNOVA_SESSION_SECRET (at least 32 characters).'
  );
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '4kb' }));

const sessions = new Map();
const SESSION_DURATION = 8 * 60 * 60 * 1000;

function constantTimeMatch(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));

  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

function getCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((part) => {
        const index = part.indexOf('=');
        return index < 0
          ? ['', '']
          : [
              part.slice(0, index).trim(),
              part.slice(index + 1).trim()
            ];
      })
      .filter(([key]) => key)
  );
}

function getSession(req) {
  const token = getCookies(req).gridnova_session;
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expires) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function requireAuth(req, res, next) {
  if (!getSession(req)) {
    return res.status(401).json({
      detail: 'Dashboard login required'
    });
  }

  next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { detail: 'Too many login attempts. Try later.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

app.post('/auth/login', loginLimiter, (req, res) => {
  const password = req.body?.password;

  if (
    typeof password !== 'string' ||
    !constantTimeMatch(password, DASHBOARD_PASSWORD)
  ) {
    return res.status(401).json({
      detail: 'Invalid password'
    });
  }

  const token = randomBytes(32).toString('hex');

  sessions.set(token, {
    expires: Date.now() + SESSION_DURATION
  });

  res.cookie('gridnova_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION,
    path: '/'
  });

  res.json({ authenticated: true });
});

app.get('/auth/session', (req, res) => {
  res.json({
    authenticated: Boolean(getSession(req))
  });
});

app.post('/auth/logout', requireAuth, (req, res) => {
  const token = getCookies(req).gridnova_session;
  sessions.delete(token);

  res.clearCookie('gridnova_session', {
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  res.json({ authenticated: false });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gridnova-dashboard' });
});

app.use('/gridnova-proxy', requireAuth, apiLimiter);

app.use('/gridnova-proxy', async (req, res) => {
  const pathname = req.path;
  const method = req.method;

  const isReport =
    method === 'GET' &&
    /^\/reports\/(daily|weekly|monthly|annual)$/.test(pathname);

  const allowed =
    (pathname === '/status' && method === 'GET') ||
    (pathname === '/command' && method === 'POST') ||
    isReport;

  if (!allowed) {
    return res.status(404).json({ detail: 'Not found' });
  }

  const format = String(req.query.format || 'csv');

  if (isReport && !['csv', 'xlsx', 'pdf'].includes(format)) {
    return res.status(400).json({
      detail: 'Invalid report format'
    });
  }

  if (method === 'POST') {
    const command = req.body?.command;

    if (
      typeof command !== 'string' ||
      !/^(?:1|2|auto|demo|reset|limit (?:[1-9]\d{0,2}))$/.test(command)
    ) {
      return res.status(400).json({
        detail: 'Invalid device command'
      });
    }
  }

  try {
    const query = isReport
      ? `?format=${encodeURIComponent(format)}`
      : '';

    const upstream = await fetch(
      `${BACKEND_URL}/api/v1/gridsense${pathname}${query}`,
      {
        method,
        headers: {
          'x-admin-key': ADMIN_KEY,
          ...(method === 'POST'
            ? { 'content-type': 'application/json' }
            : {})
        },
        ...(method === 'POST'
          ? { body: JSON.stringify(req.body) }
          : {}),
        signal: AbortSignal.timeout(60000)
      }
    );

    res.status(upstream.status);
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ||
        'application/octet-stream'
    );
    res.setHeader('Cache-Control', 'no-store');

    const disposition =
      upstream.headers.get('content-disposition');

    if (disposition) {
      res.setHeader('Content-Disposition', disposition);
    }

    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).json({
      detail: 'Backend temporarily unavailable'
    });
  }
});

const distPath = path.join(__dirname, 'dist');

if (!existsSync(path.join(distPath, 'index.html'))) {
  throw new Error('Production build missing. Run npm run build.');
}

app.use(express.static(distPath, {
  index: false
}));

app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gridnova dashboard listening on port ${PORT}`);
});
