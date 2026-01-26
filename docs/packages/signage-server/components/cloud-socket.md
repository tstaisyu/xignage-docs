# クラウドソケット（cloud-socket）

本ページは `sockets/cloudSocket/` 配下のファイル群の**仕様を1ページに統合**したものです。  

## 概要

- **役割**：クラウド側エンドポイント（`SERVER_URL`）へ Socket.IO クライアントで接続し、端末指示（ビュー切替/同期/音量/電源など）を**受信→処理→端末内へ橋渡し**する。  
- **接続**: `ioClient(SERVER_URL, { path: '/socket.io', transports: ['websocket'] })`（mTLS 有効時は TLS オプション追加）  
- **接続時**: `registerDevice(DEVICE_ID)` と `safeRegisterLocalIp(DEVICE_ID)`  
- **定期タスク（5s）**: `dns.resolve('google.com')` によるオンライン監視（ログ出力）  
- **クリーンアップ**: `initCloudSocket()` の戻り `{ cleanup }` で interval 停止 & ソケット close

## ライフサイクル / 接続（`index.js`）

1) 接続: `SERVER_URL`（`/socket.io`、transport=`websocket`）  
2) 接続成功 → `registerDevice(DEVICE_ID)` を送出 → `safeRegisterLocalIp(DEVICE_ID)`  
3) `doorbell:startCall` 受信時は `ioLocal` に forward  
4) `net:report` 受信時に IP/MAC 再登録とスナップショットを返す  
5) 切断時 → 理由をログ  
6) 5秒ごとに DNS 解決でオンライン監視  
7) `cleanup()` でタイマー停止＆ソケットクローズ

## サブモジュール登録（イベント受信の委譲）

`initCloudSocket()` 内で以下を登録:

- `handleSystemCommands(cloudSocket, ioLocal)`
- `handleSystemCommands2(cloudSocket, ioLocal)`
- `handleDeviceCommands(cloudSocket, ioLocal)`
- `handleMiscCommands(cloudSocket, ioLocal)`
- `handleViewCommands(cloudSocket, ioLocal)`
- `handleConfigCommands(cloudSocket, ioLocal)`
- `handlePlaylistCommands(cloudSocket, ioLocal)`
- `handleWifiCommands(cloudSocket, ioLocal)`

## イベント早見表（cloud → device／device → cloud / ioLocal）

|グループ|受信イベント|主ペイロード|応答 / 送出|概要|
|---|---|---|---|---|
|**Device**|`getVersions`|`{ requestId }`|`versionsResponse { requestId, serverVersion, uiVersion, farmVersion }`|各パッケージのバージョン|
||`requestDeviceInfo`|`{ requestId }`|`deviceInfoResponse { requestId, info }`|端末情報|
||`getPatchMigState`|`{ requestId }`|`patchMigStateResponse { requestId, state｜error }`|パッチ＋マイグ状態|
|**Config**|`getConfig`|`{ deviceId, requestId }`|`configResponse { deviceId, …settings }`|ローカル設定取得|
||`updateConfig`|`{ deviceId, requestId, ...updates }`|`configUpdated { deviceId, …settings }`|ローカル設定更新|
|**System**|`shutdownCommand`|—|—|電源断|
||`rebootCommand`|—|—|再起動|
||`startUpdate`|任意|—|`systemctl start signage-update.service`|
||`toggleRotation`|任意|—|画面回転トグル|
||`forceKiosk`|—|—|キオスク再起動|
||`deleteAllFiles`|`{ requestId }`|`deleteAllFilesResponse { requestId, success｜error }`|画像/動画配下の全ファイル削除|
|**Playlist**|`startPlaylist`|任意|`ioLocal.emit('startPlaylist', payload)`|ローカルへ開始通知|
||`stopPlaylist`|任意|`ioLocal.emit('stopPlaylist', payload)`|ローカルへ停止通知|
||`syncContentFromCloud`|`{ deviceId? }`|`ioLocal.emit('contentSyncResult', result)`|クラウド正本の同期|
|**View**|`switchView`|`<viewName>`|`ioLocal.emit('switchView', viewName)`|ビュー切替|
||`showImage`|`<imageFileName>`|`ioLocal.emit('showImage', …)` or **保留**→`clientReady` で再送|未接続時はキュー|
||`playVideo`|`<payload>`|`ioLocal.emit('playVideo', …)` or **保留**→`clientReady` で再送|未接続時はキュー|
|**Misc**|`updateText`|`{ text }`|—|`textStore` を更新|
||`setVolume`|`{ volume }`|—|`pactl set-sink-volume`|
||`toggleVolume`|任意|`ioLocal.emit('toggleVolume', payload)`|ローカルへ転送|
|*(local→cloud)*|—|—|`volumeStatusChanged` を cloud / `/admin` に転送|local-bridge|
|**Network**|`net:report`|`ack`|`ack({ ok, snap&#124;error })`|IP/MAC 再登録とスナップショット|
|**Wi-Fi**|`getWifiNetworks`|`{ deviceId, requestId }`|`wifiNetworksResponse { deviceId, current, networks, error? }`|ローカル Wi-Fi 管理 API を呼び出し|
||`deleteWifiNetwork`|`{ deviceId, requestId, ssid }`|`wifiNetworkDeleted { deviceId, ok, ssid, status?, error? }`|SSID 削除（409/404 を分岐）|
|**Doorbell**|`doorbell:startCall`|`{ ... }`|`ioLocal.emit('doorbell:startCall', payload)`|ローカルへ通話開始を通知|

