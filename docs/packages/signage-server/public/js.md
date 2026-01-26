# JS モジュール（public/js）

> ## **app/bootstrap.js**

`kiosk.html` の初期化エントリ。DOM（画像/動画/黒フェード/オーバーレイ）と
`PlaylistPlayer` / `PlaylistController` / `OverlayManager` を束ね、
ローカル Socket.IO からの各種イベント（再生・音量・ビュー切替・通話）を処理します。
初期プレイリスト取得・30秒ごとの更新・`clientReady` 送信も担います。

### **依存 / 要素**

- **DOM**：`#displayImage`（img）, `#playVideo`（video）, `#blackScreen`（div）, `#overlayRoot`
- **クラス**：`PlaylistPlayer`（`playlistPlayer.js`）, `PlaylistController`（`app/playlistController.js`）
- **通信**：`window.io()`（ローカル Socket.IO）
- **HTTP**：`/api/config`（`autoPlaylist` 判定）, **`/localPlaylist`**（プレイリスト取得）
- **静的配信**：`/images/<file>`, `/videos/<file>`

### **内部状態・タイマー**

- `autoPlaylist`（`/api/config` 由来）
- `isSingleMode`（`PlaylistController` 内）
- **30秒間隔**：`PlaylistController.startAutoRefresh()` が `/localPlaylist` を再取得

### **ソケット受信イベント**

- `toggleVolume(payload)` → video.muted トグル、`payload.requestId` があれば `volumeStatusChanged` を返信
- `setVolume({ volume })` → 0–1 または `"75%"`
- `showImage(imageFileName)` → 単発表示（画像を表示 → duration 後に次へ）
- `playVideo(payload)`  
  文字列なら単体動画ループ（`playSingleVideo(name)`）  
  オブジェクト `{ fileName, isSingle }` で `isSingle`=true のとき単体動画ループ
- `switchView(tv)`  
  `welcome`/`kiosk` はオーバーレイ切替、`https://meet.jit.si/` は外部遷移、それ以外は `/' + targetView`
- `doorbell:startCall` → `sessionStorage.doorbellCall` を保存し **通話オーバーレイ**を開く
- **プレイリスト制御**：`startPlaylist`（`isSingleMode=false; start()`）、`stopPlaylist`（`stop()`）
- 割り込み：`interruptPlay({ fileName, isVideo, duration })` → `player.interrupt(...)`、`endInterrupt` → `player.resume()`

### **処理の流れ（initKiosk）**

1) `/api/config` 取得 → `autoPlaylist` 判定  
2) `/localPlaylist` 取得 → `player.setPlaylist()` → `autoPlaylist` なら `playlistController.start()`  
3) Socket 接続・各イベント購読  
4) `socket.emit('clientReady')`  
5) `callId/joinUrlDevice` パラメータがあれば通話オーバーレイを開く

---

> ## **playlistPlayer.js**

画像/動画のプレイリスト再生エンジン。  
黒フェード（オーバーレイ）により **フェードイン/アウト**、動画終了/経過時間で **次項目へ遷移**、割り込み再生（画像/動画）→**復帰**を担います。

### **公開クラス / 関数**

- **`class PlaylistPlayer(imgEl, videoEl, blackEl)`**
  - プロパティ：`playlist`, `currentIndex`, `isInterrupted`, `isStopped`, `timeoutId`
  - video `ended` 時：自動で `nextItem()`
- `setPlaylist(newPlaylist)`：差分判定で未変更なら現状維持。変更時は **同一アイテムが残れば位置維持**
- `start({ resetIndex=true }={})`：開始。空なら何もしない。
- `stop()`：停止して **黒フェード解除**＋メディア非表示。
- `playNextItem()`：`fadeBlack(1)`→`hideMedia()`→`item` 再生→`fadeBlack(0)`
- `nextItem()`：インデックス更新（末尾で 0 へループ）→ `playNextItem()`
- `hideMedia()` / `hideAll()`：メディア停止/非表示・黒を戻す
- `playVideo(fileName)`：`/videos/<file>` を非ループで再生
- `showImage(fileName, duration)`：`/images/<file>` を表示し `duration` 秒後に `nextItem()`
- `interrupt(fileName, isVideo=false, duration=5)`：割り込み表示（停止→画像/動画）
- `resume()`：割り込み解除→`playNextItem()`

---

> ## **switchViewHandler.js**

**ローカル UI ページ** で `switchView` を受け取り、**ローカル遷移**します。

### **公開関数**

- `setupSwitchView(socket)`：`socket.on('switchView', handler)` を登録。  
  受信値を `trim()` して `/' + targetView` へ遷移

---

> ## **app/playlistController.js**

`PlaylistPlayer` をラップし、プレイリスト取得と定期更新（既定 30s）を行います。

- `loadInitialPlaylist()`：`/localPlaylist` を取得し `player.setPlaylist()`  
- `startAutoRefresh()`：`refreshIntervalMs` ごとに更新（`isSingleMode` のときはスキップ）
- `setSingleMode(enabled)`：単体再生中は自動更新を止める

---

> ## **app/overlayManager.js**

オーバーレイ要素の登録・表示を管理します（welcome/call など）。

- `register(name, element)`：`overlayRoot` に登録し必要なら append  
- `show(name)` / `hide(name)`：表示切替

---

> ## **app/callOverlay.js**

ドアベル通話の iframe を管理します。

- `open(payload)`：`joinUrlDevice` または `callId` から URL を生成し表示  
- `close()`：iframe をクリアして非表示  
- 既定のベース URL：`https://xrobotics.daily.co`

---

> ## **app/eventBus.js**

最小イベントバス（`on/off/emit`）です。`call:open` / `call:close` の内部通知に利用します。
