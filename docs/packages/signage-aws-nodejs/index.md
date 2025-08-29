# signage-aws-nodejs

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