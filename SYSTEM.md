# IoT Water System Notes

## Tong quan

He thong hien tai gom 3 phan chinh:

- `server/`: Node.js + Express API, ket noi MongoDB, MQTT va Redis.
- `frontend/`: React + Vite web app cho dashboard quan ly IoT Water.
- `mobile/`: Expo React Native app chay tren Android/iOS, dung WebView de tai web app hien co va su dung chung backend.

Mobile app dang duoc thiet ke theo huong native shell. Cach nay giu day du tinh nang cua web hien co vi app tai truc tiep web dashboard, dong thoi van co the build thanh ung dung Android va iOS.

## Backend

Thu muc: `server/`

Lenh chay:

```bash
cd server
npm install
npm run dev
```

Lenh production:

```bash
cd server
npm install
npm start
```

Server doc bien moi truong tu `server/.env` bang co `node --env-file=.env`.

Route chinh:

- `/api/auth`: dang nhap, xac thuc token, thong tin user, FCM token.
- `/api/upload`: upload va lay anh logger.
- `/api/sensor`: danh sach sensor, canh bao, report, export du lieu.
- `/api/group`: nhom sensor.
- `/api/prv`: dieu khien va cau hinh PRV.
- `/api/dma`: DMA/loss calculation.
- `/api/dnp-config`: cau hinh DNP.
- `/api/map-points`: diem su co tu do tren ban do + thong ke diem nong.
- `/api/ai`: trang thai va probe cac provider AI.
- `/api/general-settings`: cau hinh he thong chung.

Middleware CORS trong `server/index.js` dang cho phep domain production `https://khca-s.static.good-dns.net` va cac dia chi localhost/ngrok thong dung. Neu mobile app tro den web/API moi, can cap nhat whitelist neu domain khong nam trong cac pattern hien co.

## Web Frontend

Thu muc: `frontend/`

Lenh chay:

```bash
cd frontend
npm install
npm run dev
```

Lenh build:

```bash
cd frontend
npm run build
```

File API client chinh: `frontend/src/api/index.jsx`.

Bien moi truong web:

- `VITE_URL_AUTH`
- `VITE_URL_DASHBOARD`
- `VITE_URL_SENSOR`
- `VITE_URL_GROUP`
- `VITE_URL_ALARM`
- `VITE_URL_PRV_TIME`
- Cac bien Firebase trong `frontend/.env` de phuc vu web push notification.

Route web chinh nam trong `frontend/src/App.jsx`:

- `/login`
- `/admin-dashboard`
- `/admin-dashboard/sensors`
- `/admin-dashboard/sensors/:group`
- `/admin-dashboard/add-sensors`
- `/admin-dashboard/setting`
- `/admin-dashboard/prv`
- `/admin-dashboard/compare`
- `/admin-dashboard/report`
- `/admin-dashboard/dnp-setting`
- `/admin-dashboard/dma`
- `/employee-dashboard`

## Mobile App

Thu muc: `mobile/`

Mobile app dung Expo React Native, React Navigation, chart native va goi truc tiep API server hien co. WebView khong con la man hinh chinh.

Lenh cai dat:

```bash
cd mobile
npm install
```

Lenh chay dev:

```bash
cd mobile
npm start
```

Chay Android:

```bash
cd mobile
npm run android
```

Chay iOS:

```bash
cd mobile
npm run ios
```

MacOS va Xcode la bat buoc neu build/chay iOS simulator cuc bo. Android can Android Studio/emulator hoac may that da bat USB debugging.

Build APK cai thu truc tiep:

```bash
cd mobile
npm run build:android:apk
```

Build file production cho store:

```bash
cd mobile
npm run build:android:store
npm run build:ios:store
```

`build:android:store` tao Android App Bundle `.aab` de upload Google Play Console. `build:ios:store` tao iOS archive/IPA de day App Store Connect/TestFlight. Theo Expo EAS, production Android mac dinh nen dung AAB cho Google Play; APK phu hop cai thu truc tiep hoac internal distribution.

Submit store:

```bash
cd mobile
npm run submit:android
npm run submit:ios
```

Truoc khi build/submit can:

- Expo account va EAS CLI qua `npx eas-cli@latest ...`.
- Chay `./build.sh login`.
- Chay `./build.sh init` lan dau de gan project voi EAS id `2f45d8a7-fc78-4ec0-835d-7ec94160ff6d`.
- Google Play Developer account de upload len Google Play Console.
- Apple Developer Program de build/submit iOS len App Store Connect.

Bien moi truong mobile:

```bash
EXPO_PUBLIC_API_BASE_URL=https://khca-s.static.good-dns.net/api/api
```

