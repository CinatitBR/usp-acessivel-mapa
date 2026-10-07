import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

/** The repository's root. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The suite runs its own app and Worker on these ports, apart from `npm run dev` and `npm run worker:dev`. */
export const APP_PORT = 5183;
export const WORKER_PORT = 8797;
export const APP_URL = `http://localhost:${APP_PORT}`;
/** The suite's own local database; your `worker/.wrangler/state` is never opened. */
export const STATE_DIR = resolve(ROOT, '.wrangler/journey');
export const SCREENSHOTS_DIR = resolve(ROOT, 'docs/journey/screenshots');

/**
 * Takes the screenshots of docs/journey/journey.md, one test per slide:
 * `npm run journey:screenshots`, or `npm run journey:screenshots -- -g s13` for one slide.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'slides.spec.ts',
  outputDir: resolve(ROOT, 'test-results'),
  globalSetup: './global-setup.ts',
  // Slides share one Worker, one database and public services with request limits.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: APP_URL,
    // The Chrome already installed; no browser is downloaded.
    channel: 'chrome',
    // The map needs WebGL, which headless Chrome only has with these.
    // In Portuguese, so the browser's own pieces (a date field) read as they do in Brazil.
    launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--lang=pt-BR'], env: { ...process.env, LANGUAGE: 'pt_BR', LANG: 'pt_BR.UTF-8' } },
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Where "Usar minha localização" finds the person: at the Praça do Relógio.
    geolocation: { longitude: -46.7245, latitude: -23.5599 },
    permissions: ['geolocation'],
    actionTimeout: 20_000,
  },
});
