# フロントページ（HTML 一覧）

各ページが受け取る Socket イベントのうち、**`switchView` を除く詳細ロジック**は読み込まれる JS 側の実装に依存します。

## 一覧表（要約）

| ファイル | 目的/用途 | 読み込むスクリプト | ソケット処理 | ナビゲーション/タイマー | クエリパラメータ | 補足 |
| --- | --- | --- | --- | --- | --- | --- |
| `kiosk.html` | メイン再生ビュー | `/socket.io/socket.io.js`, **`/js/app/bootstrap.js`** | `bootstrap.js` が Socket を処理 | なし | `callId`, `joinUrlDevice`, `callOverlay` | `#displayImage` `#playVideo` `#blackScreen` / オーバーレイ（welcome/call） |
| `test-csi-camera.html` | CSI カメラのテスト | なし | なし | **200ms 間隔**で `/api/test/csi-snapshot` をポーリング | なし | 疑似ストリーム |
| `test-doorbell.html` | ドアベル送信テスト | なし | なし | ボタン押下で `/api/doorbell/test` | なし | QR 画像は `/qrcodes/<deviceId>.png` |
| `welcome.html` | エイリアス | なし | なし | `/kiosk.html` へ 302 リダイレクト | なし | 実体ファイルは存在しない |

## 各ページ詳細

> ### kiosk.html

- **DOM**：`#displayImage`（`<img>`）, `#playVideo`（`<video muted autoplay>`）, `#blackScreen`（オーバーレイ）
- **スクリプト**：`/js/app/bootstrap.js`（module）
- **備考**：`bootstrap.js` が Socket イベント購読とプレイリスト制御を担当

> ### test-csi-camera.html

- **表示方式**：`/api/test/csi-snapshot` を **約5fps** でポーリングし `<img>` を更新

> ### test-doorbell.html

- **送信**：`/api/doorbell/test?deviceId=<id>` に `POST`  
- **画像**：`/qrcodes/<deviceId>.png` を表示（静的ファイル）

> ### welcome.html

- **挙動**：`/kiosk.html` へ 302 リダイレクト（`app.js` のルート）
