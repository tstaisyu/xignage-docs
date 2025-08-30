# ルーティング (routes)

`routes/*` は **HTTP API の集合**で、Express ルータをドメイン別に分割し `/api` 配下へマウントします。  
Socket 層（`getIO`, `deviceSockets`, `requests`, `thumbnailRequests`）と連携し、端末指令・状態取得・設定更新などを提供します。

## **マウント構成（全体像）**

- `routes/index.js`  
  `/api` → `apiRoutes(io)`（下記の機能群）  
  `/api` → `deviceRoutes`（IP/MAC/Status/Power/Device-Info）  
  `/api` → `uploadRoutes`（※別途）

- `routes/apiRoutes.js`（/api 配下）
  `/commands` … `command/index.js`（play/system/volume）
  `/images` … `imageRoutes`（※概要のみ）
  `/videos` … `videoRoutes`（※概要のみ）
  `/openai` … `openaiRoutes(io)`（※io 依存）
  `/random` … `randomRoutes`
  `/playlist` … `playlistRoutes`（※概要のみ）
  `/version` … `versionRoutes`
  `/patchMigState` … `patchMigRoutes`
  `/deviceSettings` … `deviceSettings`（index/validators/controller）

- `routes/deviceRoutes.js`（/api 配下）
  `/ip` … `ipRoutes`
  `/mac` … `macRoutes`
  `/status` … `statusRoutes`
  `/device/power` … `powerRoutes`
  `/device-info` … `deviceInfoRoutes`

!!! tip "命名規約"
    `GET /api/<domain>`：参照、`POST /api/<domain>/register|update|send`：登録/操作、`PATCH /api/<domain>/:id`：部分更新。

## **共通前提**

- **接続管理**：`deviceSockets: Map<deviceId, socketId>`（`requestStores.js`）  
- **Socket サーバ**：`getIO()`（`socket/index.js`）  
- **ACK 待機**：`requests` / `thumbnailRequests`（`requestStores.js`）  
- **エラー方針**：`400` 入力不足、`404` デバイス未接続/ソケット不明、`500` 内部異常、タイムアウト系は原則 `504` 相当（実装によっては 500）

## **1) Commands（/api/commands/*）**

> ### **GET `/api/commands/send`**

**用途**：簡易操作（クエリ）  
**query**：`deviceId`, `command` (`playVideo|showImage|switchView|switchViewYT`), `fileName?`, `isSingle?`  
**挙動**：

- `playVideo` → `emitCommand(deviceId,'playVideo',{ fileName,isSingle },res)`
- `showImage` / `switchView` → `emitCommand(deviceId, '<event>', fileName, res)`
- `switchViewYT` → **5s 待機後** `switchView` を送信

> ### **POST `/api/commands/send`**

**用途**：構造化操作（JSON）  
**body**：`{ deviceId, command, payload? }`  
**分岐**：

- `setVolume` → `emitCommand(deviceId,'setVolume',{ volume },res)`（`payload.volume` 必須）
- `toggleVolume` → **Socket ACK 待ち**（`toggleVolumeHandler` へ委譲）
- `playYoutube` → `emitCommand(deviceId,'playYoutube', { youtubeUrl | playlistId }, res)`
- その他 → `400 Unknown command`

> ### **System（`command/systemRoutes.js`）**

- `POST /api/commands/start` → `startPlaylist`（ACK 無し）
- `POST /api/commands/stop` → `stopPlaylist`
- `POST /api/commands/rotate` → `toggleRotation({ deviceId })`
- `POST /api/commands/update` → `startUpdate({ deviceId })`
- `POST /api/commands/network/reset` → `networkResetCommand({ deviceId })`
- `POST /api/commands/kioskRestart` → `forceKiosk`

> ### **Volume（トグル/セット）**

- `POST /api/commands/send`（上記の POST 分岐内）
  `setVolume`：即時送信（ACK 無し）
  `toggleVolume`：`toggleVolumeHandler` 経由で **`volumeStatusChanged`** ACK を待機（10s タイムアウト）

!!! tip "ACK の使い分け"
    即時 UI 操作は `emitCommand`（ACK 無し）、整合性重視は **ACK 往復**（`toggleVolume` など）。

## **2) Device 基盤（/api/ip, /api/mac, /api/status, /api/device-info, /api/device/power）**

> ### **IP（`ipRoutes.js`）**

- `POST /api/ip/register`：`{ deviceId, localIp }` を登録（メモリ）  
- `GET /api/ip?deviceId=...`：登録済み IP を返却

> ### **MAC（`macRoutes.js`）**

