
import path from 'path';
import { readFile } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const projectRoot = path.resolve(import.meta.dirname, '../..');

// Load environment variables from the root .env file.
const env = loadEnv( process.env.NODE_ENV || 'development', projectRoot, '', );

// Make loaded environment variables available to SSR modules.
// Existing system environment variables take precedence.
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const rawPort = process.env.NODE_ENV !== 'production' ? process.env.FRONTEND_PORT : process.env.PORT;

if (!rawPort) {
  throw new Error(
    `${process.env.NODE_ENV !== 'production' ? 'FRONTEND_PORT' : 'PORT'} environment variable is required.`
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid ${process.env.NODE_ENV !== 'production' ? 'FRONTEND_PORT' : 'PORT'} value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error('BASE_PATH environment variable is required.');
}

export default defineConfig({
  base: basePath,
  plugins: [
    {
      name: 'public-clinic-initial-html',
      configureServer(server) {
        let middleware:
          | Promise<
              ReturnType<
                typeof import('@workspace/public-pages').publicHtmlMiddleware
              >
            >
          | undefined;

        server.middlewares.use(async (req, res, next) => {
          try {
            middleware ??= server
              .ssrLoadModule('@workspace/public-pages')
              .then(({ publicHtmlMiddleware }) =>
                publicHtmlMiddleware(
                  () =>
                    readFile(
                      path.resolve(import.meta.dirname, 'index.html'),
                      'utf8',
                    ),
                  (url: string, html: string) =>
                    server.transformIndexHtml(url, html),
                ),
              );

            (await middleware)(req, res, next);
          } catch (error) {
            next(error);
          }
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
    noExternal: [
      '@workspace/public-pages',
      '@workspace/db',
      '@workspace/api-zod',
    ],
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
    ...(process.env.NODE_ENV !== 'production'
      ? {
          proxy: {
            '/api': {
              target: `http://localhost:${process.env.PORT || '5000'}`,
              changeOrigin: true,
              secure: false,
            },
          },
        }
      : {}),

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
