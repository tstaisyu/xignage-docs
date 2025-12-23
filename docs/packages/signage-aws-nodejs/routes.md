# ルーティング (routes)

`routes/*` は **HTTP API の集合**で、Express ルータを機能別に分割し `/api` 配下へマウントします。  
別途 `/call/*` で通話 UI を提供します。

## マウント構成（全体像）

- `routes/index.js`  
  `/api` → `apiRoutes(io)`（device / player / admin を合流）  
  `/call` → `callRoutes`（通話 UI）

- `routes/apiRoutes.js`（/api 配下）
  - `routes/device/*`（端末向け）  
  - `routes/player/*`（プレイヤ向け）  
  - `routes/admin/*`（人間向け、`userExternalId` 必須）

## 認証・認可の前提

- `requireHumanUser` により **`userExternalId` 必須**  
  （主に `/api/*` の human/admin 系）
- `requireCustomerIdForAdminUi` により **`customerId` 必須**
- `requireMasterUser` は `MASTER_USER_EXTERNAL_IDS` による管理者限定
- `requireInternalToken` は `x-internal-token` ヘッダ必須（内部 API 用）

## 1) Device 向け（/api）

> ### IP/MAC/Device Info 登録

- `POST /api/ip/register`  
  Body: `{ deviceId, localIp, iface?, byInterface? }`
- `POST /api/mac/register`  
  Body: `{ deviceId, macAddress, iface?, byInterface? }`
- `POST /api/device-info/register`  
  Body: `{ deviceId, info }`

> ### 同期完了通知

- `POST /api/devices/:deviceId/sync-complete`  
  Body: `{ customerId?, playlistId?, syncedAt? }`  
  `syncedAt` が指定された場合は日時として検証し、`device_playlists` の `last_sync_at` を更新。

## 2) Player 向け（/api）

> ### プレイリスト取得

- `GET /api/devices/:deviceId/playlist`  
  Query: `customerId?`, `playlistId?`  
  端末の割当プレイリストを解決し、再生用の配列を返す。

> ### メディアマニフェスト

- `GET /api/devices/:deviceId/media-manifest`  
  Query: `customerId?`, `playlistId?`  
  S3 の presigned download URL を含むメディア一覧を返す。

> ### TODO

- `/api/playlist/thumbnail`  
  **TODO:** プレイリストレスポンスがこの URL を返すが、該当ルート定義が見当たらない。  
  根拠: `signage-aws-nodejs/routes/player/devicePlaylistRoutes.js:157`（`thumbnailUrl` 生成）。

## 3) Admin/Human 向け（/api）

### Commands（/api/commands/*）

- `GET /api/commands/send`  
  Query: `deviceId`, `command`, `fileName?`, `isSingle?`  
  `command` は `playVideo|showImage|switchView` に限定
- `POST /api/commands/send`  
  Body: `{ deviceId, command, payload }`  
  `command` は `setVolume|toggleVolume` のみ
- `POST /api/commands/start` / `stop` / `rotate` / `update`
- `POST /api/commands/network/reset`
- `POST /api/commands/sync-content`（admin-ui 向け）
- `POST /api/commands/network/report`  
  Socket 側へ `net:report` を emit し、ACK を 8 秒待機

### Device Settings（/api/deviceSettings）

- `GET /api/deviceSettings?deviceId=...`  
- `GET /api/deviceSettings/:deviceId`  
- `PATCH /api/deviceSettings/:deviceId`（`autoPlaylist` 必須）  
  Socket で `getConfig` / `updateConfig` を送信し ACK を待機

### Device Info / Status

- `GET /api/device-info?deviceId=...`  
  登録済み info を `{ key, value }` 配列で返却
- `POST /api/device-info/update`  
  `requestDeviceInfo` を Socket へ送信して取得
- `GET /api/status?deviceId=...`  
  接続状態（`接続中` / `未接続`）

### IP / MAC 参照

- `GET /api/ip?deviceId=...&iface?&full?`  
- `GET /api/mac?deviceId=...&iface?&full?`  
  `full=1` の場合は既知インタフェースを埋めたスナップショットを返す

### Power

- `POST /api/device/power/shutdown`  
- `POST /api/device/power/reboot`

### Versions / Patch

- `GET /api/version/versions?deviceId=...`
- `GET /api/patchMigState?deviceId=...`

### OpenAI

- `POST /api/openai/ask`  
  `OPENAI_API_KEY` 必須。返答は `io.emit('updateText', { text })` で配信。

### Doorbell

- `POST /api/doorbell/start-call`  
  Daily の Room を作成し、`doorbell:startCall` をデバイスへ送信
- `POST /api/doorbell/end-call`  
  `switchView('kiosk.html')` をデバイスへ送信  
  `DOORBELL_MAX_CALL_DURATION_SEC` で自動終了タイマーを制御

### Content（/api/content/*）

#### Media

- `GET /api/content/media`
- `POST /api/content/media/upload-url`
- `POST /api/content/media/complete-upload`
- `PATCH /api/content/media/:mediaId`
- `DELETE /api/content/media/:mediaId`
- `POST /api/content/media/thumbnail`（内部トークン必須）

#### Playlists

- `GET /api/content/playlists`
- `POST /api/content/playlists`
- `PATCH /api/content/playlists/:id`
- `DELETE /api/content/playlists/:id`
- `GET /api/content/playlists/:id/items`
- `PUT /api/content/playlists/:id/items`
- `POST /api/content/playlists/:playlistId/items`
- `DELETE /api/content/playlists/:playlistId/items/:playlistItemId`

#### Device Playlist Mapping

- `PUT /api/content/device-playlists/:deviceId`
- `GET /api/content/device-playlists`

### Device Playlist 状態（/api/devices/*）

- `GET /api/devices/:deviceId/playlist-assignment`
- `GET /api/devices/:deviceId/sync-status`

### Admin 管理（/api/admin/*）

`requireMasterUser` を必須とし、DB を直接操作します。

- `GET/POST/PATCH/DELETE /api/admin/devices`
- `GET/POST/DELETE /api/admin/device-users`
- `GET/POST/PATCH/DELETE /api/admin/customers`

### User（/api/user/*）

- `GET /api/user/devices`  
  `devices` / `customers` / `selectedDeviceId` / `selectedCustomerId` を返却

## 4) Call UI（/call/*）

- `GET /call/join/mobile/:callId`  
  Daily 通話用の HTML UI を返す（モバイル参加用）
- `GET /call/join/device/:callId`  
  Daily 通話用の HTML UI を返す（デバイス参加用）

## 共通前提

- **接続管理**：`deviceSockets: Map<deviceId, socketId>`（`requestStores.js`）  
- **Socket サーバ**：`getIO()`（`socket/index.js`）  
- **エラー方針**：`400` 入力不足 / `403` 権限不足 / `404` 未接続 / `500` 内部異常  
  タイムアウトは原則 `504` 相当（実装差あり）
