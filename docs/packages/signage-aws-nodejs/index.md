# signage-aws-nodejs

> ## [**Runtime（Server / Middleware / Utils）**](./runtime.md)

サーバ起動と配線をまとめる層です。`.env` 読込→Express 初期化→HTTP サーバ化→Socket.IO 初期化→ルート登録→共通エラーハンドラ→起動、という流れで **HTTP と WebSocket を束ねます**。

**主な構成**  

- **server.js**：`.env` → `express.json()` / `bodyParser.json()` → `http.createServer(app)` → `initSocket(server)` → `app.use('/', routes(io))` → **共通エラーハンドラ** → `server.listen(PORT)`（既定 **3000**）
- **Middleware**：`validationResult`（`express-validator` の検証結果を **400** で集約）
- **Utils**：`extractFileNameFromUrl`（URL からファイル名抽出。失敗時は `'unknown'`。アップロード系で利用）

**設計の要点**  

- **Socket 初期化は 1 回のみ**（`initSocket` → `getIO` で参照共有）
- **エラー伝播**は `next(err)` ＋ `err.status || 500`。タイムアウトは **504 相当**で扱う方針を推奨
- **環境変数**：`PORT`（任意）、OpenAI 利用時は `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_MAX_TOKENS`

!!! tip
    ルーティングは `routes/index.js` をハブに、Socket は `initSocket()` の **単一初期化**へ集約すると見通しが良く保てます。

> ## [**ルーティング（HTTP API）**](./routes.md)

`routes/*` は Express で組んだ **HTTP エンドポイント群**です。`/api` の下にドメイン別ルータをマウントし、Socket 層（`getIO` / `deviceSockets` / `requests`）と連携して **端末操作・状態取得・アップロード**を行います。

**主要ルート（概要）**  

- `/api/commands`：再生・停止・回転・更新・音量（ACK ありの `toggleVolume` を含む）
- `/api/images`・`/api/videos`：一覧・サムネ取得（ACK：`*_ListResponse` / `thumbnailResponse`）
- `/api/playlist`：追加/挿入/移動/更新/削除/ファイルクリア（ACK：`playlistUpdateResponse`）
- `/api/uploads`・`/api/delete`：画像/動画のアップロード・削除（ACK：`upload*Response` / `delete*Response`）
- `/api/version`：端末ソフトのバージョン問い合わせ（ACK：`versionsResponse`）
- `/api/patchMigState`：パッチ/マイグレーション状態取得（ACK：`patchMigStateResponse`）
- `/api/deviceSettings`：端末設定の取得/更新（ACK：`configResponse` / `configUpdated`）
- `/api/ip`・`/api/mac`・`/api/status`：IP/MAC 登録・接続状態
- `/api/device/power`：シャットダウン/再起動
- `/api/device-info`：デバイス情報の登録/リアルタイム取得
- `/api/random`：ユーティリティ（例：ランダム部屋名）
- `/api/openai`：OpenAI 応答の配信（`io.emit`）

**設計の要点**  

- 相関：すべての往復で **`requestId` を一致確認**（誤解決防止）
- タイムアウト：一覧/サムネ/バージョン等は **5s**、削除系は **1s** など用途別に設定
- エラー方針：**400** 入力不足 / **404** 未接続 / **500** 内部異常（タイムアウトは 504 相当で扱うことを推奨）
- 検証：`routes/*/validators.js` で **express-validator / Joi** により事前バリデーション

!!! tip
    メディア系はネットワーク負荷が大きくなりがちです。**`maxHttpBufferSize` やボディサイズ制限**の調整、再送/冪等設計を検討してください。

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

**主なコンポーネント**  

- **Command（emitCommand）**：ACK なしの単発イベント送信（到達性保証不要な UI 操作向け）
- **DeviceSettingsService**：設定の取得/更新（`getConfig` / `updateConfig` → `configResponse` / `configUpdated`、既定タイムアウト ~1s）
- **PlaylistService**：一覧・更新・削除・サムネ取得（`updatePlaylist` 系、ACK は `playlistUpdateResponse`、既定タイムアウト ~5s）
- **FileDownloadService**：外部 URL を `Buffer` で取得（`axios` の `arraybuffer` 利用）
- **Socket Helper（emitWithAck）**：ACK 付きイベント送信の共通実装（`requestId` 照合・確実なリスナ解除・タイムアウト処理）

**共通設計の要点**  

- 接続解決：`deviceSockets: Map<deviceId, socketId>` と `getIO()`（Socket.IO サーバ）を利用
- 相関管理：ACK 往復では **`payload.requestId` ↔ `res.requestId`** を一致確認
- エラー方針：未接続/実体なしは 404 相当、**タイムアウトは 504 相当**（上位で HTTP にマッピング）

!!! tip
    「ACK 不要（非同期 UI）」なら **emitCommand**、  
    「整合性が重要（設定・同期）」なら **emitWithAck** を選択すると設計が安定します。

> ## [CI / GitHub Actions](../../ci/workflows/signage-aws-nodejs/ci.md)

このパッケージの CI は **fmt / lint / test** を回す基本ワークフローに加え、**依存ライセンス検査**、Release 公開時の **バッジ更新** を行います。Node は `22` を使用し、PR/Push をトリガに **失敗早期化**で品質を担保します。Release 時は `jq`＋`curl` で Gist の `release.json` を更新し、Shields.io の endpoint バッジに反映させます（`GH_PAT` は **gist スコープ**に限定）。

**内訳**  

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