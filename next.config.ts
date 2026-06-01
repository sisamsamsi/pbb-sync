import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.endsWith(".pdf"),
        handler: "CacheFirst",
        options: {
          cacheName: "pdf-cache",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
          },
        },
      },
      {
        urlPattern: ({ url }) => url.origin === "https://maps.googleapis.com" || url.origin === "https://maps.gstatic.com",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-maps-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  /* Tambahkan opsi konfigurasi Next.js lainnya di sini jika diperlukan */
};

export default withPWA(nextConfig);
