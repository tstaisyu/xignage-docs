# ページ / ルーティング

- ルータは `BrowserRouter basename="/admin"`（`src/main.tsx`）
- ルート構成：
  `/admin/` → `Dashboard`
  `/admin/upload` → `Upload`
  レイアウトは `Layout` で共通化（ボトムナビ）

## **Layout（`src/page/Layout.tsx`）**

- 画面全体のレイアウト。`<Outlet />` にページを描画
- 下部に **固定ボトムナビ**（`/` と `/upload`）

> 処理の流れ

1) 画面を `flex` 列で構成、`main` に `<Outlet />` を配置  

2) 画面下部に `<nav>`（固定・ボーダー・背景）  

3) `NavItem` は `NavLink` を利用し、`isActive` で `dock-active` を付与

!!! note
    - `.dock`, `.dock-label`, `.dock-active` は**プロジェクトの CSS 前提**（フレームワーク/DaisyUI等）。テーマ側定義が必要

## **Dashboard（`src/page/Dashboard.tsx`）**

- **音量制御 UI**。ミュート切替ボタン + スライダー
- Socket.IO で `/admin` 名前空間に接続

### **前提・引数**

- サーバ側イベント：
  **受信**：`volumeStatusChanged` → `{ muted?: boolean; volume?: string }`  
  **送信**：`toggleVolume`（ミュート切替）、`setVolume`（`{ volume: "NN%" }`）
- UI：
  `data-cy="volume-slider"`（E2E 用属性）

> 処理の流れ

1) `io('/admin')` でソケット接続を作成  

2) `useEffect` で `volumeStatusChanged` を購読し、`muted`/`value` を更新  

3) ミュートボタンで `toggleVolume` を送信、ローカル状態も反転  

4) スライダー変更で `setVolume { volume: "NN%" }` を送信

!!! note "アイコン"
    `<VolumeX />` / `<Volume2 />` は **lucide-react** 想定。依存に追加してください。

## **Upload（`src/page/Upload.tsx`）**

- `UploadDropzone` を使って D&D アップロード
- `useUpload` の `startUpload` を `onDrop` に渡す

> 処理の流れ

1) `const { startUpload } = useUpload()` を取得  

2) `<UploadDropzone onDrop={startUpload} />` を配置  

3) アップロード成功時にトースト表示、SWR `mutate` で再取得  

4) 一覧表示（`MediaGrid`）はコメントアウトされており、後日有効化可能

!!! note
    - サーバ側は `POST /api/admin/upload` を受け付ける必要があります（後述 API 参照）
