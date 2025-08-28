# コンポーネント

リアルタイム連携（Socket.IO）まわりの **端末内コンポーネント**をまとめます。  
現状は **クラウド↔端末ブリッジ** と **端末内（ローカル）ブリッジ** の2系統です。

## **サマリー**

| コンポーネント | 役割 / 概要 | 主な入出力 | ドキュメント |
|---|---|---|---|
| **Cloud Socket** | 端末→クラウドの **Socket.IO クライアント**。接続時に `registerDevice`、5秒ごとに **DNSオンライン監視** & **ローカルIP再登録**。各種イベントを受信して端末内へ橋渡し | 受信（cloud→device）：Device / Config / System / Media / Playlist / View / Misc の各イベント。送信：`registerDevice` / 各種応答 | [`cloud-socket.md`](./cloud-socket.md) |
| **Local Socket** | 端末内の **Socket.IO サーバ（ioLocal）**。`/` と `/admin` NS を運用し、**setVolume / toggleVolume** 等を **ローカル↔クラウド**にブリッジ | 受信：`/admin` or `ioCloud` のイベント。送出：`/`・`/admin`・`ioCloud?` に forward | [`local-socket.md`](./local-socket.md) |

> ## [**クラウドソケット（cloud-socket）**](./cloud-socket.md)

- **接続**：`SERVER_URL`（`/socket.io`、`websocket` 固定）  
- **接続時**：`registerDevice(DEVICE_ID)`、`safeRegisterLocalIp(DEVICE_ID)`  
- **定期（5s）**：`dns.resolve('google.com')` でオンライン監視＋ローカルIP再登録  
- **イベント群**：Device / Config / System / Media / Playlist / View / Misc  
- **クリーンアップ**：`cleanup()` で interval 停止＆ソケット close

> ## [**ローカルソケット（local-socket）**](./local-socket.md)

- **ネームスペース**：`/`（既定）・`/admin`（管理UI）  
- **ブリッジ**：`setVolume` / `toggleVolume` を **forward()** で `/`・`/admin`・`ioCloud?` に多方向配信  
- **クラウド連携**：`ioCloud` があれば同名イベントを受け取りローカルへ中継

!!! note "運用上の注意"
    - **ループ防止**：Cloud と Local で同名イベントを相互転送する場合は、起点フラグやイベント名の分離を検討してください。  
    - **認証/認可**：`/admin` など管理系 NS はトークン等で保護することを推奨します。  
    - **ログ量**：Cloud Socket の 5秒周期ログはローテーション前提で設計してください。
