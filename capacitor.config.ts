import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.radar.mbg',
  appName: 'RADAR MBG',
  webDir: 'out',
  server: {
    // Untuk development, gunakan URL lokal. Untuk production, gunakan domain.
    url: process.env.CAPACITOR_SERVER_URL || 'https://domain-anda.com',
    cleartext: false,
  },
  plugins: {
    Geolocation: {
      // Izin lokasi
    },
    BackgroundGeolocation: {
      // Plugin @capacitor-community/background-geolocation
      // Konfigurasi di runtime, bukan di sini.
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