Sao chep `mobile/.env.example` thanh `mobile/.env` neu can tro app den API khac:

```bash
cd mobile
cp .env.example .env
```

`EXPO_PUBLIC_API_BASE_URL` phai la URL API base. Production hien tai dang dung dang `/api/api` theo cau hinh frontend.

## Mobile native screens

Mobile hien co cac man hinh native:

- Dang nhap va luu token.
- Trang chu: tong quan logger online/offline, nhom logger, canh bao hom nay.
- Trang chu: home messages xem/tao/xoa.
- Logger: nested stack nhom logger, logger trong nhom, gia tri moi nhat, chi tiet du lieu trong ngay, bieu do native.
- Bao cao: chon nhieu logger, metric, interval, khoang ngay va goi API report.
- So sanh: chon 2 logger + 2 ngay va hien bieu do so sanh.
- PRV: danh sach PRV va thong so gan nhat.
- PRV: bieu do native va bang lich dieu khien.
- DMA: danh sach DMA, tinh that thoat, tao/sua/xoa DMA co ban.
- Cai dat: doi nhom, quan ly nhom, DNP, general settings va dang xuat.

Khi them tinh nang web moi, can them API client trong `mobile/src/api.js` va them UI native tuong ung trong `mobile/App.js` hoac tach thanh component rieng.

Cau truc mobile:

```text
mobile/src/
  api.js
  context/AuthContext.js
  navigation/index.js
  theme/index.js
  components/
  screens/
```

## Lop AI (server/services/ai + server/services/agent)

Tat ca loi goi AI di qua `server/services/ai/client.js`, khong controller nao goi
thang provider nua.

Thanh phan:

- `services/ai/config.js`: doc cau hinh tu env, dung thu tu provider.
- `services/ai/client.js`: `chatComplete()` va `streamChatComplete()` kem timeout,
  retry co backoff + jitter, circuit breaker, semaphore gioi han dong thoi, cache Redis.
- `services/ai/circuitBreaker.js`: ngat provider sau N loi lien tiep, tu thu lai sau `AI_BREAKER_RESET_MS`.
- `services/ai/semaphore.js`: gioi han so request AI chay song song + hang doi.
- `services/ai/cache.js`: cache ket qua theo hash prompt (Redis), TTL `AI_CACHE_TTL_SECONDS`.
- `services/ai/json.js`: `chatCompleteJson()` ep model tra JSON, hong thi gui them 1 luot sua loi.
- `services/ai/sse.js`: `pipeAiStream()` day ket qua ve client dang SSE kem heartbeat.
- `services/agent/intent.js`: router quyet dinh (regex) + phan loai bang AI + fallback heuristic.
- `services/agent/session.js`: nho ngu canh hoi thoai theo `user + sessionId` (Redis, TTL 30 phut).
- `services/agent/tools.js`: cac ham doc du lieu cho agent (logger, tong quan, su co, canh bao, DMA).
- `services/dma/engine.js`: cong thuc tinh that thoat DMA, tach ra tu `dmaController` de
  trang DMA va tro ly AI dung chung. Truoc day logic nay private trong controller nen
  agent khong goi lai duoc.

Thu tu provider: `AI_PRIMARY_PROVIDER` roi den `AI_FALLBACK_PROVIDERS`. Hien tai la
`web2api` (gemini-web2api port 8081) roi `ollama` (llama3.1:8b port 11434). Neu dat
`GEMINI_API_KEY` thi provider `gemini` (API chinh thuc) cung dung duoc.

Quan trong: chi loi goi model that su moi tru quota AI. Cau lenh khop router quyet dinh
hoac tra tu cache deu khong tru luot.

### Endpoint AI

- `POST /api/sensor/report/ai-analysis` va `/api/sensor/report/ai-analysis/stream`
- `POST /api/dma/analyze` va `/api/dma/analyze/stream`
- `POST /api/chatbot/message` (nhan them `sessionId` de nho ngu canh)
- `GET /api/ai/health`, `GET /api/ai/probe` de kiem tra trang thai provider

Ban `/stream` tra ve SSE (`event: start | delta | done | error`). Frontend goi ban stream
truoc, loi thi tu dong lui ve ban thuong.

### Bien moi truong AI

```bash
AI_PRIMARY_PROVIDER=web2api
AI_FALLBACK_PROVIDERS=ollama
AI_MAX_CONCURRENCY=2
AI_QUEUE_LIMIT=12
AI_QUEUE_WAIT_MS=20000
AI_RETRY_ATTEMPTS=2
AI_CACHE_ENABLED=true
AI_CACHE_TTL_SECONDS=900
AI_BREAKER_FAILURE_THRESHOLD=5
AI_BREAKER_RESET_MS=60000
AI_SSE_HEARTBEAT_MS=15000
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=llama3.1:8b
AGENT_SESSION_TTL_SECONDS=1800
DISABLE_MQTT=1   # chi dung cho moi truong test, tranh ghi trung du lieu MQTT
```

