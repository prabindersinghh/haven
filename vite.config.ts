import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Plain JS module shared with the production server (server/index.js).
import { createApi, loadConfig } from './server/api.js';

// The Haven API runs inside the Vite dev server, so `npm run dev` is the whole stack.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'haven-api',
        configureServer(server) {
          const api = createApi(loadConfig({ ...process.env, ...env }));
          server.middlewares.use((req, res, next) => void api(req, res, next));
        },
      },
    ],
    build: { target: 'es2020', sourcemap: true, chunkSizeWarningLimit: 1100 },
  };
});
