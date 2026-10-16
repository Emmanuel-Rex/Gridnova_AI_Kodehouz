import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Development-only proxy. Keep bound to localhost; never publish this server.
function gridnovaProxy(): Plugin {
  return {
    name: 'gridnova-local-api-proxy',
    configureServer(server) {
      server.middlewares.use('/gridnova-proxy', async (req, res) => {
        const key = process.env.GRIDNOVA_ADMIN_KEY;
        if (!key) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ detail: 'GRIDNOVA_ADMIN_KEY is not set in the Vite server environment' }));
          return;
        }

        const rawUrl = req.url || '/';
        const parsed = new URL(rawUrl, 'http://localhost');
        const pathname = parsed.pathname;
        const method = req.method || 'GET';
        const isReport = method === 'GET' && /^\/reports\/(daily|weekly|monthly|annual)$/.test(pathname);
        const allowed = (pathname === '/status' && method === 'GET') ||
          (pathname === '/command' && method === 'POST') || isReport;
        if (!allowed) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        if (isReport) {
          const format = parsed.searchParams.get('format') || 'csv';
          if (!['csv', 'xlsx', 'pdf'].includes(format)) {
            res.statusCode = 400;
            res.end('Invalid report format');
            return;
          }
        }

        try {
          let body: string | undefined;
          if (method === 'POST') {
            const chunks: Buffer[] = [];
            let totalBytes = 0;
            for await (const chunk of req) {
              const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              totalBytes += part.length;
              if (totalBytes > 4096) {
                res.statusCode = 413;
                res.end('Request too large');
                return;
              }
              chunks.push(part);
            }
            body = Buffer.concat(chunks).toString('utf8');
          }

          const upstream = await fetch(
            `https://gridnova-ai-kodehouz.onrender.com/api/v1/gridsense${pathname}${parsed.search}`,
            {
              method,
              headers: {
                'x-admin-key': key,
                ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
              },
              body,
              signal: AbortSignal.timeout(60000),
            }
          );

          res.statusCode = upstream.status;
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-store');
          const disposition = upstream.headers.get('content-disposition');
          if (disposition) res.setHeader('Content-Disposition', disposition);
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ detail: error instanceof Error ? `${error.name}: ${error.message}` : 'Upstream connection failed' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), gridnovaProxy()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