### Luu y ve gemini-web2api

`gemini_web2api/gemini.py` da duoc va loi nuot ky tu khi stream: ham `clean_text()` co
`.strip()`, ban goc goi no tren tung delta nen dau cach va xuong dong o ranh gioi chunk
bi mat ("LUU" + "LUONG" thanh "LUULUONG"). Ban va clean tren van ban tich luy roi moi cat
delta. Neu cap nhat lai gemini-web2api tu upstream thi phai va lai cho nay.

## Toi uu frontend

- `src/App.jsx` lazy-load moi route, chi `Login` la eager.
- `vite.config.js` tach chunk `react / charts / maps / antd / mqtt`. Helper interop
  CommonJS phai ghim vao chunk `react`, neu khong Rollup nhet no vao chunk `antd` roi
  bat trang login tai ca antd.
- Da go cac package khong dung: `@mui/*`, `@emotion/*`, `recharts`, `styled-components`,
  `react-data-table-component`, `luxon`, `dayjs`.
- `frontend/deploy.sh` tu backup ban dang chay, build, chep va nen san `.gz` cho `gzip_static`.

Ket qua: trang login truoc day tai 1 file JS 1.5MB khong nen, gio con 4 request ~88KB.

## Nginx

- `/etc/nginx/nginx.conf`: da bat `gzip_types`, `gzip_vary`, `gzip_comp_level`. Truoc day
  `gzip on` nhung khong khai bao `gzip_types` nen chi moi text/html duoc nen.
- Site production: `http2`, cache `immutable` 1 nam cho `/assets/`, `no-cache` cho
  `index.html` va service worker.
- Endpoint AI co `proxy_buffering off` va `proxy_read_timeout 300s`. Truoc day nginx mac
  dinh 60s trong khi backend cho AI toi 120s, nen phan tich lau se bi 504.

## Moi truong test

- `serverTest/` chay port 3001 voi `DISABLE_MQTT=1`.
- `frontendTest/` build ra `/var/www/iotWaterTest`.
- `/etc/nginx/sites-available/iotwater-test` (port 8443). Bat bang:
  `ln -s /etc/nginx/sites-available/iotwater-test /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx`

## Backup truoc khi deploy

Nam o `/root/iotwater-backups/<timestamp>/`, gom ban `/var/www/iotWater`, ma nguon server,
`gemini.py`, config nginx va `.env`.

## Ban do: chon toa do va diem su co

### Chon toa do bang cach bam tren ban do

`frontend/src/components/map/MapPicker.jsx` la modal ban do dung chung. Trong
`components/setting/Setting.jsx`, o "Toa do logger" co them nut "Chon tren ban do".
Picker cho phep: bam thang len ban do, dan toa do hoac link Google Maps (dang `.../@lat,lng,17z`),
hoac lay vi tri hien tai cua thiet bi. Picker duoc `lazy()` nen leaflet khong bi keo vao
chunk cai dat khi chua dung toi.

### Diem su co tu do

Model `server/models/MapPoint.js`. Moi diem co: `title`, `type` (leak/burst/repair/valve/meter/other),
`severity` (low/medium/high), `status` (open/in_progress/resolved), `lat`/`lng`, `address`,
`note`, `group`, `occurredAt`, `resolvedAt`, `createdBy`/`createdByName`.

Ngoai `lat`/`lng`, model con luu `location` dang GeoJSON Point voi index `2dsphere`, de sau
nay chay `$geoNear` / `$geoWithin` khi phan vung su co.

Route `/api/map-points`:

- `GET /` - danh sach, loc theo `status`, `type`, `fromDate`, `toDate`, `limit`.
- `GET /hotspots` - gom nhom su co theo o luoi (`gridSize` do, mac dinh 0.002 ~ 200m),
  chi tra ve o co tu 2 su co tro len. Dung cho lop "Khu vuc tap trung su co".
- `POST /`, `PUT /:id`, `DELETE /:id` - tai khoan `trial` bi chan ghi o backend.

Frontend trong `frontend/src/components/map/`:

