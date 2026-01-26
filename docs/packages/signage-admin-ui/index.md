# signage-admin-ui（Overview）

- What: クラウド正本型のサイネージ管理 UI（React + Vite + TypeScript）
- Where: `/admin` をベースパスとする SPA（`BrowserRouter basename="/admin"`）
- Why: クラウド側のメディア/プレイリストを正本として管理し、デバイスへ同期する

## 目的と前提

- クラウド正本: メディア/プレイリストはクラウドの API で管理し、デバイスへ同期する。
- 利用経路: Adalo の WebView からの埋め込み利用、またはブラウザからの直接アクセス。
- 必要パラメータ: `userExternalId` を中心に API 側の権限判定に使用する。

## ユーザー解決と権限

- URL クエリでユーザー情報を受け取る（`UserContext`）。
  - `userExternalId` / `user_email`
  - `userName` / `username`
  - `customerId`
  - `deviceId` / `device_id`
  - `embedded=1`（埋め込み UI）
- `userExternalId` が無い場合は `SetupScreen` が表示され、`/media` へ遷移する。
- `GET /api/user/devices` の結果で `selectedDeviceId` / `selectedCustomerId` / `customers` / `isMasterAdmin` を解決する。
- 管理者系ページは **2 段階**のチェックを通過する。
  - UI 側のログイン（`VITE_ADMIN_MASTER_PASSWORD` + `localStorage`）
  - `isMasterAdmin === true` の場合のみ `/system/*` を表示

## 主要な機能の流れ（UI 側）

1) ユーザー/デバイス解決: `GET /api/user/devices` でデバイス/顧客情報を取得。
2) ライブラリ管理: `GET/DELETE/PATCH /api/content/media` 系 API で一覧/削除/タイトル更新。
3) プレイリスト管理: `GET/POST/PATCH/DELETE /api/content/playlists` と `/items` 系 API。
4) 割当と同期: `POST /api/devices/:deviceId/sync-complete` で割当し、`POST /api/commands/sync-content` で同期。

## 技術スタック（現行）

- React / TypeScript / Vite
- React Router / SWR
- Tailwind CSS
- react-dropzone（D&D アップロード）
- react-hot-toast（通知）
- lucide-react（アイコン）

## 構成（主要ファイル）

```text
src/
├── main.tsx              # ルーティング定義（/admin）
├── page/                 # 画面（Dashboard/Media/Playlists/System など）
├── context/              # UserContext / AdminAuthContext
├── hook/                 # useUpload / useJwt / useLanDetect
├── components/           # UserContextBar / UploadDropzone / RequireAdmin
└── api/types.ts          # OpenAPI 型（自動生成）
```

## 移行メモ（旧用途の整理）

- `openapi/spec.yaml` はローカル/LAN 向けの旧 API 定義が残存している。現行 UI では参照していない。
  - 参照: `signage-admin-ui/openapi/spec.yaml`
- `useLanDetect` / `useJwt` は現行 UI から未使用。将来整理対象。
  - 参照: `signage-admin-ui/src/hook/useLanDetect.ts`, `signage-admin-ui/src/hook/useJwt.ts`

## ドキュメント一覧

- [Setup](setup.md) — 開発/ビルド/配信手順、環境変数
- [Pages & Routing](pages.md) — 画面・ルート・画面間フロー
- [API Contract](api.md) — UI が呼ぶ API と必須パラメータ
- [Components](components.md) — 主要コンポーネントの役割
- [Hooks](hooks.md) — 主要フックの役割
- [CI / GitHub Actions](../../ci/workflows/signage-admin-ui/ci.md)
