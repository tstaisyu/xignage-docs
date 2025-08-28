# クラウドソケット（cloud-socket）

本ページは `sockets/cloudSocket/` 配下のファイル群の**仕様を1ページに統合**したものです。  

## **概要**

- **役割**：クラウド側エンドポイント（`SERVER_URL`）へ Socket.IO クライアントで接続し、画像/動画/プレイリスト/設定/システム操作などのイベントを**受信→処理→応答**し、端末内の処理へ橋渡しする。ローカル Socket.IO（`ioLocal`）への**ブリッジ**も担う。

- **接続**: `ioClient(SERVER_URL, { path: '/socket.io', transports: ['websocket'] })`

- **接続時**:
  `emit('registerDevice', DEVICE_ID)`
  `safeRegisterLocalIp(DEVICE_ID)` を実行

- **定期タスク（5s）**:
  **DNSベースのオンライン監視**: `dns.resolve('google.com')` で `isOnline` を更新
  **端末ローカルIPの再登録**: `safeRegisterLocalIp(DEVICE_ID)` を再実行

- **クリーンアップ**: `initCloudSocket()` の戻り `{ cleanup }` で interval 停止 & ソケット close

## **ライフサイクル / 接続（`index.js` 反映）**

1) 接続: `SERVER_URL`（`/socket.io`、transport=`websocket`）  

2) 接続成功 → ログ出力 → `registerDevice(DEVICE_ID)` 送出 → `safeRegisterLocalIp(DEVICE_ID)`  

3) 切断時 → 理由をログ  

4) ハンドラ登録

5) オンライン監視： 5秒ごとに DNS 解決＆ローカルIP再登録  

6) `cleanup()` で **タイマー停止**＆**ソケットクローズ**

## **サブモジュール登録（イベント受信の委譲）**

`initCloudSocket()` 内で以下を登録（実装は各ファイル）:

- `handleSystemCommands(cloudSocket, ioLocal)`
- `handleSystemCommands2(cloudSocket, ioLocal)`
- `handleDeviceCommands(cloudSocket, ioLocal)`
- `handleMiscCommands(cloudSocket, ioLocal)`
- `handleMediaCommands(cloudSocket, ioLocal)`
- `handleViewCommands(cloudSocket, ioLocal)`
- `handleConfigCommands(cloudSocket, ioLocal)`
- `handlePlaylistCommands(cloudSocket, ioLocal)`

> `ioLocal` は端末内の Socket.IO（ブラウザ等）へ中継するためのローカルサーバ。

## **イベント早見表（cloud → device／device → cloud / ioLocal）**

