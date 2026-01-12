# フロントページ（HTML 一覧）

各ページが受け取る Socket イベントのうち、**`switchView` を除く詳細ロジック**は読み込まれる JS 側の実装に依存します。

## 一覧表（要約）

| ファイル | 目的/用途 | 読み込むスクリプト | ソケット処理 | ナビゲーション/タイマー | クエリパラメータ | 補足 |
| --- | --- | --- | --- | --- | --- | --- |
| `kiosk.html` | メイン再生ビュー | `/socket.io/socket.io.js`, **`/js/playlistPlayer.js`**, **`/js/main.js`** | `main.js` が Socket を処理 | なし | なし | `#displayImage` `#playVideo` `#blackScreen` |
| `welcome.html` | 起動直後のウェルカム | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` | `autoPlaylist=true` なら `/kiosk.html` へ | なし | 1.5s 後にフェードイン |
| `ai_assist.html` | AI テキスト表示 | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` | **1.5s 間隔**で `/api/ai-assist/latest` をポーリング | なし | フェードイン |
| `videocall.html` | 通話ページ | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` | `sessionStorage.doorbellCall` を元に URL 生成 | なし | `joinUrlDevice` を優先 |
| `test-csi-camera.html` | CSI カメラのテスト | なし | なし | **200ms 間隔**で `/api/test/csi-snapshot` をポーリング | なし | 疑似ストリーム |
| `test-doorbell.html` | ドアベル送信テスト | なし | なし | ボタン押下で `/api/doorbell/test` | なし | QR 画像は `/qrcodes/<deviceId>.png` |

## 各ページ詳細

> ### kiosk.html

- **DOM**：`#displayImage`（`<img>`）, `#playVideo`（`<video muted autoplay>`）, `#blackScreen`（オーバーレイ）
- **スクリプト**：`/js/playlistPlayer.js`（module）＋ `/js/main.js`（module）
- **備考**：ページ内に直接の Socket イベント購読は記述なし（`main.js` に委譲）

> ### welcome.html

- **起動時処理**：`/api/config` を取得し、`autoPlaylist` が `true` なら `/kiosk.html` へ遷移  
- **ソケット**：`setupSwitchView(socket)`

> ### ai_assist.html

- **ポーリング**：**1.5秒間隔**で `/api/ai-assist/latest` を取得し、`#response` を更新  
- **ソケット**：`setupSwitchView(socket)`

> ### videocall.html

- **通話 URL**：`sessionStorage.doorbellCall.joinUrlDevice` を優先  
  無い場合は `callId` から `https://xrobotics.daily.co/<callId>` を生成  
- **ソケット**：`setupSwitchView(socket)`

> ### test-csi-camera.html

- **表示方式**：`/api/test/csi-snapshot` を **約5fps** でポーリングし `<img>` を更新

> ### test-doorbell.html

- **送信**：`/api/doorbell/test?deviceId=<id>` に `POST`  
- **画像**：`/qrcodes/<deviceId>.png` を表示（静的ファイル）