- `POST /api/mac/register`：`{ deviceId, macAddress }` を登録（メモリ）  
- `GET /api/mac?deviceId=...`：登録済み MAC を返却

> ### **Status（`statusRoutes.js`）**

- `GET /api/status?deviceId=...`：`deviceSockets.has(deviceId)` により  
  `{ status: '接続中' }` or `{ status: '未接続' }`

> ### **Device-Info（`deviceInfoRoutes.js`）**

- `POST /api/device-info/register`：`{ deviceId, info }` を登録（メモリ）  
- `GET /api/device-info?deviceId=...`：登録済み info を **配列形式** `[{key,value}, ...]` で返却
- `POST /api/device-info/update`：**リアルタイム取得**  
  1) `deviceSockets.get(deviceId)` → `socketId`  
  2) `requestId` を発番して `requestDeviceInfo` を端末へ emit  
  3) `deviceInfoResponse`（一致 `requestId`）で `info` を受領 → `deviceInfos` 更新 → 応答

> ### **Power（`powerRoutes.js`）**

- `POST /api/device/power/shutdown`：`io.to(deviceId).emit('shutdownCommand')`  
- `POST /api/device/power/reboot`：`io.to(deviceId).emit('rebootCommand')`

!!! warning "永続化"
    `ip/mac/device-info` は **メモリ保持**です。再起動で失われる点に注意。

## **3) バージョン / パッチ状態（/api/version, /api/patchMigState）**

> ### **Versions（`versionRoutes.js`）**

- `GET /api/version/versions?deviceId=...`  
  1) `requestId` を登録（`requests` に `{ resolve, timeout }`）  
  2) 端末へ `getVersions` emit  
  3) `versionsResponse({ requestId, serverVersion, uiVersion, farmVersion })` で解決  
  4) 5s タイムアウトで失敗

> ### **Patch/Migration（`patchMigRoutes.js`）**

- `GET /api/patchMigState?deviceId=...`  
  1) `requestId` を登録（`requests`）  
  2) 端末へ `getPatchMigState` emit  
  3) `patchMigStateResponse({ requestId, state })` で解決  
  4) 5s タイムアウトで失敗  
  **例**：`{ state: '20250801192830-030-020-040' }`

## **4) Device Settings（/api/deviceSettings/*）**

- `GET /api/deviceSettings?deviceId=...`（`validateQuery`） → `c.get`  
- `GET /api/deviceSettings/:deviceId`（`validateGet`） → `c.get`  
- `PATCH /api/deviceSettings/:deviceId`（`validatePatch`） → `c.update`  
  `body.autoPlaylist: boolean` 必須

**バリデータ（抜粋）**  

- `validateGet`: `param('deviceId').notEmpty()`
- `validateQuery`: `query('deviceId').notEmpty()`
- `validatePatch`: `param('deviceId').notEmpty()`, `body('autoPlaylist').exists().isBoolean()`

**内部実装（参考）**  

- Socket 経由で `getConfig` / `updateConfig` を送信し、`configResponse` / `configUpdated` の ACK を待機（1s）

### **Controller 挙動（`controllers/deviceSettingsController.js`）**

- **GET** `c.get(req, res, next)`  
  `deviceId` を `params` または `query` から取得  
  `svc.get(deviceId)` を呼び、**単一要素配列**で返す：`res.json([cfg])`
- **PATCH** `c.update(req, res, next)`  
  `deviceId` は `params`、更新内容は `body`  
  `svc.update(deviceId, body)` の結果をそのまま返却：`res.json(cfg)`

※ いずれも内部でサービス層（`deviceSettingsService`）の **ACK 往復**（`getConfig` / `updateConfig`）を利用。

## **5) Random（/api/random/*）**

- `GET /api/random/roomNameAlpha`  
  英数 6 文字のランダム文字列を生成 `{"roomName": "k7x9qg"}`

## **6) Media（images / videos / playlist / upload）**

メディア関連は **一覧・サムネ取得・アップロード・削除・プレイリスト操作**の 5 系列で構成されます。  
往復はすべて **requestId による相関**で管理し、ACK 名は下記の通りです。

- **一覧**: `getImageList` → `imageListResponse` / `getVideoList` → `videoListResponse`
- **サムネ**: `getImageThumbnail` / `getVideoThumbnail` → `thumbnailResponse`
- **アップロード**: `uploadImage` → `uploadImageResponse` / `uploadVideo` → `uploadVideoResponse`
- **削除**: `deleteImage` → `deleteImageResponse` / `deleteVideo` → `deleteVideoResponse` / `deleteAllFiles` → `deleteAllFilesResponse`
- **プレイリスト**: `updatePlaylist`（`action: list|add|insert|move|update|remove` など）→ `playlistUpdateResponse`

