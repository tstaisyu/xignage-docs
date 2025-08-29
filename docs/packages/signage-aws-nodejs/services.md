# サービス (services)

このページは、`signage-aws-nodejs` の **サービス層**（HTTP ルート／Socket 層の橋渡し）を 1 ページで俯瞰します。  
対象：`services/*` 配下（Command / DeviceSettings / Playlist / File Download / Socket Helper）

!!! note
    ここでは **設計骨子と I/F 仕様**に集中します。実装詳細は各ソースを参照。

## **共通方針・前提**

### **ソケット取得とデバイス識別**

- 端末ごとの接続は **`deviceSockets: Map<deviceId, socketId>`** で管理（定義元は Socket 層）。
- Socket.IO サーバは **`getIO()`** から取得。`io.sockets.sockets.get(socketId)` で実体へ。
- デバイス未接続／Socket 不明は **404** を返す（もしくは `status` を付与して throw）。

### **ACK 付きイベント送受（相関 ID）**

- `emitWithAck(socketId, event, payload, ackEvent, timeoutMs)` を使用。
- **相関 ID** は `payload.requestId` と ACK 側 `res.requestId` の**一致**で判断。
- タイムアウトは用途別（例：設定 1s、プレイリスト 5s）。

### **エラー／タイムアウトの扱い**

- **HTTP レイヤ**から呼ばれるサービスは、`status` を持つ Error を**上位で適切に変換**。
- **タイムアウト**は原則 **504** 相当（`error.status = 504` を付与）。

!!! warning "依存（抜粋）"
    - `getIO()`, `deviceSockets` は Socket 層の責務。サービスでは**存在前提**で使用。
    - 外部 HTTP 取得（`downloadService`）はネットワーク障害に依存するため**再試行方針**は上位で検討。

> ## **1) Command（emitCommand / validators）**

### **emitCommand（`services/command/emitCommand.js`）**

**目的**：デバイスへ単発イベントを **ACK なし**で送信。

**I/F**  

- 入力: `deviceId`, `eventName`, `payload`, `res(Express Response)`
- 出力: `200 { ok: true, message }`
- 失敗:
  `400` … `deviceId` 未指定
  `404` … デバイス未接続 / Socket 実体なし

**フロー**  

1) `deviceId` → `socketId` 解決（`deviceSockets`）

2) `getIO()` → `sock` 取得

3) `sock.emit(eventName, payload)`

4) 送信結果を JSON で返却

!!! note
    - UI 側が ACK を返さない制御系に向く。到達性保証が必要な場合は `emitWithAck` を検討。

### **validators（`services/command/validators.js`）**

**目的**：コマンド用クエリの**入力検証**（`Joi`）

**スキーマ（抜粋）**  

- `deviceId: string(required)`
- `command: enum('playVideo','showImage','switchView','switchViewYT')(required)`
- `fileName: string(optional, allow(''))`
- `isSingle: boolean(optional)`（`truthy('true')` / `falsy('false')` サポート）

**方針**  

- ルート層での事前検証により、サービス層を**単純化**。

> ## **2) DeviceSettings Service（`services/deviceSettingsService.js`）**

**目的**：端末側の自動再生設定など **設定取得/更新** を ACK 付きイベントで行う。

**定数**  

- `ACK_GET = 'configResponse'`
- `ACK_UPDATE = 'configUpdated'`
- `TIMEOUT_MS = 1000`（1 秒）

**内部**  

- `ensureSocket(deviceId)`：接続検証。未初期化 / 未接続 / 実体なしは `status` 付きで throw。

**API**  

- `get(deviceId) -> { autoPlaylist: boolean }`  
  送信: `event='getConfig'`, `payload={ deviceId, requestId }`, `ack='configResponse'`  
  タイムアウト時は `status=504` を付与して再 throw。
- `update(deviceId, updates) -> { autoPlaylist: boolean }`  
  送信: `event='updateConfig'`, `payload={ deviceId, ...updates, requestId }`, `ack='configUpdated'`  
  タイムアウト時は同上。

