# JS モジュール（public/js）

> ## **main.js**

`kiosk.html` 上での再生中枢。DOM 要素（画像/動画/黒フェード）と `PlaylistPlayer` を束ね、  
ローカル Socket.IO からの各種イベント（再生・音量・ビュー切替・割り込み）を処理します。  
初期プレイリスト取得・30秒ごとの更新・`clientReady` 送信も担います。

### **依存 / 要素**

- **DOM**：`#displayImage`（img）, `#playVideo`（video）, `#blackScreen`（div）
- **クラス**：`PlaylistPlayer`（`playlistPlayer.js`）
- **通信**：`window.io()`（ローカル Socket.IO）
- **HTTP**：`/api/config`（`autoPlaylist` 判定）, **`/localPlaylist`**（プレイリスト取得）
- **静的配信**：`/images/<file>`, `/videos/<file>`

### **内部状態・タイマー**

- `isSingleMode`（単体動画ループ再生モード）
- `autoPlaylist`（`/api/config` 由来）
- **30秒間隔**：`fetchPlaylistFromLocal()` でプレイリスト再取得→`player.setPlaylist()`

### **ソケット受信イベント**

- `toggleVolume(payload)` → `toggleVolume(payload)`（video.muted トグル、同期応答は `payload.requestId` で `volumeStatusChanged` 送信）
- `setVolume({ volume })` → `setVolume(volume)`（0–1 または `"75%"`）
- `showImage(imageFileName)` → **単発表示**（動画停止・画像表示）
- `playVideo(payload)`  
  文字列なら単体動画ループ（`playSingleVideo(name)`）  
  オブジェクト `{ fileName, isSingle }` で `isSingle`=true のとき単体動画ループ
- `switchView(tv)`  
  **ローカル遷移**：`'kiosk'` → `'/kiosk'`（拡張子なし）
- `doorbell:startCall` → `sessionStorage.doorbellCall` を保存し `/videocall.html` へ遷移
- **プレイリスト制御**：`startPlaylist`（`isSingleMode=false; player.start()`）、`stopPlaylist`（`player.stop()`）
- 割り込み：`interruptPlay({ fileName, isVideo, duration })` → `player.interrupt(...)`、`endInterrupt` → `player.resume()`

### **関数/API**

- `fetchPlaylistFromLocal()` → `GET /localPlaylist` → `{records}` を `[ {file,type,duration,order} ]` へ正規化
- `showImage(imageFileName, duration=10)` → 画像のプリロード後に表示
- `playSingleVideo(videoFileName)` → 単体ループ、`player.stop()` 後に video 再生
- `toggleVolume(payload)` / `setVolume(vol)` → video 要素の音量・mute を制御

### **処理の流れ（初期化 IIFE）**

1) `/api/config` 取得 → `autoPlaylist` 判定  
2) `/localPlaylist` 取得 → `player.setPlaylist()` → `autoPlaylist` なら `player.start()`  
3) Socket 接続・各イベント購読  
4) `socket.emit('clientReady')`

!!! note
    - **`showImage` の `this`**：関数内で `this.isStopped/this.nextItem()` を参照していますが、`PlaylistPlayer` の `this` とは無関係（`this` は暗黙に `window`）。  
      TODO: 既存の動作意図（プレイリスト復帰の要否）を確認（根拠: `signage-server/public/js/main.js`）。

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

**ローカル UI ページ** で `switchView` を受け取り、**ローカル遷移**（`'kiosk'`→`'/kiosk'`）します。

### **公開関数**

- `setupSwitchView(socket)`：`socket.on('switchView', handler)` を登録。  
  受信値を `trim()` → `https://meet.jit.si/` 始まりなら外部へ、そうでなければ `/' + targetView`
