# サービス (services)

このページは、`signage-aws-nodejs` の **サービス層**（HTTP ルート／Socket 層の橋渡し、DB/S3/DynamoDB/IoT のユーティリティ）を俯瞰します。  
対象：`services/*` 配下。

!!! note
    ここでは **設計骨子と I/F** に集中します。実装詳細は各ソースを参照。

## 共通方針・前提

- **Socket 参照**：`getIO()` から Socket.IO を取得し、`deviceSockets` で接続デバイスを解決
- **アクセス制御**：`accessControlService` が RDS（`contentDbClient`）を参照
- **永続化**：RDS / S3 / DynamoDB を除き、**メモリ上の Map** を使用

> ## 1) Command（`services/command/emitCommand.js`）

**目的**：デバイスへ単発イベントを **ACK なし**で送信。

### I/F

- 入力: `emitCommand({ deviceId, userExternalId }, eventName, payload, res)`
- 出力: `200 { ok: true, message }`
- 失敗:
  `400` … `deviceId` / `userExternalId` 未指定  
  `403` … デバイス権限なし（`accessControlService`）  
  `404` … デバイス未接続 / Socket 実体なし

### 補足

- `MASTER_USER_EXTERNAL_IDS` に該当するユーザはアクセスチェックをスキップ

> ## 2) Command Validators（`services/command/validators.js`）

**目的**：コマンド用クエリの Joi スキーマ。

- `playVideoQuery` は `playVideo|showImage|switchView` を検証
- 現行コードでは参照箇所が見当たらないため **ルート側で未使用**  
  TODO: ルートに組み込む場合は `signage-aws-nodejs/services/command/validators.js`

> ## 3) DeviceSettings Service（`services/deviceSettingsService.js`）

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
- タイムアウトは `status = 504`

> ## 4) Device Wi-Fi Service（`services/deviceWifiService.js`）

**目的**：Wi-Fi の取得／削除を **ACK 付きイベント**で行う。

- `get(deviceId)` → `getWifiNetworks` / `wifiNetworksResponse`
- `delete(deviceId, ssid)` → `deleteWifiNetwork` / `wifiNetworkDeleted`
- `TIMEOUT_MS = 2000`（2 秒）

> ## 5) Socket Helper（`services/socket/emitWithAck.js`）

**目的**：ACK 付きイベント送信の共通ユーティリティ。

```js
emitWithAck(socketId, event, payload, ackEvent = event, timeoutMs = 5000) -> Promise<ackRes>
```

### 挙動

- `payload.requestId` と `ack.requestId` が一致したら resolve
- `timeoutMs` 経過時は listener を外して reject

> ## 6) Access Control（`services/accessControlService.js`）

**目的**：ユーザのデバイス/顧客アクセス権を RDS で検証。

- `checkUserDeviceAccess({ deviceId, userExternalId })`  
  `device_user_links` を参照し `{ ok, customerId, device, link }` を返す
- `checkUserCustomerAccess({ customerId, userExternalId })`

> ## 7) User Devices（`services/userDevicesService.js`）

**目的**：ユーザが閲覧可能なデバイス一覧と選択状態を返す。

- `getUserDevicesWithSelection({ userExternalId, deviceId })`  
  `devices` / `customers` / `selectedDeviceId` / `selectedCustomerId`
- `isMasterUser(userExternalId)`  
  `MASTER_USER_EXTERNAL_IDS` による管理者判定

> ## 8) Content Storage（`services/contentStorageService.js`）

**目的**：S3 の presigned URL 発行と削除。

- `createMediaUploadUrl({ customerId, fileName, mimeType })`
- `createMediaDownloadUrl({ s3Key, expiresInSeconds })`
- `getSignedContentUrl(s3Key, expiresInSeconds)`
- `deleteMediaObjectsForRecord(media)`（best-effort）

### 前提

- `CONTENT_BUCKET_NAME` が必須
- `AWS_REGION` / `AWS_DEFAULT_REGION` を参照

> ## 9) Device Stores（`services/deviceIpStore.js` / `deviceMacStore.js` / `deviceInfoStore.js`）

**目的**：端末情報を **メモリ上**で保持。

- **IP/MAC Store**  
  `upsertDeviceIp` / `upsertDeviceMac` で登録  
  `WIFI_PRIORITY_INTERFACES` による **優先インタフェース選択**  
  `buildSnapshot` / `fillKnownIfaces` で `full=1` 返却向けの整形
- **Info Store**  
  `setDeviceInfo` / `getDeviceInfo`

> ## 10) IoT / mTLS Resolver（`services/iotCertResolver.js` / `iotBundleResolver.js` / `otaBundleResolver.js`）

**目的**：IoT 証明書と S3 バンドルの解決。

- `resolveThingNameFromCertId(certId)`（IoT DescribeCertificate + ListPrincipalThings）
- `resolveIotBundleForThingName(thingName)`（`IOT_BUNDLE_BUCKET` を参照）
- `resolveOtaBundle(name)`（`OTA_BUNDLE_BUCKET` or `IOT_BUNDLE_BUCKET` を参照）

> ## 11) DynamoDB Ledger（`services/deviceLedgerStore.js`）

**目的**：証明書発行・バンドル発行・ドリフト結果を DynamoDB に記録。

- `recordCertIssued({ deviceId, certId, certArn, policyName, thingGroupName, issuedAtMs })`
- `recordBundlePublished({ deviceId, certId, bundleSha256, bundleS3Uri, bundleS3Key, bundlePublishedAtMs })`
- `recordDriftStatus({ deviceId, ok, drift, checkedAtMs, statusUnknownCount })`
- `listDeviceIds()` / `listDeviceCertIds(deviceId)`

> ## 12) mTLS Last Seen（`services/mtlsLastSeenStore.js`）

**目的**：mTLS 接続の最終到達時刻を DynamoDB に記録。

- `recordLastSeen({ deviceId, certId, source })`
- `getLastSeen(deviceId)`

> ## 13) IoT Drift Detector（`services/iotDriftDetector.js`）

**目的**：DynamoDB と IoT の証明書差分を検出。

- `detectDeviceIotDrift(deviceId)`  
  DynamoDB の `lastIssuedCertId` と IoT のアタッチ状況を比較

> ## 14) CloudWatch Logs（`services/cloudwatchLogsWriter.js`）

**目的**：端末ログを CloudWatch Logs に書き込み。

- `writeDeviceJournalLogs({ thingName, events })`
- `DEVICE_ERROR_LOG_GROUP` でロググループ名を指定

## 生成／変更されるもの

- RDS / S3 / DynamoDB を除き、**永続的なファイル変更はありません**。  
- `deviceIpStore` / `deviceMacStore` / `deviceInfoStore` は **再起動で消失**します。
