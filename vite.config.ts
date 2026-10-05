import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const DAY = 24 * 60 * 60;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The app asks before switching to a new version (src/main.tsx).
      registerType: 'prompt',
      manifest: {
        name: 'Mapa USP Butantã',
        short_name: 'Mapa USP',
        description: 'Mapa não oficial do campus Butantã da USP, com acessibilidade e ônibus ao vivo.',
        lang: 'pt-BR',
        display: 'standalone',
        theme_color: '#f8f4f0',
        background_color: '#f8f4f0',
        categories: ['navigation', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, basemap style and campus data are downloaded on the first visit.
        globPatterns: ['**/*.{js,css,html,json,geojson,png,svg}'],
        // The 3D code, its trees and its roofs are only fetched when 3D is on; they are cached on first use below.
        globIgnores: ['**/render3d-*.js', 'data/trees.json', 'data/roofs.json', 'data/indoor/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // The first install takes over the open page at once, so tiles start being cached on the first visit.
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/render3d-.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'render3d', expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: /\/data\/(trees|roofs)\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'render3d-data', expiration: { maxEntries: 4 } },
          },
          {
            // A building's floor plans are fetched when its indoor map is first opened.
            urlPattern: /\/data\/indoor\/.+\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'indoor', expiration: { maxEntries: 20 } },
          },
          {
            // The tile index names the current tile set, so it must be refreshed.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/planet$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'basemap-index', expiration: { maxEntries: 2 } },
          },
          {
            // Tiles carry their version in the URL; fonts and sprites rarely change.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap',
              expiration: { maxEntries: 600, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Wikipedia summaries and photo lists: shown from the cache at once, refreshed in the background.
            urlPattern: /^https:\/\/(pt\.wikipedia\.org\/(api\/rest_v1\/page\/summary|w\/api\.php)|www\.wikidata\.org\/w\/api\.php)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'wiki',
              expiration: { maxEntries: 120, maxAgeSeconds: 30 * DAY },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Photos are loaded by <img>, so their responses are opaque (status 0).
            urlPattern: /^https:\/\/(upload|thumb)\.wikimedia\.org\/.+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wiki-photos',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Everything else (the Worker, Transitous, Photon) always goes to the network.
        ],
      },
    }),
  ],
  server: {
    // In dev the app calls the Worker through this same-origin path, so it
    // also works from a phone on the LAN (no CORS, no localhost on the phone).
    proxy: {
      '/api': { target: 'http://localhost:8787', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