- `MapPointLayer.jsx` - ve marker su co + marker hotspot, popup chi tiet, bat click khi them diem.
- `MapPointControl.jsx` - bang dieu khien goc trai ban do: thong ke, bat/tat lop, bo loc, nut them diem.
- `MapPointForm.jsx` - form them/sua/xoa diem.
- `useMapPoints.js` - hook goi API va giu state.
- `mapPointMeta.js` - nhan tieng Viet, mau, icon cho tung loai/muc do/trang thai.
- `leafletIconFix.js` - vá icon mac dinh cua Leaflet bi mat khi build Vite. Bat buoc import
  o moi chunk co dung `<Marker>`, khong chi rieng `AdminSummary`.

Luu y khi them tinh nang ban do: lop GeoJSON duong ong co mot lop phu vo hinh rong 40px de
bat click. Khi bat che do them diem phai dat `interactive: false` cho lop do (va cho marker
logger), neu khong no se nuot cu click va khong dat duoc diem.

## Tro ly AI (trang Chatbot)

`frontend/src/pages/Chatbot.jsx` + `frontend/src/components/ai/chat/`.

Agent co 10 action, khai bao o `ALLOWED_ACTIONS` trong `services/agent/intent.js`:

| Action | Cau hoi mau | Nguon du lieu |
| --- | --- | --- |
| `system_overview` | "Tong quan he thong hom nay" | `Sensor` + `MapPoint` + `Alarm` |
| `list_incidents` | "Co su co nao chua xu ly khong?" | `MapPoint`, co `sensorId` thi dung `findIncidentsNearLoggers` ban kinh 1km |
| `list_alerts` | "Canh bao hom nay" | `AlarmFlow` |
| `dma_loss` | "That thoat DMA thang nay" | `services/dma/engine.js` |
| `compare_loggers` | "So sanh ap suat logger A va B tuan nay" | `buildLoggerReport` nhieu id (toi da 5) |
| `logger_report` / `open_logger` / `list_loggers` / `help` / `refuse` | nhu cu | |

Nhung diem de vap:

- Moi action moi deu co duong tat regex trong `routeDeterministic`, nen cau hoi pho bien
  **khong ton luot AI**. Chi cau la mieng moi rot xuong model.
- `compare_loggers` chi kich hoat khi bat duoc tu 2 id logger **co that** tro len. Hoi
  "so sanh 28429 va 28430" ma 28430 khong ton tai thi rot ve `open_logger` - dung y do.
- `dma_loss` khong co ngay thi mac dinh tu dau thang, `compare_loggers` mac dinh trong
  ngay. Cau tra loi noi ro la da lay mac dinh, thay vi hoi lai lam mat mot luot.
- `buildAlertPayload` dem bang `countDocuments` rieng. Neu chi lay `items.length` sau khi
  `.limit(50)` thi so canh bao luc nao cung bao dung bang 50.
- Bieu do nap bang `React.lazy` (`SeriesChart.jsx` thanh chunk rieng ~2KB). Neu import
  thang thi trang tro ly keo theo chunk `charts` 87KB gzip ngay ca khi khong ve gi.
- Nut CSV ghi them dong `sep=,` dau file kem BOM, vi Excel ban tieng Viet hay tach cot
  sai khi dau phan cach danh sach cua may la dau cham phay.

## Render bao cao AI

`frontend/src/components/ai/`:

- `AiMarkdown.jsx` - render markdown bang `react-markdown` + `remark-gfm` + `remark-breaks`,
  anh xa sang class Tailwind. Truoc day Report tu viet bo parse (chi hieu `**dam**`), con DMA
  hien markdown tho.
- `AiReportDocument.jsx` - tach markdown thanh tieu de, cac dong meta, phan mo dau va cac muc
  `## n.`, roi dung chung cho ca Report va DMA.

Hai diem de vap:

- `remark-breaks` la bat buoc: model xuong dong don trong mot muc danh sach, khong co no thi
  "Thoi gian / Gia tri / Nhan dinh" bi gop thanh mot dong.
- react-markdown v9 khong truyen prop `ordered` xuong `li`, nen dau dong (cham tron hay so
  thu tu) phai quyet dinh bang CSS counter trong `index.css` (`.ai-md-ol`, `.ai-md-li`,
  `.ai-md-marker`).

## Su co hien truong trong phan tich AI

`server/services/incidents.js` -> `findIncidentsNearLoggers()` tim cac diem su co quanh
logger dang duoc phan tich, mac dinh ban kinh 500m.

Cach lam: lay toa do logger tu `Info`, dung mot hop bao (`$geoWithin: $box`) de loc so bo
bang index `2dsphere`, roi tinh khoang cach haversine chinh xac trong JS va giu lai diem
trong ban kinh. Ket qua kem `distanceMeters`, `nearestLoggerName` va nhan thoi gian da
dinh dang theo gio Viet Nam.

