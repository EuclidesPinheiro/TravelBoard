import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'TravelBoard.png', 'TravelBoardIcon.png'],
      manifest: {
        name: 'TravelBoard',
        short_name: 'TravelBoard',
        description: 'Collaborative travel itinerary planner',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365},
              cacheableResponse: {statuses: [0, 200]},
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365},
              cacheableResponse: {statuses: [0, 200]},
            },
          },
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['.trycloudflare.com'],
  },
});
