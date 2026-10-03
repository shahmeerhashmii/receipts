import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/receipts/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Receipts',
        short_name: 'Receipts',
        description: 'Proof of who\'s actually better.',
        theme_color: '#0D0F12',
        background_color: '#0D0F12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/receipts/',
        scope: '/receipts/',
        icons: [
          {
            src: '/receipts/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/receipts/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/receipts/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/receipts/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
