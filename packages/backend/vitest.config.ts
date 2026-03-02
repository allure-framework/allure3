import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve .js imports to .ts; support both src/ and dist-style paths (compiled layout uses ../../../../domain from postgres). */
function resolveJsToTsPlugin() {
  const rootDir = __dirname;
  const srcDir = resolve(rootDir, 'src');
  return {
    name: 'resolve-js-to-ts',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      if (!source.endsWith('.js')) return null;
      const importerDir = importer ? dirname(importer) : rootDir;
      const candidate = resolve(importerDir, source);
      // Resolved path may be root/domain/... (dist layout) or root/src/domain/... (source layout)
      const tsPath = candidate.slice(0, -3) + '.ts';
      if (existsSync(tsPath)) return tsPath;
      const underSrc = resolve(rootDir, 'src', candidate.replace(rootDir, '').replace(/^\//, ''));
      const tsUnderSrc = underSrc.slice(0, -3) + '.ts';
      if (candidate.startsWith(rootDir) && !candidate.startsWith(srcDir) && existsSync(tsUnderSrc)) {
        return tsUnderSrc;
      }
      if (candidate.startsWith(srcDir) && existsSync(tsPath)) return tsPath;
      return null;
    }
  };
}

export default defineConfig({
  plugins: [resolveJsToTsPlugin()],
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    setupFiles: [resolve(__dirname, 'test/setup-env.ts')],
    hookTimeout: 30_000,
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/migrations/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@domain': resolve(__dirname, './src/domain'),
      '@application': resolve(__dirname, './src/application'),
      '@infrastructure': resolve(__dirname, './src/infrastructure'),
      '@presentation': resolve(__dirname, './src/presentation')
    },
    dedupe: ['typeorm', 'reflect-metadata']
  }
});
