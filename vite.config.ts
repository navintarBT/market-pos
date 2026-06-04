/// <reference types="vitest" />

import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    legacy(),
    VitePWA({
      registerType: "autoUpdate",
      // manifest is managed in public/manifest.json
      manifest: false,
      workbox: {
        // Precache all build output
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // SPA fallback — serve index.html for all navigation requests
        navigateFallback: "/index.html",
        // Don't intercept Firebase or emulator requests
        navigateFallbackDenylist: [/^\/__/, /\/firestore\.googleapis\.com/],
        runtimeCaching: [
          {
            // Cache Google Fonts (if used)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