| グループ | 受信イベント | 主ペイロード | 応答 / 送出 | 概要 |
|---|---|---|---|---|
| **Device** | `getVersions` | `{ requestId }` | `versionsResponse { requestId, serverVersion, uiVersion, farmVersion }` | バージョン取得（pkg.json/VERSION.txt） |
|  | `requestDeviceInfo` | `{ requestId }` | `deviceInfoResponse { requestId, info }` | 端末情報（model/OS/kernel/GPU/時刻/NTP…） |
|  | `getPatchMigState` | `{ requestId }` | `patchMigStateResponse { requestId, state｜error }` | パッチ＋マイグ状態（`getCombinedState`） |
| **Config** | `getConfig` | `{ deviceId }` | `configResponse { deviceId, …settings }` | ローカル設定取得（deviceId一致時） |
|  | `updateConfig` | `{ deviceId, ...updates }` | `configUpdated { deviceId, …settings }` | ローカル設定更新（マージ保存） |
| **System** | `shutdownCommand` | — | — | 電源断 |
|  | `rebootCommand` | — | — | 再起動 |
|  | `startUpdate` | 任意 | — | `systemctl start signage-update.service` |
|  | `networkResetCommand` | 任意 | — | wpa_cli 全削除 → 再起動 |
|  | `toggleRotation` | 任意 | — | 画面回転トグル（jetson/xrandr） |
|  | `forceKiosk` | — | — | キオスク再起動（外部実装前提） |
|  | `deleteAllFiles` | `{ requestId }` | `deleteAllFilesResponse { requestId, success｜error }` | 画像/動画配下の全ファイル削除 |
| **Media: Images** | `getImageList` | `{ requestId, deviceId? }` | `imageListResponse { requestId, records[] }` | 必要サムネを自動生成→返却 |
|  | `getImageThumbnail` | `{ requestId, fileName }` | `thumbnailResponse { requestId, buffer｜error }` | サムネバイナリ送出 |
|  | `uploadImage` | `{ requestId, fileName, fileData }` | `uploadImageResponse { requestId, success｜error }` | 画像を保存 |
|  | `deleteImage` | `{ requestId, fileName }` | `deleteImageResponse { requestId, success｜error }` | 画像削除 |
| **Media: Videos** | `getVideoList` | `{ requestId, deviceId? }` | `videoListResponse { requestId, records[] }` | 必要サムネ生成→返却 |
|  | `getVideoThumbnail` | `{ requestId, fileName }` | `thumbnailResponse { requestId, buffer｜error }` | サムネバイナリ送出 |
|  | `uploadVideo` | `{ requestId, fileName, fileData }` | `uploadVideoResponse { requestId, success｜error }` | 動画を保存 |
|  | `deleteVideo` | `{ requestId, fileName }` | `deleteVideoResponse { requestId, success｜error }` | 動画削除 |
| **Playlist** | `startPlaylist` | 任意 | `ioLocal.emit('startPlaylist', payload)` | ローカルへ開始通知 |
|  | `stopPlaylist` | 任意 | `ioLocal.emit('stopPlaylist', payload)` | ローカルへ停止通知 |
|  | `updatePlaylist` | `{ requestId, action, uuid?, contentId?, targetIndex?, duration? }` | `playlistUpdateResponse { requestId, playlist }` | list/add/insert/move/remove |
|  | `clearPlaylistFile` | `{ requestId, playlistName }` | `playlistUpdateResponse { requestId, success }` | `PLAYLISTS_DIR/<name>.json` を削除 |
| **View** | `switchView` | `<viewName>` | `ioLocal.emit('switchView', viewName)` | ビュー切替 |
|  | `showImage` | `<imageFileName>` | `ioLocal.emit('showImage', …)` or **保留**→`clientReady`で再送 | 未接続時はキュー |
|  | `playVideo` | `<payload>` | `ioLocal.emit('playVideo', …)` or **保留**→`clientReady`で再送 | 未接続時はキュー |
|  | `playYoutube` | `{ youtubeUrl? , playlistId? }` | `ioLocal.emit('playYoutubeLocal', { youtubeUrl })` | 最終URLを決定して送出 |
| **Misc** | `updateText` | `{ text }` | — | `textStore` を更新 |
|  | `setVolume` | `{ volume }` | — | `pactl set-sink-volume <sink> <volume>` |
|  | `toggleVolume` | 任意 | `ioLocal.emit('toggleVolume', payload)` | ローカルへ転送 |
| *(local→cloud)* | — | — | `volumeStatusChanged` を cloud / `/admin` に転送 | local-bridge |

## **コマンド詳細**

> ### **Device（`deviceCommands.js`）**

- **`getVersions`** → `versionsResponse`  
  serverVersion：`/opt/signage-core/signage-server/current/package.json`  
  uiVersion：`/var/www/admin-ui/VERSION.txt`  
  farmVersion：`/opt/signage-core/signage-jetson/current/VERSION.txt`

- **`requestDeviceInfo`** → `deviceInfoResponse`（`getDeviceInfo()`）

- **`getPatchMigState`** → `patchMigStateResponse`（`getCombinedState({ patchFile, migrationDir, doneDir })`）

> ### **Config（`configCommands.js`）**

- **`getConfig`**（deviceId一致のみ応答）→ `configResponse`（`loadSettings()`）  

- **`updateConfig`**（deviceId一致のみ保存）→ `configUpdated`（保存後に再読込で返す）

> ### **System（`systemCommands.js` / `systemCommands2`）**

- `shutdownCommand` → `execShutdown()`、`rebootCommand` → `execReboot()`  

- `startUpdate` → `runUpdate()`  

- `networkResetCommand` → `clearWifiConfAndReboot()`  

- `toggleRotation` → `toggleRotation()`  

