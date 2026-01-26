# API contract（signage-admin-ui 視点）

## ベース URL

- 既定: `VITE_SIGNAGE_API_BASE_URL` が空の場合は同一オリジン（相対 `/api/*`）
- 例: `VITE_SIGNAGE_API_BASE_URL=https://api.example.com`
- `MediaList` のみ未設定時に `https://api.xrobotics.jp` をデフォルトとしている
  - 参照: `signage-admin-ui/src/page/MediaList.tsx`

!!! warning "`/api/user/devices` はベース URL を使用しない"
    `UserContext` は `/api/user/devices` を相対パスで呼ぶため、
    API を別ドメインに置く場合は同一オリジン化またはプロキシが必要。\
    TODO: 配置形態を確認（参照: `signage-admin-ui/src/context/UserContext.tsx`）

## 必須パラメータの方針

- `userExternalId` は原則必須（クエリ or ボディ）
- `customerId` は多くの API で必須
- 不足時は UI がエラー表示する

## API 一覧（UI からの主要呼び出し）

### ユーザー/デバイス

- `GET /api/user/devices?userExternalId=...&deviceId=...`
  - 起動時にデバイス/顧客の選択情報を取得
  - レスポンス例（UI が参照する主な項目）
    - `selectedDeviceId` / `selectedCustomerId`
    - `devices: [{ deviceId, label?, customerId? }]`
    - `customers: [{ customerId, name }]`
    - `isMasterAdmin`
  - 参照: `signage-admin-ui/src/context/UserContext.tsx`

### メディア（ライブラリ）

- `GET /api/content/media?customerId=...&userExternalId=...&limit=...&offset=...`
- `DELETE /api/content/media/:mediaId?customerId=...&userExternalId=...`
  - `409` の場合は「プレイリストで使用中」扱い
- `PATCH /api/content/media/:mediaId`
  - Body: `{ customerId, userExternalId, title }`
- `POST /api/content/media/upload-url`
  - Body: `{ customerId, userExternalId, fileName, mimeType, mediaType, title, sizeBytes, durationSec?, createdByUserId }`
- `POST /api/content/media/complete-upload`
  - Body: `{ mediaId, sizeBytes, customerId, userExternalId }`

### プレイリスト

- `GET /api/content/playlists?customerId=...&userExternalId=...&limit=...&offset=...`
- `POST /api/content/playlists`
  - Body: `{ customerId, userExternalId, name, description?, isActive, userName? }`
- `PATCH /api/content/playlists/:id`
  - Body: `{ customerId, userExternalId, name, description }`
- `DELETE /api/content/playlists/:id?customerId=...&userExternalId=...`
- `GET /api/content/playlists/:id/items?customerId=...&userExternalId=...`
- `PUT /api/content/playlists/:id/items`
  - Body: `{ customerId, userExternalId, items: [{ mediaId, sortOrder, durationSec? }] }`
- `POST /api/content/playlists/:id/items`
  - Body: `{ customerId, userExternalId, mediaId, durationSec? }`
- `DELETE /api/content/playlists/:playlistId/items/:playlistItemId?customerId=...&userExternalId=...`

### デバイス割当と同期

- `GET /api/devices/:deviceId/playlist-assignment?customerId=...&userExternalId=...`
- `GET /api/devices/:deviceId/sync-status?customerId=...&userExternalId=...`
- `POST /api/devices/:deviceId/sync-complete`
  - Body: `{ customerId, userExternalId, playlistId }`
- `POST /api/commands/sync-content`
  - Body: `{ deviceId, customerId, userExternalId }`

### 管理者（System）

- `GET/POST/PATCH/DELETE /api/admin/customers`
- `GET/POST/PATCH/DELETE /api/admin/devices`
- `GET/POST/DELETE /api/admin/device-users`
- `GET /api/admin/ledger/devices?userExternalId=...&limit=...`
- `GET /api/admin/ledger/devices/:deviceId?userExternalId=...`
- `POST /api/admin/iot/publish/:deviceId?userExternalId=...`
- `GET /api/admin/mtls/last-seen/:deviceId?userExternalId=...`
- `GET /api/admin/iot/drift/:deviceId?userExternalId=...`
- `POST /api/admin/iot/cleanup/:deviceId?userExternalId=...`

## エラーハンドリング方針（UI 側）

- `res.ok` 以外はトースト/アラートで通知
- `409` は競合（使用中/重複）として専用メッセージ
- 同期処理は最大 3 分までポーリングして状態を表示
