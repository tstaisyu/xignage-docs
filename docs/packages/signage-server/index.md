# signage-server

> ## [**ユーティリティ（utils/）**](./utils.md)

Node 実行時に用いる補助関数群。Jetson/Raspberry Pi の計測（`tegrastats` / `vcgencmd`）、パッチ／マイグレーション状態の集約、将来の共通ロガーを含みます。同期実行（`execSync`）が多いため、ポーリング間隔や権限に注意。

<!--
## 目的

Jetson / Raspberry Pi などの端末上でデジタルサイネージの再生と制御を担う**中核バックエンド**として、クラウド／ローカルからの操作を安全に受け付け、現場で安定動作させる。

## 概要

- **軽量バックエンド**：Jetson・Raspberry Pi 等で動作。デジタルサイネージ全体を駆動。
- **主な機能**：画像・動画・YouTube・AI生成テキストの**リモート制御**／**ネットワーク断時のローカル再生フェイルセーフ**。
- **プロトコル**：**Socket.IO**（cloud ↔ device ↔ browser）＋ **REST/HTTP API**。
- **モジュール化**：デバイス情報・更新・プレイリスト・画面回転などを**サービスとして分離**。
- **品質**：**Jest / Supertest による 100% ユニット／結合テストカバレッジ**（README記載）。
- **CI/CD**：タグ作成ごとに GitHub Actions で**署名付き** `signage-server.tar.gz` と `.sha256` を生成。

## ファイル構成

## セットアップと要件

## 使い方（Quickstart）

## インターフェース

### クラウド接続（Socket.IO）

- **方向**：デバイス → クラウド（client）
- **エンドポイント**：`SERVER_URL`（既定: `https://api.xrobotics.jp`）、`path: /socket.io`
- **トランスポート**：`websocket` 固定
- **接続時の挙動**：
  - `registerDevice` を `DEVICE_ID` と共に送信
  - ローカルIPの再登録を試行（成功/失敗をログ出力）
- **切断時**：理由をログ出力（自動再接続は Socket.IO に準拠）

## 設定（Environment Variables）

| Key         | Required | Default                | Note                                     |
|-------------|----------|------------------------|------------------------------------------|
| SERVER_URL  | yes      | `https://api.xrobotics.jp` | クラウドの Socket.IO エンドポイント（`/socket.io`） |
| DEVICE_ID   | yes      | —                      | 端末識別子。`registerDevice` に使用        |

## 運用（Runbook）

## 依存関係

## バージョン互換性

## セキュリティ

## 既知の課題

## 変更履歴（参照）
-->