Khoang thoi gian lay: trong ky phan tich, cong them cac su co xay ra truoc do toi 7 ngay
ma **chua xu ly xong** (vi chung van con anh huong toi so lieu trong ky). Moi su co co
truong `thoiDiem` ghi bang tieng Viet thay vi co true/false, de neu model co lo field ra
van ban thi nguoi van hanh van doc hieu.

Duoc dung o:

- `sensorController.analyzeSensorReport` / `analyzeSensorReportStream` - muc 6 cua bao cao
  co them "Doi chieu su co hien truong", muc 8 co them viec can lam voi su co chua xong.
- `dmaController.analyzeDma` / `analyzeDmaStream` - them muc "Su co hien truong da ghi nhan".
  Logger cua DMA lay bang `collectDmaLoggerIds()` (quet ca inlets, consumes, sensorTree
  nhieu tang va cac DMA con).

Loi khi tai su co khong duoc lam hong ca bao cao: bat loi, log ra roi tra ve mang rong.

Hai luat quan trong da them vao prompt:

- Cam bia ra su co ngoai danh sach duoc cung cap; danh sach trong thi phai ghi ro la khong co.
- Cam dung LaTeX/MathJax. Model tung tra ve `$253,21\text{ m}^3$/h` va react-markdown
  hien nguyen van ra man hinh.

## Doi domain web ma khong dung toi logger

Logger ngoai hien truong noi thang toi mosquitto qua **TCP 1883 o host cu**
(`khca-s.static.good-dns.net`). Cloudflare goi free/Pro/Business chi proxy duoc HTTP/HTTPS
qua port 80/443, khong proxy duoc TCP tho (can Spectrum - Enterprise). Vi vay **logger bat
buoc giu host cu**, va doi domain web khong lien quan gi toi chung.

Co 3 duong MQTT rieng biet, dung nham se rat kho debug:

| Ai | Toi dau | Khi doi domain web |
| --- | --- | --- |
| Logger hien truong | `khca-s...:1883` TCP | Giu nguyen, khong dung toi |
| Backend Node | `MQTT_HOST` (mac dinh host cu, dang dat `127.0.0.1`) | Khong lien quan |
| Trinh duyet | `VITE_MQTT_WS_URL` -> nginx `/mqtt` -> 9001 | Nen doi sang domain moi |

Cloudflare **co ho tro WebSocket** tren goi free, nen `wss://<domain-moi>/mqtt` chay duoc.
Neu de trinh duyet tro ve domain cu thi van chay, nhung domain cu phai song va cert
Let's Encrypt phai tu gia han, dong thoi IP goc van lo ra trinh duyet.

### Frontend khong con phu thuoc domain

`frontend/.env` dung **duong dan tuong doi** (`/api/api/auth`...) thay vi URL tuyet doi, va
`VITE_MQTT_WS_URL` de trong thi `AdminDashboard.jsx` tu bam theo `window.location`. Nho vay
**mot ban build chay duoc tren moi domain**, khong can build lai khi them domain, va cung
khong dinh CORS vi moi request deu same-origin.

Muon ep ve mot domain co dinh thi dat lai cac bien do thanh URL tuyet doi.

### Cloudflare Tunnel cho iotWater (da dung san, chua kich hoat)

| Duong dan | Vai tro |
| --- | --- |
| `/srv/iotwater/bin/cloudflared` | Binary rieng, khong dung chung voi e-meter |
| `/srv/iotwater/cloudflared/config.yml` | Ingress `iot.evmeter.vn` -> `http://127.0.0.1:8090` |
| `/srv/iotwater/setup-tunnel.sh` | Chay mot lan de tao tunnel + ban ghi DNS + bat service |
| `/etc/systemd/system/iotwater-tunnel.service` | Metrics o `127.0.0.1:20242` (e-meter dung 20241) |
| `/etc/nginx/sites-available/iotwater-cf` | Server block nghe `127.0.0.1:8090`, chi tunnel vao duoc |

Kich hoat:

```bash
CF_API_TOKEN=<token> /srv/iotwater/setup-tunnel.sh iot.evmeter.vn iotwater
```

Token can quyen `Account > Cloudflare Tunnel > Edit` va `Zone > DNS > Edit`.

Tunnel cua e-meter (`/srv/e-meter/shared/`, metrics 20241) hoan toan tach biet, khong bi dung toi.

### Bien moi truong lien quan den domain

Da bo het hardcode domain trong code. Doi domain chi can sua config:

`frontend/.env`

