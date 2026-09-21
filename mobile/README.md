# IoT Water Mobile

Expo React Native app cho Android va iOS. App dung giao dien React Native rieng, React Navigation, chart native va goi truc tiep API server hien co.

## Cau truc

```text
src/
  api.js
  context/AuthContext.js
  navigation/index.js
  theme/index.js
  components/
  screens/
```

Tab chinh:

- Trang chu
- Logger
- Bao cao
- PRV
- DMA
- Cai dat

Logger co nested stack: nhom logger -> danh sach logger -> chi tiet logger.

## Cai dat

```bash
npm install
```

## Cau hinh

Mac dinh app mo:

```text
https://khca-s.static.good-dns.net/api/api
```

Neu can doi domain:

```bash
cp .env.example .env
```

Sua:

```text
EXPO_PUBLIC_API_BASE_URL=https://domain-api-cua-ban/api/api
```

## Chay dev

```bash
npm start
```

Sau do quet QR bang Expo Go hoac chon emulator.

## Chay Android/iOS native

```bash
npm run android
npm run ios
```

## Build file cai dat va file day store

Can dang nhap Expo/EAS truoc:

```bash
./build.sh login
```

Lan dau cau hinh project tren EAS:

```bash
npm run eas:init
```

Build APK cai thu truc tiep tren Android:

```bash
./build.sh apk
```

Hoac chay script:

```bash
./build.sh
```

Build production theo project EAS da gan:

```bash
./build.sh production
```

Script production tuong duong:

```bash
npx eas-cli@latest init --id 2f45d8a7-fc78-4ec0-835d-7ec94160ff6d
npx eas-cli@latest build --profile production
```

Build AAB de day Google Play Console:

```bash
npm run build:android:store
```

Build IPA de day App Store Connect/TestFlight:

```bash
npm run build:ios:store
```

Build ca Android va iOS production:

```bash
npm run build:all:store
```

Submit len store bang EAS:

```bash
npm run submit:android
npm run submit:ios
```

iOS bat buoc can Apple Developer Program. Android can Google Play Developer account neu muon upload len Play Console.

## Ghi chu

- `EXPO_PUBLIC_API_BASE_URL` la URL API base, vi du `https://khca-s.static.good-dns.net/api/api`.
- App mobile goi truc tiep server Express, khong dung WebView lam man hinh chinh.
- Truoc khi build release, nen thay icon/splash trong `assets/` bang file PNG dung kich thuoc chuan.
