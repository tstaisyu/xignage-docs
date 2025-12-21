# API contract（signage-admin-ui 視点）

## ベース URL

- **既定**：`VITE_SIGNAGE_API_BASE_URL` が空の場合は同一オリジン（相対 `/api/*`）
- **例**：`VITE_SIGNAGE_API_BASE_URL=https://api.example.com`
- `MediaList` のみ未設定時に `https://api.xrobotics.jp` をデフォルトとしている
  - 参照: `signage-admin-ui/src/page/MediaList.tsx`

!!! warning "`/api/user/devices` はベース URL を使用しない"
    `UserContext` は `/api/user/devices` を **相対パスで呼ぶ**ため、
    API を別ドメインに置く場合は同一オリジン化またはプロキシが必要。  
    TODO: 意図した配置形態を確認（参照: `signage-admin-ui/src/context/UserContext.tsx`）

## 必須パラメータの方針

- **`userExternalId` と `customerId` は原則必須**（クエリ or ボディ）
- 不足時は UI がエラー表示・API も `400` で返却
- アクセス制御は `userExternalId` を軸にバックエンドで検証
  - 参照: `signage-aws-nodejs/middlewares/humanAuth.js`

## API 一覧（UI からの主要呼び出し）

### ユーザー/デバイス

- `GET /api/user/devices?userExternalId=...&deviceId=...`
  - UI 起動時にデバイス/顧客の選択情報を取得
  - 参照: `signage-admin-ui/src/context/UserContext.tsx`

### メディア（ライブラリ）

- `GET /api/content/media?customerId=...&userExternalId=...&limit=...&offset=...`
- `DELETE /api/content/media/:mediaId?customerId=...&userExternalId=...`
  - 409 の場合は「プレイリストで使用中」扱い
- `PATCH /api/content/media/:mediaId`
  - Body: `{ customerId, userExternalId, title }`
- `POST /api/content/media/upload-url`
  - Body: `{ customerId, userExternalId, fileName, mimeType, mediaType, sizeBytes, durationSec }`
  - 署名付きアップロード URL を取得
- `POST /api/content/media/complete-upload`
  - Body: `{ mediaId, sizeBytes, customerId, userExternalId }`

### プレイリスト

- `GET /api/content/playlists?customerId=...&userExternalId=...&limit=...&offset=...`
- `POST /api/content/playlists`
  - Body: `{ customerId, userExternalId, name, description? }`
- `PATCH /api/content/playlists/:id`
  - Body: `{ customerId, userExternalId, name?, description?, isActive? }`
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
  - Body: `{ customerId, userExternalId, playlistId }` を UI が送信
  - **プレイリスト割当の保存**に利用（UI 内で使用）
- `POST /api/commands/sync-content`
  - Body: `{ deviceId, customerId, userExternalId }`
  - UI から同期コマンドを発行（ポーリングで完了確認）

### 管理者（System）

- `GET/POST/PATCH/DELETE /api/admin/customers`
- `GET/POST/PATCH/DELETE /api/admin/devices`
- `GET/POST/DELETE /api/admin/device-users`
- これらは **master ユーザー専用**（`MASTER_USER_EXTERNAL_IDS`）
  - 参照: `signage-aws-nodejs/routes/admin/adminRoutes.js`

## エラーハンドリング方針（UI 側）

- `res.ok` 以外は **トースト/アラートで通知**
- `409` は **競合（使用中/重複）**として専用メッセージ
- 同期処理は最大 3 分までポーリングして状態を表示