```bash
VITE_URL_AUTH / VITE_URL_DASHBOARD / VITE_URL_SENSOR / VITE_URL_GROUP / VITE_URL_ALARM / VITE_URL_PRV_TIME
VITE_MQTT_WS_URL="wss://khca-s.static.good-dns.net/mqtt"
```

`server/.env`

```bash
CORS_ORIGINS="https://domain-moi"   # them domain, ngan cach bang dau phay
PUBLIC_WEB_URL="https://khca-s.static.good-dns.net/"   # link trong thong bao Telegram/FCM
MQTT_HOST=127.0.0.1                 # broker chay cung may
MQTT_PORT=1883
```

Domain cu luon nam san trong whitelist CORS nen khong bao gio bi khoa ra ngoai.

### Vi sao khong dung duoc Cloudflare voi domain hien tai

`good-dns.net` dung nameserver `ns1.good-dns.net`, `mooo.com` dung `ns*.afraid.org` - deu la
zone cua nha cung cap DDNS, minh chi so huu mot ban ghi con. Cloudflare bat buoc uy quyen
nameserver ca zone. CNAME Setup (partial zone) chi co o goi Business/Enterprise.
Duong kha thi duy nhat la subdomain cua mot domain minh thuc su so huu (vi du `evmeter.vn`
da nam tren Cloudflare).

## Bao mat

### MQTT: tai khoan va ACL

Broker co 3 vai tro trong `/etc/mosquitto/acl`:

| Vai tro | Quyen |
| --- | --- |
| An danh (logger + van dieu ap) | `read` va `write` tren `iotwatter@2024`, `logger/#`, `lg/#`, `prv/send` |
| `iotbackend` | `readwrite #` |
| `iotweb` (trinh duyet) | CHI DOC: `iotwatter@2024`, `khca/warning`, `logger/pressure`, `prv/send` |

Mat khau o `/etc/mosquitto/passwd`, dat trong `server/.env` (`MQTT_USERNAME`/`MQTT_PASSWORD`)
va `frontend/.env` (`VITE_MQTT_USERNAME`/`VITE_MQTT_PASSWORD`).

### Danh sach topic MQTT day du

Ra soat toan bo ma nguon (19/09/2026). Sua ACL phai doi chieu bang nay:

| Topic | Ai gui | Ai nhan |
| --- | --- | --- |
| `iotwatter@2024` | logger | backend, trinh duyet |
| `logger/pressure` | diem cuoi PRV | backend, trinh duyet |
| `logger/config` | logger | backend |
| `logger/get_config` | backend | logger |
| `logger/<id>` | backend | logger do |
| `logger/rec`, `logger/ID`, `lg/rec` | logger | (khong ai doc) |
| `prv/send` | **van dieu ap** (trang thai) va backend (lenh) | backend, trinh duyet |
| **`prv/get`** | **backend (LENH)** | **van dieu ap** |
| `watter/setInterval` | backend | logger |
| `khca/warning` | backend | trinh duyet |

**`prv/get` la kenh LENH thuc su**, khong phai `prv/send` nhu ten goi goi y.
Thieu `topic read prv/get` cho an danh thi **khong gui duoc lenh xuong van** - loi nay
khong lo ra khi nghe traffic vi lenh chi phat khi nguoi dung bam nut.

**Thiet bi hien truong van can quyen DOC, dung cat.** Da thu siet hai lan va ca hai lan
deu lam hong van hanh:

1. Cat `write prv/send` cua an danh -> van dieu ap ngung gui realtime **13 phut**
   (18/09/2026, 15:46-15:59). `prv/send` la topic HAI CHIEU bat chap ten goi: van PUBLISH
   trang thai len (`{"n":838426678,"p1":30.6,"p2":35.4,"i":11.6,"b":74,"f":125.6}`) va
   backend cung publish lenh xuong cung topic do.
2. Cat `read` cua an danh -> van dieu ap khong doc duoc ap luc diem cuoi de chay vong
   dieu khien. Da mo lai theo yeu cau van hanh.

Ket qua: **an danh hien co toan quyen tren cac topic van hanh**. Muon siet that su thi
phai doi firmware thiet bi truoc (tach `prv/status` cho thiet bi gui len, `prv/send` chi
de backend gui xuong; va cap tai khoan rieng cho tung thiet bi).

Neu van muon sua ACL: **bat buoc thu tren broker rieng truoc** (`mosquitto -c` o port 1884),
va nap lai bang `kill -HUP $(pgrep -x mosquitto)` thay vi `systemctl restart` de khong ngat
ket noi thiet bi.

Ba diem ky thuat da vap:

- **mosquitto 1.6.9 KHONG ho tro `topic deny`** (chi co tu ban 2.0), phai viet danh sach
  cho phep thuan.