**戻り値（正規化）**  

- `autoPlaylist` は **二値化（`!!`）**して返却。

> ## **3) Playlist Service（`services/playlistService.js`）**

**目的**：プレイリストの取得・更新・削除・サムネ取得など。

**共通**  

- `DEFAULT_TIMEOUT = 5000`（5 秒）
- `ensureSocket(deviceId)`：`deviceSockets` のみで最小限検証（未接続は Error）

**API**  

1) `fetchPlaylist(deviceId) -> playlist`  
   送信: `event='updatePlaylist'`, `payload={ requestId, action:'list' }`  
   ACK: `'playlistUpdateResponse'`

2) `updateItem(deviceId, payload) -> updatedPlaylist`  
    送信: `event='updatePlaylist'`, `payload={ requestId, ...payload }`  
    ACK: `'playlistUpdateResponse'`

3) `modifyItem(deviceId, payload) -> updatedPlaylist`  
   機能同上（汎用更新ラッパ）

4) `removeItem(deviceId, uuid)`  
   `modifyItem(deviceId, { action:'remove', uuid })`

5) `fetchThumbnail(deviceId, eventName, thumbFile) -> buffer`  
   送信: `event=eventName`, `payload={ requestId, fileName: thumbFile }`  
   ACK: `'thumbnailResponse'`

6) `clearFile(deviceId, playlistName) -> result`  
   送信: `event='clearPlaylistFile'`, `payload={ requestId, playlistName }`  
   ACK: `'playlistUpdateResponse'`

!!! note
    - ACK 応答に含まれるフィールド名（`playlist`, `updatedPlaylist`, `buffer`, `result`）は **UI 実装と厳密一致**が必要。

> ## **4) File Download Service（`services/file/downloadService.js`）**

**目的**：外部 URL のファイルを **Buffer** 取得。

**API**  

- `fetchFileBuffer(fileUrl) -> Buffer`
  実装：`axios.get(fileUrl, { responseType:'arraybuffer' })` → `Buffer.from(data)`

!!! note
    - ネットワーク障害・サイズ制限は**上位**（呼び出し元）で対処。  
    - セキュリティ（許可ドメイン／拡張子／サイズ上限）は**事前バリデーション**推奨。

> ## **5) Socket Helper（`services/socket/emitWithAck.js`）**

**目的**：**ACK 付きイベント**送信の共通ユーティリティ。

**I/F**  

```js
emitWithAck(socketId, event, payload, ackEvent = event, timeoutMs = 5000) -> Promise<ackRes>
```

**挙動**  

1) `getIO()` → `sock` 取得（無ければ `Error('No socket id=...')`）

2) `ackEvent` に対して **一時的なリスナ**を登録

3) `setTimeout` で `timeoutMs` 経過時に **リスナ解除→reject**

4) 受信 `res` の `requestId` が `payload.requestId` と一致 → **リスナ解除→resolve**

5) 常に `sock.emit(event, payload)` を最終行で送出

**設計意図**  

- **相関 ID** により、同種イベントの同時多発でも**誤配**を防止。
- リスナの**確実な解除**でメモリリーク・多重ハンドラを回避。

## **生成／変更されるもの**

- 本ページで記載のサービスは **恒常的なファイル生成や OS 設定変更を行いません**。  
- 生成物（サムネイル等）は **端末側**の責務です。

## **注意（運用上のポイント）**

!!! tip "ACK 使い分け"
    到達性・同期待ちが不要な UI 操作は **`emitCommand`（ACK 無し）**、  
    一貫性が重要な設定・同期は **`emitWithAck`（ACK あり）** を利用。

!!! warning "タイムアウトと再試行"
    タイムアウト（504）時に**無闇な自動再試行**は、UI 側の**重複処理**を招く可能性。  
    クリティカルな操作は **冪等性**を確保し、再送戦略を設計してください。

!!! note "依存の明示"
    `getIO()` と `deviceSockets` の実装は **Socket 層**。本ページでは前提として扱います。
