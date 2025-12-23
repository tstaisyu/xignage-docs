# ページ / ルーティング

- ルータは `BrowserRouter basename="/admin"`（`signage-admin-ui/src/main.tsx`）
- 画面は `Layout` 配下で共通 UI（ヘッダー/ユーザー情報/下部ナビ）を共有

## ルート一覧

| ルート | 画面 | 概要 |
| --- | --- | --- |
| `/admin/` | Dashboard | 主要画面へのショートカット |
| `/admin/upload` | Upload | メディアアップロード（簡易） |
| `/admin/media` | MediaList | メディア一覧・編集・削除 |
| `/admin/playlists` | PlaylistsList | プレイリスト一覧・割当 |
| `/admin/playlists/new` | PlaylistCreate | プレイリスト作成 |
| `/admin/playlists/:playlistId` | PlaylistDetail | プレイリスト詳細・並び替え |
| `/admin/playlists/:playlistId/add` | PlaylistAddItem | プレイリストへメディア追加 |
| `/admin/login` | AdminLogin | 管理者用ログイン |
| `/admin/system/customers` | SystemCustomers | 管理者用: 顧客管理 |
| `/admin/system/devices` | SystemDevices | 管理者用: デバイス管理 |
| `/admin/system/device-users` | SystemDeviceUsers | 管理者用: デバイス-ユーザー紐付け |

## Layout（`signage-admin-ui/src/page/Layout.tsx`）

- `UserContext` を参照し、**ユーザー/デバイス情報を解決**
- `embedded=1` クエリで **下部ナビを非表示**
- `UserContextBar` でユーザー/顧客/デバイス選択と同期状態を表示
- 同期ボタンは `POST /api/commands/sync-content` を発行し、
  `GET /api/devices/:deviceId/sync-status` を **最大 3 分**ポーリング

### SetupScreen

- `userExternalId` 未指定時に表示
- `userExternalId` と `deviceId` を入力し、`/media` に遷移

## Dashboard（`signage-admin-ui/src/page/Dashboard.tsx`）

- 現行は **ショートカットのみ**（メディア/プレイリスト）

## Upload（`signage-admin-ui/src/page/Upload.tsx`）

- `UploadDropzone` + `useUpload` によるアップロード
- 進捗と件数を表示（簡易ページ）

## MediaList（`signage-admin-ui/src/page/MediaList.tsx`）

- メディア一覧の取得・削除・タイトル編集
- メディアタイプのフィルタ（画像/動画/その他）
- ページサイズ/ソート切替
- `useUpload` でアップロード → 追加したメディアを先頭に反映

## PlaylistsList（`signage-admin-ui/src/page/PlaylistsList.tsx`）

- プレイリストの一覧・作成・編集・削除
- **デバイス割当**: `POST /api/devices/:deviceId/sync-complete`
- **割当確認**: `GET /api/devices/:deviceId/playlist-assignment`
- **同期状態の更新**: `GET /api/devices/:deviceId/sync-status`

## PlaylistDetail（`signage-admin-ui/src/page/PlaylistDetail.tsx`）

- プレイリストアイテムの取得/並び替え（`PUT /items`）
- 画像アイテムのみ再生時間の上書き可能
- アイテム削除（`DELETE /items/:playlistItemId`）

## PlaylistAddItem（`signage-admin-ui/src/page/PlaylistDetail.tsx`）

- メディア一覧から選択してアイテム追加
- 画像の場合、未入力時は `durationSec=10` を指定

## 管理者画面（System / Login）

- `AdminLogin` は **ローカルのパスワード認証のみ**（`VITE_ADMIN_MASTER_PASSWORD`）
- System 系 API は **バックエンドで master ユーザー判定**が必要
  - `MASTER_USER_EXTERNAL_IDS` に含まれる `userExternalId` のみ許可
  - 参照: `signage-aws-nodejs/middlewares/humanAuth.js`, `signage-aws-nodejs/routes/admin/adminRoutes.js`