- `forceKiosk` → **外部関数依存**（実装側で提供）  

- `deleteAllFiles` → 画像/動画ディレクトリ配下の**全ファイル削除** → `deleteAllFilesResponse`

> ### **Media（`mediaCommands.js`）**

- 画像：`getImageList` / `getImageThumbnail` / `uploadImage` / `deleteImage`  

- 動画：`getVideoList` / `getVideoThumbnail` / `uploadVideo` / `deleteVideo`  
  一覧時は **必要サムネを自動生成** → `records` を返す  
  サムネ応答は **バイナリ（Buffer）** を `thumbnailResponse` で送出

> ### **Playlist（`playlistCommands.js`）**

- `startPlaylist` / `stopPlaylist`：`ioLocal` へ中継  

- `updatePlaylist`：`action` に応じ **list/add/insert/move/remove** を実行し、`playlistUpdateResponse`  

- `clearPlaylistFile`：`PLAYLISTS_DIR/<name>.json` を削除し `playlistUpdateResponse { success }`

> ### **View（`viewCommands.js`）**

- `switchView`：`ioLocal.emit('switchView', viewName)`  

- `showImage` / `playVideo`：**ローカル接続が無ければキュー**し、`clientReady` でフラッシュ  

- `playYoutube`：`youtubeUrl` or `playlistId` から最終 URL を決定して `playYoutubeLocal` へ送出

> ### **Misc（`miscCommands.js`）**

- `updateText`：`textStore` を更新  

- `setVolume`：`BOARD_TYPE` から sink 名を推定し `pactl set-sink-volume` を実行  

- `toggleVolume`：`ioLocal` に転送  

- ローカルの `volumeStatusChanged` を cloud / `/admin` に **双方向ブリッジ**

## **公開インターフェース（送信：device → cloud）**

- `registerDevice(DEVICE_ID)`（接続時）

> 受信イベントの詳細は上記早見表と各サブモジュール節を参照。

## **設定（Environment Variables）**

| Key | Required | Default | Note |
|---|---|---|---|
| `SERVER_URL` | yes | `https://api.xrobotics.jp` | Cloud Socket.IO エンドポイント（`/socket.io`） |
| `DEVICE_ID` | yes | — | 接続時に `registerDevice` で送信 |
| `WIFI_PRIORITY_INTERFACES` | no | `wlP1p1s0,wlanUSB,wlanINT` | IP/MAC 検出の優先IF順（networkRegistration） |

## **失敗時挙動**

- **接続失敗/切断**: Socket.IO の自動再接続に準拠（独自再試行なし）
- **IP再登録失敗**: 例外はログのみ → 次の周期（5s後）に再試行
- **DNS失敗**: `isOnline=false` としてログ（復帰時に `online` へ）

## **監視/運用メモ**

- 5秒周期のログが出るため **ログローテーション**に留意
- **deviceId フィルタ**：`getConfig/updateConfig` は `payload.deviceId === config.DEVICE_ID` のときのみ応答します。**他イベントにも同様のフィルタ導入を検討**（誤配送防止）。  
- **大きなサムネイル**：`thumbnailResponse` は Buffer をそのまま送るため、帯域/メモリに注意。必要なら**サムネ最大サイズ/レート制御**を導入。  
- **オンライン判定**：`dns.resolve('google.com')` は環境依存（DNS だけ OK のケースも）。HTTP HEAD など**実トラフィック**で再検討の余地あり。
- **危険操作の保護**：`deleteAllFiles` はディレクトリ配下を**全削除**します。**認可/確認**や**ディレクトリ固定**のガードを推奨。  

!!! note "命名・依存の整合性に注意"
    - `deviceCommands.getPatchMigState` 内で `PATCH_FILE/MIGR_DIR/DONE_DIR` を参照していますが、**`config.PATCH_FILE` 等を使うのが安全**です（環境変数と実体の不整合を防止）。
    - `playlistCommands.deletePlaylistFile` は `config.PLAYLISTS_DIR` を参照します。**`config/index.js` に定義が無い場合は追加**してください（例：`PLAYLISTS_DIR = path.join(HOME_DIR, 'playlists')`）。
