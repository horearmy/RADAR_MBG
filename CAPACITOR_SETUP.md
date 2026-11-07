# Setup Capacitor untuk background GPS native (Android)

## Prasyarat
- Node.js 20+
- Android Studio (untuk build APK)
- Java 17+

## 1. Install Capacitor
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/geolocation
npm install @capacitor-community/background-geolocation
npx cap init "RADAR MBG" "com.radar.mbg" --web-dir=out
npx cap add android
```

## 2. Konfigurasi `capacitor.config.ts`
Sudah ada di root. Sesuaikan `server.url` ke domain production.

## 3. Build web app
```bash
npm run build
# Export static (jika menggunakan next export)
# Atau gunakan URL remote (server.url)
```

## 4. Sync & buka Android Studio
```bash
npx cap sync
npx cap open android
```

## 5. Background GPS
- Gunakan `@capacitor-community/background-geolocation` untuk tracking kontinu.
- Plugin ini berjalan di foreground service (Android).
- Konfigurasi di runtime:
  ```ts
  BackgroundGeolocation.addWatcher(
    { backgroundMessage: "RADAR MBG melacak lokasi", backgroundTitle: "Tracking aktif", requestPermissions: true, stale: false, distanceFilter: 10 },
    (location, error) => { ... }
  );
  ```

## 6. Permission Android
Tambahkan di `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

## 7. Build APK
- Dari Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
- Atau CLI: `cd android && ./gradlew assembleRelease`.

## 8. Catatan
- **Background GPS** di Android 10+ memerlukan izin "Allow all the time".
- **Battery optimization** harus dinonaktifkan untuk app.
- **Foreground service** menampilkan notifikasi persistent (wajib Android 8+).
- Untuk update web, cukup redeploy web app (jika menggunakan `server.url` remote); APK tidak perlu rebuild.

## Rekomendasi
- **Mulai dengan TWA** (lebih mudah, update otomatis).
- **Migrasi ke Capacitor** jika memerlukan background GPS yang lebih andal.
- **Jangan gunakan kedua-duanya** (pilih satu).
