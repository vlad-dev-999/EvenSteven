import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// BASE_PATH defaults to '/' — used as the Vite `base` option.
// Set to a sub-path (e.g. '/app') if the frontend is not served from root.
const basePath = process.env.BASE_PATH ?? '/';

// PORT is only used by the dev/preview server; `vite build` does not need it.
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

export default defineConfig(async () => {
  const plugins = [
    react(),
    tailwindcss(),
  ];

  // Replit-only dev plugins — only loaded inside a Replit workspace, never in production builds.
  if (process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined) {
    const [
      { default: runtimeErrorOverlay },
      { cartographer },
      { devBanner },
    ] = await Promise.all([
      import('@replit/vite-plugin-runtime-error-modal'),
      import('@replit/vite-plugin-cartographer'),
      import('@replit/vite-plugin-dev-banner'),
    ]);
    plugins.push(
      runtimeErrorOverlay(),
      cartographer({ root: path.resolve(import.meta.dirname, '..') }),
      devBanner(),
    );
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: { strict: true },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