## コマンド詳細

> ### Device（`deviceCommands.js`）

- **`getVersions`** → `versionsResponse`  
  serverVersion：`/opt/signage-core/signage-server/current/package.json`  
  uiVersion：`"0.0.0"`（固定値）  
  farmVersion：`/opt/signage-core/signage-jetson/current/VERSION.txt`

!!! note
    - uiVersion は固定値のため、必要なら取得元を追加してください（根拠: `signage-server/sockets/cloudSocket/deviceCommands.js`）。

> ### Playlist（`playlistCommands.js`）

- `startPlaylist` / `stopPlaylist`：`ioLocal` へ中継  
- `syncContentFromCloud`：`cloudContentSync.syncOnceFromCloud()` を実行し、`contentSyncResult` を `ioLocal` へ送出

!!! note
    - `syncContentFromCloud` は `payload.deviceId` を優先して使います。  
      TODO: `payload.deviceId` 未指定時に `config.DEVICE_ID` を参照する実装だが、当該モジュールで `config` が import されていない（根拠: `signage-server/sockets/cloudSocket/playlistCommands.js`）。

> ### View（`viewCommands.js`）

- `showImage` / `playVideo` は**未接続時に1件だけ保留**し、`clientReady` でフラッシュ  

> ### Network（`index.js`）

- `net:report` 受信時に `safeRegisterLocalIp` / `registerMacAddress` / `getNetworkSnapshot` を実行し、`ack()` で結果を返す

> ### Wi-Fi（`wifiCommands.js`）

- `getWifiNetworks`：`WIFI_MANAGER_URL` へ `GET /api/local/wifi/networks`  
- `deleteWifiNetwork`：`WIFI_MANAGER_URL` へ `DELETE /api/local/wifi/networks/:ssid`  
  `409`（接続中）/`404`（未登録）/その他はエラーとして分岐

## 設定（Environment Variables）

|Key|Required|Default|Note|
|---|---|---|---|
|`SERVER_URL`|yes|`https://device.api.xrobotics.jp`|Cloud Socket.IO エンドポイント（`/socket.io`）|
|`DEVICE_ID`|yes|—|接続時に `registerDevice` で送信|
|`WIFI_PRIORITY_INTERFACES`|no|`wlanUSB,wlanINT,eth0`|IP/MAC 検出の優先IF順|
|`BOARD_TYPE`|no|`raspi` 相当|`setVolume` の sink 推定に使用|
|`WIFI_MANAGER_URL`|no|`http://127.0.0.1:5000`|ローカル Wi-Fi 管理 API のベース URL|
|`MTLS_HOSTS`|no|—|mTLS を強制するホスト一覧（`,` 区切り）|
|`MTLS_CERT_PATH`|no|`/etc/signage/iot-certs/<DEVICE_ID>/cert.pem`|mTLS クライアント証明書|
|`MTLS_KEY_PATH`|no|`/etc/signage/iot-certs/<DEVICE_ID>/private.key`|mTLS 秘密鍵|
|`MTLS_CA_PATH`|no|—|mTLS CA 証明書（任意）|

## 失敗時挙動

- **接続失敗/切断**: Socket.IO の自動再接続に準拠（独自再試行なし）
- **IP再登録失敗**: 例外はログのみ → 次の周期や `net:report` で再試行
- **DNS失敗**: `isOnline=false` としてログ（復帰時に `online` へ）

## 監視/運用メモ

- 5秒周期のログが出るため **ログローテーション**に留意
- **deviceId フィルタ**：`getConfig/updateConfig` は `payload.deviceId === config.DEVICE_ID` のときのみ応答します。**他イベントにも同様のフィルタ導入を検討**（誤配送防止）。
- **危険操作の保護**：`deleteAllFiles` はディレクトリ配下を**全削除**します。**認可/確認**や**ディレクトリ固定**のガードを推奨。