!!! note "接続前提"
    すべての API は `deviceSockets.get(deviceId)` により **接続済みデバイス**が前提です。未接続は 404 を返します。

> ### **6.1) Images API（`/api/images/*`）**

#### **GET `/api/images/list?deviceId=...`**

- **目的**: 画像ファイル一覧（端末から）
- **送信**: `getImageList({ requestId })`（宛先: `socketId`）
- **ACK**: `imageListResponse({ requestId, records, error })`
- **タイムアウト**: 5s（`requests` から削除）
- **応答**: `{ records: string[] }`

#### **GET `/api/images/thumbnail?deviceId=...&fileName=...`**

- **目的**: 指定画像のサムネイルを取得
- **送信**: `getImageThumbnail({ requestId, fileName })`
- **ACK**: `thumbnailResponse({ requestId, buffer, error })`
- **タイムアウト**: 5s
- **応答**: `Content-Type: image/jpeg`（バイナリ）

> ### **6.2) Videos API（`/api/videos/*`）**

#### **GET `/api/videos/list?deviceId=...`**

- **目的**: 動画ファイル一覧（端末から）
- **送信**: `getVideoList({ requestId })`
- **ACK**: `videoListResponse({ requestId, records, error })`
- **タイムアウト**: 5s
- **応答**: `{ records: string[] }`

#### **GET `/api/videos/thumbnail?deviceId=...&fileName=...`**

- **目的**: 指定動画のサムネイルを取得
- **送信**: `getVideoThumbnail({ requestId, fileName })`
- **ACK**: `thumbnailResponse({ requestId, buffer, error })`
- **タイムアウト**: 5s
- **応答**: `Content-Type: image/jpeg`

### **6.3) Uploads API（`/api/uploads/*` / `/api/delete/*`）**

- ルート構成: `uploadRoutes.js` →  
  `router.use('/uploads', uploadRouter)`（`/api/uploads/image|video`）  
  `router.use('/delete', deleteRoutes)`（`/api/delete/image|video|all`）

#### **POST `/api/uploads/image`（Body: `{ deviceId, fileUrl }`）**

- **流れ**:
  1) `fetchFileBuffer(fileUrl)` で外部 URL をダウンロード（Buffer 化）
  2) `fileName = <timestamp>-<original>` を生成
  3) `uploadImage({ requestId, fileName, fileData })` を emit
  4) `uploadImageResponse` を ACK 待機（5s）
- **応答**: `{ success: true, jetsonResult }`

#### **POST `/api/uploads/video`（Body: `{ deviceId, fileUrl }`）**

- **流れ**: 上記 image と同様に `uploadVideo` / `uploadVideoResponse`
- **応答**: `{ success: true, jetsonResult }`

#### **POST `/api/delete/image`（Body: `{ deviceId, fileName }`）**

- **送信**: `deleteImage({ requestId, fileName })`
- **ACK**: `deleteImageResponse`
- **タイムアウト**: 1s

#### **POST `/api/delete/video`（Body: `{ deviceId, fileName }`）**

- **送信**: `deleteVideo({ requestId, fileName })`
- **ACK**: `deleteVideoResponse`
- **タイムアウト**: 1s

#### **POST `/api/delete/all`（Body: `{ deviceId }`）**

- **送信**: `deleteAllFiles({ requestId })`
- **ACK**: `deleteAllFilesResponse`
- **タイムアウト**: 1s

!!! warning "転送サイズ"
    端末へ **Buffer を Socket.IO で送信**します。大容量を扱う場合は  
    Socket.IO の `maxHttpBufferSize`（サーバ/クライアント双方）や  
    HTTP 側の `body-parser` 制限を適切に設定してください。

### **6.4) Playlist API（`/api/playlist/*`）**

- ルータ: `routes/playlist/index.js`  
- バリデータ: `routes/playlist/validators.js`  
- コントローラ: `controllers/playlistController.js`

#### **GET `/api/playlist?deviceId=...`**

- **validateList**: `query('deviceId').notEmpty()`
- **役割**: 一覧取得（内部で `action:'list'` を伴う `updatePlaylist` を使用）

#### **GET `/api/playlist/thumbnail?deviceId=...&contentId=...`**

- **validateThumbnail**: `query('deviceId')`, `query('contentId')`
- **役割**: コンテンツ ID 指定のサムネ取得（`thumbnailResponse` 受領）

#### **POST `/api/playlist`（Body 必須）**

