# signage-server

> ## [**ランタイム（Runtime / Bootstrap）**](./runtime/index.md)

Node プロセスの**起動〜稼働の骨格**。起動時回転の適用 → HTTP/Socket.IO 立ち上げ → Cloud/Local ソケット初期化 → IP/MAC/端末情報の登録までを担います。

- [**Express App 構成・配信・API マウント**](./runtime/express-app.md)  
  （`public/`・`build/` 静的配信、`/images`・`/videos` 配信、`/api/*` ルート、例外 `/localPlaylist`・`/forceKiosk`・`/health`）
- [**Chromium Manager（キオスク再読込）**](./runtime/chromium-manager.md)  
  （`killall chrome` を X 環境で実行。`GET /forceKiosk` からトリガ）

※ 起動時の詳細フロー・エラーハンドラ登録・Socket.IO 初期化は [**ランタイム概要**](./runtime/index.md)を参照

> ## [**API**](./api/index.md)

Express ベースの **HTTP レイヤ**。**ルーティング（routes）** を入口に、**コントローラー（controllers）/ Service** へ処理を委譲します。静的ページ配信と JSON API が混在します。

※ エラーハンドラについては、[`API`](./api/index.md) の「エラーハンドラ」節を参照

> ## [**サービス（Services）**](./services/index.md)

端末内ロジックのサービス層を**用途別**に集約。  

- **System / Platform**：端末情報・OS/時刻/NTP・GPU統計・回転・電源/再起動・更新トリガ・ローカル設定  
- **Network / Registration**：IP/MAC 検出と登録・端末情報のクラウド登録・Wi-Fi設定クリア/再起動  
- **Content / Doorbell**：クラウド正本型の同期（プレイリスト/メディア）、ドアベル通知の IoT 送信

> ## [**コンポーネント（Components）**](./components/index.md)

リアルタイム連携（Socket.IO）の**ブリッジ群**。  

- **Cloud Socket**：端末→クラウドの Socket.IO クライアント。接続時 `registerDevice`、クラウド指示を端末へ橋渡し（ビュー切替/同期/音量/電源など）  
- **Local Socket**：端末内 Socket.IO（`/` と `/admin`）のブリッジ。`setVolume`/`toggleVolume` 等をローカル内に中継

> ## [**ユーティリティ（utils/）**](./utils.md)

Node 実行時に用いる補助関数群。Jetson/Raspberry Pi の計測（`tegrastats` / `vcgencmd`）、パッチ／マイグレーション状態の集約、将来の共通ロガーを含みます。同期実行（`execSync`）が多いため、ポーリング間隔や権限に注意。

> ## [**Public（UI）**](./public/index.md)

Chromium（キオスク）で表示される **フロントページ群** と、それらに読み込まれる **JSモジュール**の入口。  
ローカル Socket.IO と連携し、初期化後は **`clientReady`** を送出して保留イベント（`showImage` / `playVideo` など）を受け取ります。  
アセットは `/images/*`・`/videos/*` を参照。

> ## [**設定（Config）**](./config.md)

`config/index.js` は **.env の読込（dotenv）** と **主要パス／起動ポート等の定義**を担い、**読み込み時に必要ディレクトリを自動作成**します（`images/`, `videos/`）。

<!--
## 目的

Jetson / Raspberry Pi などの端末上でデジタルサイネージの再生と制御を担う**中核バックエンド**として、クラウド／ローカルからの操作を安全に受け付け、現場で安定動作させる。

## 概要

- **軽量バックエンド**：Jetson・Raspberry Pi 等で動作。デジタルサイネージ全体を駆動。
- **主な機能**：画像・動画・AI生成テキストの**リモート制御**／**ネットワーク断時のローカル再生フェイルセーフ**。
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
- **エンドポイント**：`SERVER_URL`（既定: `https://device.api.xrobotics.jp`）、`path: /socket.io`
- **トランスポート**：`websocket` 固定
- **接続時の挙動**：
  - `registerDevice` を `DEVICE_ID` と共に送信
  - ローカルIPの再登録を試行（成功/失敗をログ出力）
- **切断時**：理由をログ出力（自動再接続は Socket.IO に準拠）

## 設定（Environment Variables）

| Key         | Required | Default                | Note                                     |
|-------------|----------|------------------------|------------------------------------------|
| SERVER_URL  | yes      | `https://device.api.xrobotics.jp` | クラウドの Socket.IO エンドポイント（`/socket.io`） |
| DEVICE_ID   | yes      | —                      | 端末識別子。`registerDevice` に使用        |

## 運用（Runbook）

## 依存関係

## バージョン互換性

## セキュリティ

## 既知の課題

## 変更履歴（参照）
-->
