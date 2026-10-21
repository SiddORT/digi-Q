import path from 'path';
import { readFile } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    {
      name: 'public-clinic-initial-html',
      configureServer(server) {
        // Workspace exports are TypeScript with bundler-style imports. Load
        // them through Vite's server module runner, not native Node imports.
        let middleware: Promise<ReturnType<typeof import('@workspace/public-pages').publicHtmlMiddleware>> | undefined;
        server.middlewares.use(async (req, res, next) => {
          try {
            middleware ??= server.ssrLoadModule('@workspace/public-pages').then(({ publicHtmlMiddleware }) =>
              publicHtmlMiddleware(
                () => readFile(path.resolve(import.meta.dirname, 'index.html'), 'utf8'),
                (url: string, html: string) => server.transformIndexHtml(url, html),
              ));
            (await middleware)(req, res, next);
          } catch (error) { next(error); }
        });
      },
    },
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  ssr: {
    noExternal: ['@workspace/public-pages', '@workspace/db', '@workspace/api-zod'],
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
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