- Ngoai topic trong ma nguon con co `logger/rec`, `logger/ID`, `lg/rec` chay thuc te.
  Dung wildcard `logger/#` va `lg/#` de khong bo sot.
- Diem cuoi PRV gui len voi `n` = 1, 2, 3 nhung backend luu vao DB thanh index
  **101, 102, 103** (`index: sen_name + 100` trong `mqtt.js`). Tim `n:101` tren MQTT se
  khong bao gio thay.

### Port

| Port | Trang thai | Ghi chu |
| --- | --- | --- |
| 22, 80, 443 | Mo ra internet | Can thiet |
| 1883 | Mo ra internet | **Bat buoc** - 26 logger ket noi truc tiep |
| 3000 | Chi localhost | `LISTEN_HOST=127.0.0.1` trong `server/.env` |
| 9001 | Chi localhost | Xem ghi chu ben duoi |
| 27017, 6379, 11434, 8081, 8090 | Chi localhost | Dung san tu truoc |

**mosquitto 1.6 bo qua dia chi bind cho listener websockets** (han che cua libwebsockets):
dat `listener 9001 127.0.0.1` nhung no van mo `*:9001`. Phai chan bang iptables:

```bash
iptables -I INPUT 1 -i lo -j ACCEPT
iptables -I INPUT 2 -p tcp --dport 9001 -j DROP
```

Luu qua reboot bang `iptables-persistent` (`/etc/iptables/rules.v4`).

### Dich vu da tat

`avahi-daemon`, `ModemManager`, `wpa_supplicant`, `switcheroo-control`, `udisks2`,
`accounts-daemon` - deu la dich vu cho may ban, vo dung tren may ao KVM chi co `eth0`.

### Canh bao ve fail2ban

Da thu cai fail2ban roi **phai go**: dat kem `MaxAuthTries 3` khien SSH client (thu khoa
truoc, mat khau sau) het luot xac thuc chi sau vai lan ket noi, fail2ban cam luon IP dang
quan tri. Neu cai lai thi phai:

- Giu `MaxAuthTries` >= 6, hoac ep client dung `PreferredAuthentications=password`
- Them IP quan tri vao `ignoreip` trong `/etc/fail2ban/jail.local`

Cach dung hon la chuyen SSH sang dung khoa roi tat `PasswordAuthentication`, luc do bot do
mat khau thanh vo hai va khong can fail2ban.

### Con lai chua lam

- **MQTT van mo cho an danh doc/ghi** cac topic van hanh - thiet bi hien truong can nhu vay.
  Chi bit duoc sau khi doi firmware sang topic rieng + tai khoan rieng cho tung thiet bi.
- SSH van cho `root` dang nhap bang mat khau. Log co hon 65.000 luot do mat khau that bai
  (chua ai vao duoc - moi lan dang nhap thanh cong deu tu IP nha mang VN cua chu may).

## Xac dinh logger online/offline

Quy tac: logger con song neu ban tin cuoi nam trong **`interval` x 2**, san toi thieu
**15 phut**.

`interval` la chu ky logger DAY du lieu len (giay). **Khong duoc dung `watch`** - do la
chu ky LAY MAU (mac dinh 60s) va khong thay doi khi nguoi dung sua interval.

Ba noi tinh, phai giu cung mot cong thuc:

| Noi | Ham |
| --- | --- |
| Ban do tong quan | `isSensorConnected()` trong `components/dashboard/AdminSummary.jsx` |
| Agent AI | `isConnected()` trong `server/services/agent/tools.js` |
| API danh sach sensor | `getSensors()` trong `server/controllers/sensorController.js` (~dong 2882) |

Loi da gap (18/09/2026): ban do dung `watch * 3` nen nguong luon la 15 phut. Logger 28757
dat `interval = 1800` (30 phut) van gui du lieu binh thuong nhung **luon bao do**. Cac
logger `interval = 60` khong bi anh huong nen loi nay an rat lau.

Diem cuoi PRV gui len voi `n` = 1, 2, 3 nhung backend luu thanh index **101, 102, 103**
(`index: sen_name + 100`). Tim `n:101` tren MQTT se khong bao gio thay.

## Luong dang nhap

`authContext.login()` **phai tai luon `info`** (danh sach logger), khong chi set `user`.
`verifyUser()` chi chay mot lan luc mount nen neu login() khong tai info thi sau khi dang
nhap bang form, `info` van la `null`:

- Ban do trong, 0 marker
- `POST /api/sensor` tra ve **500 "Sensor not found"** vi `totalMap` rong
- Phai F5 thi moi hien

