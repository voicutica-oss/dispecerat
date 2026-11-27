import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createDispatchServer } from './backend/dispatch.ts';

dotenv.config();

const app = createDispatchServer();
const port = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(import.meta.dirname, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    plugins: [{
      name: 'disable-vite-client-ws',
      enforce: 'post',
      transform(code, id) {
        if (id.replaceAll('\\', '/').endsWith('/vite/dist/client/client.mjs')) {
          return code.replace(
            /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
            'const transport = normalizeModuleRunnerTransport({ async connect() {}, async disconnect() {}, send() {} });',
          );
        }
      },
    }],
    server: { middlewareMode: true, hmr: false },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => console.log(`Server listening on http://localhost:${port}`));
