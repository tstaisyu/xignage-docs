# サービス (services)

このページは、`signage-aws-nodejs` の **サービス層**（HTTP ルート／Socket 層の橋渡し、DB/S3 のユーティリティ）を俯瞰します。  
対象：`services/*` 配下。

!!! note
    ここでは **設計骨子と I/F** に集中します。実装詳細は各ソースを参照。

## 共通方針・前提

- **Socket 参照**：`getIO()` から Socket.IO を取得し、`deviceSockets` で接続デバイスを解決。
- **アクセス制御**：`accessControlService` が DB（`contentDbClient`）を参照。
- **永続化**：DB/S3 以外は **メモリ上の Map**（再起動で消える）。

> ## 1) Command（`services/command/emitCommand.js` / `services/command/validators.js`）

### emitCommand

**目的**：デバイスへ単発イベントを **ACK なし**で送信。

#### I/F

- 入力: `emitCommand({ deviceId, userExternalId }, eventName, payload, res)`
- 出力: `200 { ok: true, message }`
- 失敗:
  `400` … `deviceId` / `userExternalId` 未指定  
  `403` … デバイス権限なし（`accessControlService`）  
  `404` … デバイス未接続 / Socket 実体なし

#### 補足

- `MASTER_USER_EXTERNAL_IDS` に該当するユーザはアクセスチェックをスキップ。

### validators

**目的**：コマンド用クエリの入力検証（`Joi`）

- `playVideoQuery`  
  `deviceId` / `command` / `fileName` / `isSingle` を検証  
  `command` は `playVideo|showImage|switchView` に限定

> ## 2) DeviceSettings Service（`services/deviceSettingsService.js`）

**目的**：端末設定の取得/更新を **ACK 付きイベント**で行う。

### 定数

- `ACK_GET = 'configResponse'`
- `ACK_UPDATE = 'configUpdated'`
- `TIMEOUT_MS = 1000`（1 秒）

### API

- `get(deviceId) -> { autoPlaylist: boolean }`  
  送信: `getConfig` / `configResponse`
- `update(deviceId, updates) -> { autoPlaylist: boolean }`  
  送信: `updateConfig` / `configUpdated`

### エラー

- Socket 未初期化 / 未接続は `status` 付き Error  
- タイムアウトは `status = 504` を付与

> ## 3) Socket Helper（`services/socket/emitWithAck.js`）

**目的**：ACK 付きイベント送信の共通ユーティリティ。

```js
emitWithAck(socketId, event, payload, ackEvent = event, timeoutMs = 5000) -> Promise<ackRes>
```

### 挙動

- `payload.requestId` と `ack.requestId` が一致したら resolve  
- `timeoutMs` 経過時は listener を外して reject

> ## 4) Access Control（`services/accessControlService.js`）

**目的**：ユーザのデバイス/顧客アクセス権を DB で検証。

- `checkUserDeviceAccess({ deviceId, userExternalId })`  
  `device_user_links` を参照し `{ ok, customerId, device, link }` を返す
- `checkUserCustomerAccess({ customerId, userExternalId })`

> ## 5) User Devices（`services/userDevicesService.js`）

**目的**：ユーザが閲覧可能なデバイス一覧と選択状態を返す。

- `getUserDevicesWithSelection({ userExternalId, deviceId })`  
  `devices` / `customers` / `selectedDeviceId` / `selectedCustomerId`
- `isMasterUser(userExternalId)`  
  `MASTER_USER_EXTERNAL_IDS` による管理者判定

> ## 6) Content Storage（`services/contentStorageService.js`）

**目的**：S3 の presigned URL 発行と削除。

- `createMediaUploadUrl({ customerId, fileName, mimeType })`  
  `mediaId` と `s3Key` を生成し、PUT 用 URL を返す
- `createMediaDownloadUrl({ s3Key, expiresInSeconds })`
- `getSignedContentUrl(s3Key, expiresInSeconds)`
- `deleteMediaObjectsForRecord(media)`（best-effort）

### 前提

- `CONTENT_BUCKET_NAME` が必須  
- `AWS_REGION` / `AWS_DEFAULT_REGION` を参照

> ## 7) Device Stores（`services/deviceIpStore.js` / `deviceMacStore.js` / `deviceInfoStore.js`）

**目的**：端末情報を **メモリ上**で保持。

- **IP/MAC Store**  
  `upsertDeviceIp` / `upsertDeviceMac` で登録  
  `WIFI_PRIORITY_INTERFACES` による **優先インタフェース選択**  
  `buildSnapshot` / `fillKnownIfaces` で `full=1` 返却向けの整形
- **Info Store**  
  `setDeviceInfo` / `getDeviceInfo`

## 生成／変更されるもの

- DB／S3 を除き、**永続的なファイル変更はありません**。  
- `deviceIpStore` / `deviceMacStore` / `deviceInfoStore` は **再起動で消失**します。
