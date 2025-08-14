# cloudSocket（cloud ↔ device）

## 目的

クラウド側エンドポイントへ **Socket.IO クライアント**として外向き接続し、受信イベントを端末内の処理へ橋渡しする。

## 役割

- `SERVER_URL`（既定: `https://api.xrobotics.jp`）に接続（`path: /socket.io`, `transports: ['websocket']`）。
- 接続時に `registerDevice(DEVICE_ID)` を送信し、ローカルIP再登録を実行。
- 切断理由をログ出力（再接続は Socket.IO 既定の挙動）。

## 公開インターフェース（Socket.IO）

- **方向**：デバイス → クラウド（client）
- **接続**：
  - Endpoint: `SERVER_URL`（`/socket.io`）
  - Transport: `websocket`
- **接続時**：
  - `emit('registerDevice', DEVICE_ID)`
  - ローカルIP再登録（成功/失敗をログ）
- **切断時**：
  - 理由をログ（必要に応じて上位で監視）

> 受信イベントのハンドラは以下のサブモジュールに分割されています（後で各イベントの列挙/例を追記）  
> `configCommands.js`, `deviceCommands.js`, `mediaCommands.js`, `miscCommands.js`, `playlistCommands.js`, `systemCommands.js`, `viewCommands.js`

## 設定（Environment Variables）

| Key        | Required | Default                  | Note                                     |
|------------|----------|--------------------------|------------------------------------------|
| SERVER_URL | yes      | `https://api.xrobotics.jp` | Socket.IO サーバ（クラウド）エンドポイント |
| DEVICE_ID  | yes      | —                        | `registerDevice` で送信される端末ID       |

## 依存関係

- `socket.io-client`
- （接続時のローカルIP登録で）ネットワーク登録ロジックに依存

## 失敗時挙動

- 接続失敗/切断時は Socket.IO の自動再接続に準拠（本実装で明示オーバーライドは未確認）

## テスト観点

- 接続成功時に `registerDevice` が確実に送出されること
- 接続時のローカルIP再登録が実行されること（成功/失敗ハンドリング）
- 受信イベントのルーティング（各 *Commands.js へ）の結合確認

## 変更履歴

- リポジトリのリリースノート/タグを参照
