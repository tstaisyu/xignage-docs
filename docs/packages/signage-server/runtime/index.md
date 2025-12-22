# Runtime / Bootstrap（概要）

- 対象ファイル: `server.js`  
- 役割: プロセス起動時の**初期化シーケンス**（回転適用 → HTTP/Socket.IO 立ち上げ → クラウド/ローカルソケット初期化 → 端末情報/IP/MAC 登録 → 監視ハンドラ設定）

## **起動シーケンス（server.js）**

1) **画面回転の適用**  
   `applyStartupRotation()`（`services/rotationManager`）

2) **致命エラー監視を登録**  
   `process.on('uncaughtException')` / `process.on('unhandledRejection')`

3) **HTTP サーバ生成**  
   `http.createServer(app)`（`app` は Express アプリ）

4) **Socket.IO（ローカル）初期化**  
   `const ioLocal = socketIo(server, { cors: { origin: '*', methods: ['GET','POST'] } })`

5) **ソケット層の起動**  
   **クラウド接続**: `initCloudSocket(ioLocal)`  
   **ローカル橋渡し**: `initLocalSocket(ioLocal)`

6) **待受開始**  
   `server.listen(config.SERVER_PORT, '0.0.0.0', async () => { ... })`

7) **登録処理（待受開始後）**  
   `registerLocalIp(config.DEVICE_ID)`  
   `registerMacAddress(config.DEVICE_ID)`  
   `registerDeviceInfo(config.DEVICE_ID)`  
   `startNetworkReporter(config.DEVICE_ID)`

## **ログ/監視**

- 起動完了時: `Server listening on port <PORT>`
- 例外系: `[ERROR] Uncaught Exception`, `[ERROR] Unhandled Rejection`

## **依存関係**

- `./app`（Express アプリ本体）  
- `./sockets/cloudSocket`（クラウドブリッジ） / `./sockets/localSocket`（ローカルブリッジ）  
- `./services/networkRegistration`（IP/MAC 登録） / `./services/deviceInfoRegistration`（端末情報登録）  
- `./services/rotationManager`（起動時回転）
