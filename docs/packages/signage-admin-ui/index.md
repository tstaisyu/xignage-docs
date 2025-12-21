# signage-admin-ui（Overview）

**What**：クラウド正本型のサイネージ管理 UI（React + Vite + TypeScript）  
**Where**：`/admin` をベースパスとする SPA（`BrowserRouter basename="/admin"`）  
**Why**：クラウド側のメディア/プレイリストを正本として管理し、デバイスへ同期させるため

## 目的と前提

- **クラウド正本**：メディア/プレイリストはクラウドの API で管理し、デバイスへ同期する。
- **利用経路**：Adalo の WebView からの埋め込み利用、またはブラウザからの直接アクセス。
- **必要パラメータ**：`userExternalId` と `customerId` をクエリで受け取り、API 側の権限判定に使用。

## 利用シナリオ

- **Adalo WebView**
  - `userExternalId`（Adalo Users.id）/ `userName` / `customerId` / `deviceId` をクエリで付与して起動。
  - `embedded=1` を付与すると下部ナビが非表示になり、埋め込み前提の UI になる。
- **ブラウザから直接アクセス**
  - 初回はセットアップ画面（`SetupScreen`）で `userExternalId` と `deviceId` を入力。
  - その後は `localStorage` に保存されたデバイス ID を再利用。

## 主要な機能の流れ（UI 側）

1) **ユーザー/デバイス解決**：`/api/user/devices` でユーザーに紐づくデバイスと顧客を取得。  
2) **ライブラリ管理**：`/api/content/media` 系 API でメディア一覧/削除/タイトル更新。  
3) **プレイリスト管理**：`/api/content/playlists` と `/items` 系 API で作成/編集/並び替え。  
4) **割当と同期**：`/api/devices/:deviceId/*` と `/api/commands/sync-content` を使って割当と同期を実施。

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

- `openapi/spec.yaml` は **ローカル/LAN 向けの旧 API 定義**が残存している。現行 UI では参照していない。  
  参照: `signage-admin-ui/openapi/spec.yaml`
- `useLanDetect` / `useJwt` は **現行 UI から未使用**。将来整理対象。  
  参照: `signage-admin-ui/src/hook/useLanDetect.ts`, `signage-admin-ui/src/hook/useJwt.ts`

## ドキュメント一覧

- [**Setup**](setup.md) — 開発/ビルド/配信手順、環境変数
- [**Pages & Routing**](pages.md) — 画面・ルート・画面間フロー
- [**API Contract**](api.md) — UI が呼ぶ API と必須パラメータ
- [**Components**](components.md) — 主要コンポーネントの役割
- [**Hooks**](hooks.md) — 主要フックの役割
- [**CI / GitHub Actions**](../../ci/workflows/signage-admin-ui/ci.md)
