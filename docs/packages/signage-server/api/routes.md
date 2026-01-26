# API ルーティング（routes/）

`routes/` 配下の HTTP ルーターを **現行実装に合わせて統合**して記述します。  
本ページのパスは **各ルーターの「マウント先」からの相対パス**です（実際の URL は `app.use()` 側の Base Path に依存）。

## 概要

- **責務**：HTTP エンドポイントの入口。静的 HTML の配信、設定値の取得、ローカルプレイリストの取得、ビュー切替、クラウド同期テスト、ドアベル通知を提供。
- **関連モジュール**（`routes/index.js` がエクスポート）：
  - `kioskRoutes`, `testRoutes`, `viewRoutes`,
    `localPlaylistRoutes`, `configRoutes`, `doorbellRoutes`
- **主な依存**：`controllers/*`, `services/*`, `config/*`, `public/*`, `middlewares/errorHandler.js`

## 共通仕様

- **Content-Type**：JSON を返す API は `application/json`。静的ページ配信は `text/html`。
- **エラー処理**：一部は `try/catch` で `res.status(4xx/5xx)` を直接返す。`next(err)` は現行ルートでは使用していない。
- **認証/認可**：現状コード上は未実装（必要に応じて今後追加）。

## 早見表（エンドポイント一覧・相対パス）

|Group|Method|Path|概要|成功時レスポンス|備考|
|---|---|---|---|---|---|
|**Config**|GET|`/`|端末ローカル設定を返す|`{ autoPlaylist, screenRotation }`|失敗時はデフォルト|
|**Kiosk**|GET|`/`|`public/kiosk.html` を配信|HTML||
|**LocalPlaylist**|GET|`/`|`playlist.json` を読み取り→正規化して返却|`{ records: Item[] }`|ない場合は空配列を書き出し|
||GET|`/thumbnail`|サムネイル取得のプレースホルダ|`200 "not yet implemented"`|`contentId`/`deviceId` 必須|
|**Test**|GET|`/csi-snapshot`|CSI カメラの JPEG スナップショット|`image/jpeg`|`cameraController` 委譲|
||POST|`/cloud-sync`|クラウド正本型の同期テスト|`{ success, ... }`|`cloudContentSync` を実行|
|**View**|GET|`/switch/:view`|ビュー切替イベントを送出|`{ status: "OK", target }`|`ioLocal.emit('switchView', view)`|
|**Doorbell**|POST|`/test`|ドアベル押下の擬似イベント送信|`{ ok: true, result }`|AWS IoT へ publish|
||POST|`/start-call`|通話開始ダミー応答|`{ success, callId, joinUrlDevice, ... }`|実装はスタブ|

## 各ルーター詳細

> ### Config（`routes/configRoutes.js`）

- **GET `/`**：端末ローカル設定を返す。  
  **読み取り元**：`/var/lib/signage_local/localSettings.json`  
  **フォールバック**：`{ autoPlaylist: false, screenRotation: 'right' }`

> ### Kiosk（`routes/kioskRoutes.js`）

- **GET `/`**：`public/kiosk.html` を送信。

> ### Local Playlist（`routes/localPlaylistRoutes.js`）

- **GET `/`**：ローカルの `playlist.json` を読み取り、**正規化された配列**を返す。  
  **パス**：`path.join(config.CONTENTS_DIR, 'playlist.json')`  
  **入力想定**：各要素 `{ contentId, order?, duration? }`（`file` でも可）  
  **正規化**：`type` は拡張子で推定（`.mp4`/`.mov` → `video`、それ以外 → `image`）  
  **レスポンス**：`{ records: { file, type, order, duration }[] }`

- **GET `/thumbnail`**：プレースホルダ（未実装）。  
  **Query**：`contentId`, `deviceId` 必須（未指定は `400`）  
  現状は `200 'Thumbnail route not yet implemented'` を返す

> ### Test（`routes/testRoutes.js`）

- **GET `/csi-snapshot`**：`cameraController.getCsiSnapshot` に委譲（`image/jpeg`）。  
- **POST `/cloud-sync`**：`cloudContentSync.syncOnceFromCloud` を実行（`DEVICE_ID` と `SERVER_URL` を使用）。

> ### View（`routes/viewRoutes.js`）

- **GET `/switch/:view`**：`ioLocal.emit('switchView', view)` を送出し、`{ status: 'OK', target: view }` を返却。

!!! note
    - `ioLocal` は `sockets/localSocket` から取得していますが、現行コードでは **`ioLocal` を export していない**ため、依存の実体が不明です。  
      TODO: `ioLocal` の注入/公開方法を確認し、本記述を確定（根拠: `signage-server/routes/viewRoutes.js`, `signage-server/sockets/localSocket.js`）。

> ### Doorbell（`routes/doorbellRoutes.js`）

- **POST `/test`**：`publishDoorbellTest({ deviceId })` を実行。  
  **deviceId** は `body` または `query` から取得。  

- **POST `/start-call`**：通話開始の**スタブ**応答を返す。  
  `CALL_UI_BASE_URL` が未設定の場合は `https://example.com` を使用。

## メモや注意（全体）

- **マウントパス**：実際の URL は `app.use()` の設定に依存（例：`app.use('/api/test', testRoutes)` など）。  
- **静的配信**：`res.sendFile()` のベースは `__dirname/../public/`。デプロイ時の相対位置に留意。  
