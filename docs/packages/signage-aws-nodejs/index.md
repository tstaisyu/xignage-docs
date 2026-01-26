# signage-aws-nodejs

> ## [Runtime（Server / Middleware）](./runtime.md)

**server.js** が `.env` と `/etc/signage/secret.env` を読み込み、Express → HTTP Server → Socket.IO → ルーティング登録までをまとめる層です。  
`ADMIN_UI_DIST_DIR` がある場合は `/admin` に静的配信を行い、末尾の `/*` は `index.html` へフォールバックします。

### 主な流れ

- `dotenv` → `express.json()` / `bodyParser.json()` → `http.createServer(app)`
- `initSocket(server)` → `app.use('/', routes(io))` → 共通エラーハンドラ
- `server.listen(PORT)`（既定 3000）

### 主要な環境変数

- `PORT` / `ADMIN_UI_DIST_DIR`
- `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_MAX_TOKENS`
- `INTERNAL_API_TOKEN`
- `CONTENT_DB_SECRET_ARN` / `CONTENT_BUCKET_NAME`
- `AWS_REGION` / `AWS_DEFAULT_REGION`
- `MASTER_USER_EXTERNAL_IDS`
- `WIFI_PRIORITY_INTERFACES`
- `DAILY_API_KEY` / `CALL_UI_BASE_URL` / `DOORBELL_MAX_CALL_DURATION_SEC`
- `DEVICE_LEDGER_TABLE` / `MTLS_CERT_CACHE_TTL_SEC`
- `IOT_BUNDLE_BUCKET` / `IOT_BUNDLE_PREFIX` / `IOT_BUNDLE_PRESIGN_EXPIRES_IN`
- `OTA_BUNDLE_BUCKET` / `OTA_BUNDLE_PREFIX` / `OTA_BUNDLE_PRESIGN_EXPIRES_IN`
- `DEVICE_ERROR_LOG_GROUP` / `RELAY_BASE_URL`

> ## [ルーティング（HTTP API）](./routes.md)

`/api` 配下に **device / player / admin** を束ね、別途 `/call/*` に通話 UI を提供します。  
認証は `requireHumanUser` による **`userExternalId` 必須**が基本です。

### 主要エンドポイント（概要）

- `/api/commands/*`：再生・停止・回転・更新・音量・ネットワークレポート
- `/api/content/*`：メディア／プレイリスト管理、S3 presign URL 発行
- `/api/devices/*`：デバイス同期記録（RDS 反映）
- `/api/devices/:deviceId/*`：プレイリスト取得／メディアマニフェスト（player）
- `/api/deviceSettings` / `/api/deviceWifi`：設定／Wi-Fi 操作（ACK あり）
- `/api/doorbell/*`：通話開始・終了（Daily 連携）
- `/api/version` / `/api/patchMigState`：バージョン／パッチ状態
- `/api/iot/*` / `/api/ota/*`：IoT バンドル／OTA マニフェスト
- `/api/logs/journal`：端末ログの CloudWatch 転送
- `/api/mtls/*` / `/api/ledger/*`：mTLS 最終接続／DynamoDB レジャー
- `/api/admin/*` / `/api/user/*`：管理者・ユーザ向け一覧
- `/call/join/*`：Daily 通話用の HTML UI

> ## [ソケット層（双方向通信）](./socket.md)

`socket/*` は Jetson / Raspberry Pi とサーバのリアルタイム通信を担当します。  
`registerDevice` で `deviceId ⇢ socketId` を保持し、ACK 応答は `requests` / `thumbnailRequests` の Map で相関管理します。  
`device.api.xrobotics.jp` 経由の接続は mTLS を検証し、`mtlsDeviceId` を優先して登録します。

### 主な ACK イベント

- `versionsResponse` / `patchMigStateResponse`
- `volumeStatusChanged`
- `thumbnailResponse`

> ## [Services（サービス層）](./services.md)

**HTTP ルートと Socket 層の橋渡し**に加え、DB／S3／アクセス制御のロジックが含まれます。

### 主なコンポーネント

- `emitCommand`（ACK なしコマンド送信）
- `deviceSettingsService` / `deviceWifiService` / `emitWithAck`
- `accessControlService` / `userDevicesService`
- `contentStorageService`（S3 presign）
- `iotBundleResolver` / `otaBundleResolver` / `iotCertResolver`
- `mtlsLastSeenStore` / `deviceLedgerStore` / `iotDriftDetector`
- `cloudwatchLogsWriter`
- `deviceIpStore` / `deviceMacStore` / `deviceInfoStore`

> ## [CI / GitHub Actions](../../ci/workflows/signage-aws-nodejs/ci.md)

このパッケージの CI は **fmt / lint / test** を回す基本ワークフローに加え、**依存ライセンス検査**、Release 公開時の **バッジ更新** を行います。Node は `22` を使用し、PR/Push をトリガに **失敗早期化**で品質を担保します。Release 時は `jq`＋`curl` で Gist の `release.json` を更新し、Shields.io の endpoint バッジに反映させます（`GH_PAT` は **gist スコープ**に限定）。

### 内訳

- **AWS Node.js CI**：`fmt` → `lint` → `test`（`push`/`pull_request` 対象：`main`）
- **License Check**：`npm run check:license`（依存の法的健全性を継続監視）
- **Update Release Badge**：Release 公開時に **Gist のバッジ JSON を更新**（非プレリリースのみ）

!!! tip
    CI の再現性と速度を両立させるには、**`npm ci`＋キャッシュ**の併用が有効です。`GH_PAT` は **最小権限（gist）**で保管してください。

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