Trong `Login.jsx`, `localStorage.setItem("token", ...)` phai chay **truoc** `await login(...)`
vi login() dung token do de goi `infoGet`.

## Diem su co ro ri

### Truong du lieu (`server/models/MapPoint.js`)

| Truong | Y nghia |
| --- | --- |
| `title` | Ten su co |
| `typeId` + `typeName` | Loai su co, tham chieu `IncidentType`. Giu ca ten de xuat Excel/bao cao khong phai join |
| `leakRate` | Bac luu luong ro ri, vi du `"150-200"` hoac `">1000"` |
| `status` | `open` (kem `unresolvedReason`) hoac `resolved` (kem `resolvedAt`) |
| `lat`/`lng` + `location` | Toa do, kem GeoJSON Point co index 2dsphere |
| `group` | Khu vuc, dung chung danh sach voi nhom logger |
| `note` | Ghi chu da gop ca dia chi |
| `images` | Mang ten file trong `server/upload/incidents/` |
| `occurredAt` | Thoi diem phat hien |

### Bac muc do

`server/services/leakRate.js` va `frontend/src/components/map/leakRate.js` phai khop nhau:
buoc 50 l/h tu 0 den 1000 (20 bac) cong bac `>1000`, tong 21 bac.

Uoc tinh luu luong = trung binh bac. Rieng `>1000` lay dung 1000 cho an toan, khong
thoi phong con so. Bao cao ghi ro day la so uoc tinh, khong phai so do thuc te.

### Loai su co tu them

`IncidentType` co unique index `(user, name)`. Lan dau goi API se tu tao bo mac dinh:
Vo ong, Ro ri moi noi, Ro ri van, Ro ri dong ho, Nut gay cut ren, Khac.

Nguoi dung them loai moi ngay trong form (nut `+` ben canh o chon). Doi ten loai se
dong bo luon `typeName` cua moi diem dang dung loai do. Khong xoa duoc loai dang co diem su dung.

### API

| Endpoint | Cong dung |
| --- | --- |
| `GET /api/map-points` | Danh sach, loc theo `status`, `typeId`, `group` (nhieu nhom cach nhau dau phay), `fromDate`, `toDate` |
| `GET /api/map-points/report` | Bao cao: tong so diem, luu luong uoc tinh, luu luong da triet tieu, chia theo tung loai |
| `POST /api/map-points/export` | Xuat Excel 7 cot: ten, thoi gian phat hien, trang thai, loai, muc do, khu vuc, toa do |
| `POST /api/map-points/:id/images` | Upload anh (multer, toi da 10 anh 8MB moi anh) |
| `GET /api/map-points/image/:name` | Doc anh |
| `GET /api/incident-types` | Danh sach loai, tu tao bo mac dinh neu chua co |

Bao cao **liet ke ca loai khong co su co nao** trong ky va ghi "Khong co su co" - day la
yeu cau van hanh, dung loc bo cho gon.

### Giao dien

- `MapPointForm.jsx`: form them/sua, co nut mo `MapPicker` (dan link Google Maps hoac lay
  vi tri hien tai cua dien thoai). Sau khi tao moi, form **khong dong ma chuyen sang che do
  sua** de nguoi dung dinh anh ngay.
- `IncidentReportPanel.jsx`: 2 tab Tra cuu (kem xuat Excel) va Bao cao, loc theo khoang ngay
  + nhieu khu vuc cung luc.
- Mau cham tren ban do theo **muc do ro ri**, diem da xu ly lam mo di va doi thanh dau tich.

## Quy uoc lam tiep

- Khong sua API route neu chua kiem tra frontend va mobile co phu thuoc hay khong.
- Neu them endpoint server, cap nhat `frontend/src/api/index.jsx` va tai lieu nay.
- Neu them route web moi, cap nhat danh sach route trong tai lieu nay.
- Neu thay domain production, cap nhat:
  - `frontend/.env`
  - `mobile/.env`
  - CORS whitelist trong `server/index.js` neu can
- Truoc khi build release mobile, nen thay bo icon/splash trong `mobile/assets/` bang PNG kich thuoc chuan cua Expo.

## Checklist kiem thu nhanh

1. Backend chay va ket noi database/MQTT/Redis thanh cong.
2. Web login duoc voi API production.
3. Mobile app goi dung `EXPO_PUBLIC_API_BASE_URL`.
4. Dang nhap trong mobile thanh cong.
5. Cac man hinh dashboard, sensor, PRV, DMA, report, settings mo duoc trong mobile.
6. Upload anh logger duoc kiem tra rieng tren Android/iOS that neu can dung camera/thu vien anh.
