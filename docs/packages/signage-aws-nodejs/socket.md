# ソケット層（socket）

`socket/*` は **端末（Jetson/Raspberry Pi）とサーバ**の双方向通信を担う層です。  
接続管理（register/disconnect）、ACK 応答のハンドリング、HTTP→Socket ブリッジ（音量トグル）を提供します。

- 参照ソース： `socket/index.js`, `socket/commonRequests.js`, `socket/deviceRegistry.js`, `socket/toggleVolume.js`, `requestStores.js`

## **構成（役割別）**

- **index.js**：`initSocket(server)` で Socket.IO を初期化し、ACK を受ける  
  `thumbnailResponse`／`versionsResponse`／`patchMigStateResponse`／`volumeStatusChanged`
  `getIO()` を公開（サービス層から利用）
- **commonRequests.js**：ACK 共通ハンドラ  
  `handleVersionResponse()`／`handlePatchMigResponse()`／`handleListResponse()`
- **deviceRegistry.js**：デバイス登録・離脱の管理  
  `registerDevice`／`disconnect`、`deviceSockets` マップの更新
- **toggleVolume.js**：HTTP ルートから音量トグルを発火し、ACK（`volumeStatusChanged`）を待つ  
  `setGetIO(fn)` はテスト用の差し替えで利用
- **requestStores.js（ルート）**：共有ストア  
  `deviceSockets` / `requests` / `thumbnailRequests`

> ## **初期化と配線（`socket/index.js`）**

**initSocket(server)**（抜粋仕様）

- `io = new Server(server, { path: '/socket.io', cors: { origin: '*', methods: ['GET','POST'] } })`
- `deviceRegistry.bind(io)` を呼び出し
- `io.on('connection', socket => { ...汎用 ACK をバインド... })`
- `getIO()` をエクスポート（サービス層や HTTP ハンドラから利用）

**汎用 ACK（接続毎にバインド）**

- `thumbnailResponse({ requestId, buffer, error })`  
  → `thumbnailRequests` を解決／タイムアウト解除
- `volumeStatusChanged({ requestId, muted })`  
  → `requests` を解決（`toggleVolume` の応答）
- `versionsResponse(data)` → `handleVersionResponse(data, requests)`
- `patchMigStateResponse(data)` → `handlePatchMigResponse(data, requests)`

!!! warning "CORS/Origin"
    本番環境では `origin: '*'` を適切なドメインに制限してください。

> ## **デバイス登録（`socket/deviceRegistry.js`）**

**イベント**

- `registerDevice(deviceId)`  
  `socket.join(deviceId)`／`deviceSockets.set(deviceId, socket.id)`
- `disconnect(reason)`  
  `deviceSockets` を逆引きして `deviceId` を削除

**ヘルパ**

- `getSocketId(deviceId)`／`isDeviceOnline(deviceId)`

**挙動**

1) デバイスが接続 → `registerDevice` を送信  
2) サーバは `deviceId ⇢ socket.id` を `deviceSockets` に記録  
3) 切断時は該当 `deviceId` のエントリを削除

!!! note "接続ハンドラの重複"
    `deviceRegistry.bind(io)` と `socket/index.js` の双方で `io.on('connection')` を使います。  
    1 接続につき **2 つの connection ハンドラ**が動く点に注意してください。

> ## **バージョン・パッチ状態 ACK（`socket/commonRequests.js`）**

**versionsResponse**

- `data = { requestId, serverVersion, uiVersion, farmVersion, error }`
- 同一 `requestId` の待機者に  
  `{ server, ui, farm }` で解決／`error` なら reject

**patchMigStateResponse**

- `data = { requestId, state, error }`
- 同一 `requestId` の待機者に `{ state }` で解決／`error` なら reject

> ## **サムネ ACK（`thumbnailResponse` in `socket/index.js`）**

- `data = { requestId, buffer, error }`
- `thumbnailRequests` から該当 `requestId` を取得
- タイムアウト解除 → `resolve(buffer)`／`reject(new Error(error))`

> ## **HTTP → Socket ブリッジ（音量トグル：`socket/toggleVolume.js`）**

**エクスポート**

- `setGetIO(fn)`：テストで `getIO` を差し替えるためのフック  
- `toggleVolumeHandler(req, res)`：`POST /api/commands/send` から呼ばれる

**挙動**

1) `deviceId` を検証 → `deviceSockets` から `sockId` を取得  
2) `getIO()` で `sock` を取り出し、`requestId = uuidv4()` を生成  
3) `requests.set(requestId, { resolveFn, rejectFn, timeout })` を登録（10s）  
4) `sock.emit('toggleVolume', { requestId })` を送信  
5) `index.js` の `volumeStatusChanged({ requestId, muted })` で一致したら  
   `clearTimeout` → `requests.delete(requestId)` → `res.json({ muted })`

> ## **共有ストア（`requestStores.js`）**

- `deviceSockets = new Map()`  
  **Key**: `deviceId`（文字列）  
  **Value**: `socket.id`（文字列）  
  接続／切断時に `deviceRegistry` が更新
- `requests = new Map()`  
  **Key**: `requestId`（UUID）  
  **Value**: 呼び出し元により `{ resolve, reject, timeout }` や  
  `{ resolveFn, rejectFn, timeout }` などの形を取る  
  （versions/patchMig/toggleVolume などの待機に使用）
- `thumbnailRequests = new Map()`  
  **Key**: `requestId`（UUID）  
  **Value**: `{ resolve, reject, timeout }`  
  サムネイル用（`buffer` を受け取る）

!!! warning "後始末（必須）"
    いずれの Map も **resolve/reject 時に `clearTimeout` と `delete` を必ず実施**してください。  
    リスナも同様に**解除**しないとメモリリークの原因になります。

## **生成／変更されるもの**

- 生成：**メモリ上の Map**（`deviceSockets`, `requests`, `thumbnailRequests`）のみ  
- 恒久的ファイル・永続設定の変更はありません

## **注意**

!!! tip "相関の原則"
    すべての往復で **`requestId` を発行し、ACK 側で同一性を検証**します。

!!! warning "並列処理"
    同じイベントを並列に投げる場合でも、**requestId 単位で待機者を分離**してください。

!!! note "Origin 制限"
    本番では `cors.origin` を厳格に。`/socket.io` パスも変更を検討できます。
