# cloudSocket（cloud ↔ device）

> ファイル: `sockets/cloudSocket/index.js`  
> 役割: **クラウド側 Socket.IO へのクライアント接続**の初期化と、受信イベントの各サブモジュールへの委譲。接続時/定期的な**端末ローカルIPの再登録**と、**DNSベースのオンライン監視**を行う。

## 目的

クラウド側エンドポイントへ **Socket.IO クライアント**として外向き接続し、受信イベントを端末内の処理へ橋渡しする。

## 役割（index.js 反映）

- `SERVER_URL`（既定: `https://api.xrobotics.jp`）に接続（`path: /socket.io`, `transports: ['websocket']`）。
- **接続時**に `emit('registerDevice', DEVICE_ID)` を送信。
- **接続時/定期的（5sごと）**に `safeRegisterLocalIp(DEVICE_ID)` を呼び出して**ローカルIPを再登録**。
- **オンライン監視**: `dns.resolve('google.com')` により到達可否をチェックし、`[cloudSocket] Network status: online/offline` をログ出力。
- **切断時**: 理由をログ出力（再接続は Socket.IO 既定の挙動）。
- **クリーンアップAPI**: `initCloudSocket()` の戻り値 `{ cleanup }` により、**タイマー停止**と**ソケットクローズ**を一括実行。

## ライフサイクル / 接続

- **接続**  
  - Endpoint: `SERVER_URL`（`/socket.io`）  
  - Transport: `websocket`
- **接続時フロー**
  1. ログ: `[cloudSocket] Connected to cloud server`
  2. `emit('registerDevice', DEVICE_ID)`
  3. `safeRegisterLocalIp(DEVICE_ID)` を実行（成功/失敗をログ）
- **定期タスク（5秒間隔）**
  - `dns.resolve('google.com')` により `isOnline`（内部状態）を更新してログ出力
  - `safeRegisterLocalIp(DEVICE_ID)` を実行（失敗時はエラーログ）
- **切断時**
  - ログ: `[cloudSocket] Disconnected: <reason>`
- **クリーンアップ**
  - `cleanup()` で `setInterval` を停止し、ソケットを `close()`。  
    ログ: `[cloudSocket] Cleanup done`

## サブモジュール登録（イベント受信の委譲）

本モジュールでクラウドソケットを生成し、以下の**イベントハンドラ群**を登録します（詳細なイベント一覧とペイロードは各ファイルで後述）。

- `handleSystemCommands(cloudSocket, ioLocal)`
- `handleSystemCommands2(cloudSocket, ioLocal)`
- `handleDeviceCommands(cloudSocket, ioLocal)`
- `handleMiscCommands(cloudSocket, ioLocal)`
- `handleMediaCommands(cloudSocket, ioLocal)`
- `handleViewCommands(cloudSocket, ioLocal)`
- `handleConfigCommands(cloudSocket, ioLocal)`
- `handlePlaylistCommands(cloudSocket, ioLocal)`

> **注**: `ioLocal` は端末内の Socket.IO サーバインスタンス。クラウドからの指示を端末内へ中継する用途で使用。

## 公開インターフェース（Socket.IO）

- **方向**：デバイス → クラウド（client）
- **このファイルでの送信イベント**

  | 方向 | イベント名        | 例                                   | 説明                       |
  |------|-------------------|--------------------------------------|----------------------------|
  | →    | `registerDevice`  | `registerDevice(DEVICE_ID)`          | 端末をクラウドへ登録       |

> 受信イベントのハンドラは以下のサブモジュールに分割されています。  
> `configCommands.js`, `deviceCommands.js`, `mediaCommands.js`, `miscCommands.js`, `playlistCommands.js`, `systemCommands.js`, `viewCommands.js`  
> （各ファイルの内容に基づき、この表へ**受信イベント**を逐次追記します）

## 設定（Environment Variables）

| Key        | Required | Default                     | Note                                                |
|------------|----------|-----------------------------|-----------------------------------------------------|
| SERVER_URL | yes      | `https://api.xrobotics.jp`  | Socket.IO サーバ（クラウド）エンドポイント          |
| DEVICE_ID  | yes      | —                           | `registerDevice` で送信される端末ID                |

> タイマー間隔は **5秒固定**（現状ENVでのカスタマイズは無し）。

## 依存関係

- 外部: `socket.io-client`, Node.js 標準 `dns`
- ローカル: `../../config`, `../../services/networkRegistration`（`safeRegisterLocalIp` など）
- サブモジュール: `systemCommands`, `systemCommands2`, `deviceCommands`, `miscCommands`, `mediaCommands`, `viewCommands`, `configCommands`, `playlistCommands`

## 失敗時挙動

- **接続失敗/切断**: Socket.IO の自動再接続に準拠（本ファイルでオーバーライド無し）。
- **IP再登録失敗**: 例外を捕捉してエラーログ（リトライは**次の周期（5s後）**に再試行）。
- **DNS失敗**: `isOnline=false` としてログ出力（到達復帰時に自動で `online` に戻る）。

## テスト観点

- 接続成功時に **必ず** `registerDevice(DEVICE_ID)` が送出される。
- 接続時に `safeRegisterLocalIp(DEVICE_ID)` が呼ばれる（成功/失敗のログ含む）。
- 周期タスクが **5秒間隔**で  
  (a) DNS 解決を行い、ログ出力する  
  (b) `safeRegisterLocalIp(DEVICE_ID)` を実行する。
- `handle*Commands` 群が **一度ずつ**登録される（重複登録なし）。
- `cleanup()` 呼び出しで **タイマーが停止**し、**ソケットがクローズ**される。

## 監視/運用メモ

- 5秒ごとにネットワーク状態ログが出るため、**ログローテーション**の設定に留意。
- `google.com` への DNS 解決に依存（ネットワーク到達性の近似指標）。
