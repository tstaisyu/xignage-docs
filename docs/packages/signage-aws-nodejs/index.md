# signage-aws-nodejs

> ## [**ソケット層（双方向通信）**](./socket.md)

`socket/*` は端末（Jetson/Raspberry Pi）とサーバ間の **リアルタイム通信**を担います。  
接続登録・切断検知、イベント配線、ACK 応答管理、HTTP→Socket ブリッジ（例：音量トグル）を提供します。

**主なコンポーネント**  

- **index.js**：`initSocket(server)` で Socket.IO 初期化／汎用 ACK を配線（`getIO()` を公開）
- **deviceRegistry.js**：`registerDevice` / `disconnect` で `deviceId ⇢ socketId` を管理
- **playlistHandlers.js**：`imageListResponse` / `videoListResponse` を共通ハンドラで解決
- **commonRequests.js**：ACK 共通処理（`handleListResponse` / `handleVersionResponse` / `handlePatchMigResponse`）
- **toggleVolume.js**：HTTP 経由の音量トグルを発火し、`volumeStatusChanged` で応答待ち
- **requestStores.js**：共有 Map ストア  
  `deviceSockets`（`deviceId → socketId`）  
  `requests`（汎用 ACK 待ち）  
  `thumbnailRequests`（サムネ用）

**設計の要点**  

- 相関管理：**`requestId`** を往復で一致確認（誤解決防止）
- リソース管理：**resolve/reject 時に必ず `clearTimeout` と `delete`**
- セキュリティ：本番では **CORS を特定ドメインに制限**（`origin: '*'` は開発向け）

!!! tip
    同種イベントを並列に投げる場合でも、`requestId` 単位の待機者分離で衝突を防げます。

> ## [**Services（サービス層）**](./services.md)  

`services/*` は **HTTP ルート／コントローラ** と **Socket 層（端末）** の橋渡しを担います。  
ACK の要否に応じて **単発送信（emitCommand）** と **ACK 往復（emitWithAck）** を使い分け、`requestId` による相関で安全に同期します。  

### **主なコンポーネント**  

- **Command（emitCommand）**：ACK なしの単発イベント送信（到達性保証不要な UI 操作向け）
- **DeviceSettingsService**：設定の取得/更新（`getConfig` / `updateConfig` → `configResponse` / `configUpdated`、既定タイムアウト ~1s）
- **PlaylistService**：一覧・更新・削除・サムネ取得（`updatePlaylist` 系、ACK は `playlistUpdateResponse`、既定タイムアウト ~5s）
- **FileDownloadService**：外部 URL を `Buffer` で取得（`axios` の `arraybuffer` 利用）
- **Socket Helper（emitWithAck）**：ACK 付きイベント送信の共通実装（`requestId` 照合・確実なリスナ解除・タイムアウト処理）

### **共通設計の要点**  

- 接続解決：`deviceSockets: Map<deviceId, socketId>` と `getIO()`（Socket.IO サーバ）を利用
- 相関管理：ACK 往復では **`payload.requestId` ↔ `res.requestId`** を一致確認
- エラー方針：未接続/実体なしは 404 相当、**タイムアウトは 504 相当**（上位で HTTP にマッピング）

!!! tip
    「ACK 不要（非同期 UI）」なら **emitCommand**、  
    「整合性が重要（設定・同期）」なら **emitWithAck** を選択すると設計が安定します。

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