- **validateCreate**:
  `deviceId` 必須
  `action ∈ { add, insert }`
  `contentId` 必須
- **役割**: 追加/挿入（`updatePlaylist` → `playlistUpdateResponse`）

#### **PATCH `/api/playlist/:uuid?deviceId=...`（Body 条件付き）**

- **validateUpdate**:
  `query('deviceId')`, `param('uuid')` 必須
  `action ∈ { move, update }`
  `targetIndex`（move 時）: `isInt({min:0})`
  `duration`（update 時）: `isInt({min:1})`
  `contentId`（update 時）: `optional().notEmpty()`
- **役割**: 並べ替え/更新

#### **DELETE `/api/playlist/:uuid?deviceId=...`**

- **validateDelete**: `query('deviceId')`, `param('uuid')`
- **役割**: 項目削除（内部は `action:'remove'` で `updatePlaylist`）

#### **DELETE `/api/playlist/:playlistName?deviceId=...`**

- **validateClearFile**: `query('deviceId')`, `param('playlistName')`
- **役割**: プレイリストファイルのクリア

!!! warning "ルーティングの競合に注意"
    `DELETE /api/playlist/:uuid` と `DELETE /api/playlist/:playlistName` は  
    **同一パスパターン**のため、定義順でマッチが決まります。  
    競合回避のため、**固定 prefix**（例: `/by-id/:uuid`, `/by-name/:playlistName`）等の採用を検討してください。

#### **Controller 挙動（`controllers/playlistController.js`）**

- **定数**：`SERVER_URL = 'https://api.xrobotics.jp'`  
  サムネ取得エンドポイント（本サーバの `/api/playlist/thumbnail`）へリンクを組み立てるために使用。

- **GET `/api/playlist?deviceId=...` → `list`**  
  `playlistSvc.fetchPlaylist(deviceId)` の戻り配列に対し、各項目へ`thumbnailUrl: ${SERVER_URL}/api/playlist/thumbnail?deviceId=${deviceId}&contentId=${item.contentId}` を付加して返却。

- **GET `/api/playlist/thumbnail?deviceId=...&contentId=...` → `thumbnail`**  
  `contentId` の拡張子で **イベント名を自動判定**：  
  → 動画：`getVideoThumbnail`（`.mp4`, `.mov`）  
  → 画像：`getImageThumbnail`（`.jpg|.jpeg|.png`）  
  サムネファイル名：`<basename>-thumbnail.jpg`  
  `playlistSvc.fetchThumbnail(deviceId, eventName, thumbFile)` 実行 → `image/jpeg` で返却

- **POST `/api/playlist` → `create`**  
  Body：`{ deviceId, action: 'add'|'insert', contentId, targetIndex?, duration? }`  
  `playlistSvc.updateItem(...)` の戻りを返却

- **PATCH `/api/playlist/:uuid?deviceId=...` → `update`**  
  Body：`{ action: 'move'|'update', targetIndex?, duration?, contentId? }`  
  `targetIndex` は数値へ正規化（`Number()`）  
  `playlistSvc.modifyItem(...)` の戻りを返却

- **DELETE `/api/playlist/:uuid?deviceId=...` → `remove`**  
  `playlistSvc.removeItem(deviceId, uuid)` の戻りを返却

- **DELETE `/api/playlist/:playlistName?deviceId=...` → `clearFile`**  
  `playlistSvc.clearFile(deviceId, playlistName)` の戻りを `{ message, result }` で返却

## **7) OpenAI API（/api/openai/*）**

- ルータ: `routes/openaiRoutes.js`

### **POST `/api/openai/ask`（Body: `{ userInput }`）**

- **環境変数**:
  `OPENAI_API_KEY`（必須）
  `OPENAI_MODEL`（既定: `gpt-3.5-turbo`）
  `OPENAI_MAX_TOKENS`（既定: `50`）
- **処理**:
  1) Chat Completion を呼び出し、回答テキストを取得
  2) `io.emit('updateText', { text })`（全クライアントへ配信）
  3) HTTP 応答 `{ success: true, openaiResponse }`

!!! tip "配信対象の絞り込み"
    端末個別に返す場合は `io.to(deviceId).emit(...)` の **ルーム送信**を利用してください。

## セキュリティ / 運用メモ

- **認可**：管理 API のため、認証・認可（API Key / JWT 等）を前段で必須化推奨  
- **Origin/CORS**：本番では許可ドメインを限定  
- **レート制限**：`/commands/send` 等は誤爆・連打対策を推奨  
- **永続化**：`ip/mac/device-info` は必要に応じて DB 化を検討
