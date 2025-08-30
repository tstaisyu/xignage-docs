# signage-admin-ui（Overview）

**What**：デバイス上で動作するフロント UI（React + Vite + TypeScript）  
**Where**：`/admin` をベースパスとする SPA（`BrowserRouter basename="/admin"`）  
**Why**：ローカル操作（音量制御）、メディアのアップロード、状態確認などをブラウザから行うため

!!! note "技術スタック"
    - React / TypeScript / Vite
    - Tailwind（および tailwind-merge / clsx）
    - Socket.IO クライアント（`io('/admin')`）
    - React Router
    - SWR（一覧の再検証）
    - react-dropzone（D&D アップロード）
    - react-hot-toast（通知）
    - Radix Slider（`@radix-ui/react-slider` 前提の UI ラッパ）

## **フォルダ構成（抜粋：提供ソース基準）**

```text
src/
├── main.tsx               # ルーティング定義（/admin）
├── App.tsx                # Vite のテンプレ（未使用）
├── page/
│   ├── Dashboard.tsx      # 音量制御（Socket.IO）
│   ├── Layout.tsx         # レイアウト + ボトムナビ
│   └── Upload.tsx         # メディアのアップロード
├── components/
│   ├── MediaGrid.tsx      # アップロード済みファイルの簡易一覧
│   └── UploadDropzone.tsx # D&D アップロード UI（react-dropzone）
│   └── ui/slider.tsx      # 汎用スライダー（Radix Slider 前提）
├── hook/
│   ├── useJwt.ts          # クエリ文字列 / localStorage から JWT を取得
│   ├── useLanDetect.ts    # .local へのヘルスチェック（/ping）
│   └── useUpload.ts       # /api/admin/upload へのアップロード
├── lib/utils.ts           # cn() ユーティリティ（clsx + tailwind-merge）
└── api/types.ts           # OpenAPI 由来の型（/ping, /v1/upload, /v1/play）
```

## **アプリ画面（UI ルート）と主要機能**

> ### **Dashboard - (音量制御)**  

- `io('/admin')` で接続
- `volumeStatusChanged` で `{ muted, volume }` を反映
- `toggleVolume` を送信してミュート切替
- スライダー変更時に `setVolume { volume: "NN%" }` を送信
- UI：`data-cy="volume-slider"`（E2E 用）

> ### **Upload - (メディアアップロード)**

- `UploadDropzone` の `onDrop` → `useUpload().startUpload`
- `POST /api/admin/upload` に `multipart/form-data` で送信
- 成功時に `toast.success`、SWR `mutate` でリスト再取得

## **ドキュメント一覧**

- [**Setup**](setup.md) — 開発環境/ビルド/配信の手順、Vite 設定、Nginx 例。  
- [**Pages & Routing**](pages.md) — ルーティング構成と各画面の役割（Dashboard / Upload / Layout）。  
- [**Components**](components.md) — `MediaGrid` / `UploadDropzone` / `ui/slider` の Props と振る舞い。  
- [**Hooks**](hooks.md) — `useJwt` / `useLanDetect` / `useUpload` の API と注意点。  
- [**API Contract**](api.md) — OpenAPI（`openapi/spec.yaml`）の要点と `/api/admin` ↔ `/api/v1` の対応。  
- [**CI / GitHub Actions**](../../ci/workflows/signage-admin-ui/ci.md) — 単体/E2E、ビルド、リリース tar.gz、ライセンススキャン、バッジ更新。  

## **関連**

- **index.html**：`<div id="root"></div>` + `type="module" src="/src/main.tsx"`
- **Vite 設定（vite.config.ts）**：
  `base: '/admin/'`（ルート配信時も `/admin/` 前提）
  `server.proxy`：`/api`・`/socket.io` → `http://localhost:3000`
  `resolve.alias`：`'@' -> src`
- **OpenAPI**：`openapi/spec.yaml`（サーバベース `/api`、パスは `/v1/*`）

## **実装と整合のための注意**

- **Socket.IO の名前空間/パス**（`io('/admin')`）はサーバ側設定と一致させる。
- **API パス変換**：`/api/admin/*` ↔ `/v1/*` はリバースプロキシ（Nginx など）で吸収。

<!--

## 目的

## 概要

## ファイル構成

## セットアップと要件

## 設定（Environment Variables）

## 使い方（Quickstart）

## インターフェース

### 入力

### 出力

## 運用（Runbook）

## 依存関係

## バージョン互換性

## セキュリティ

## 既知の課題

## 変更履歴（参照）
-->