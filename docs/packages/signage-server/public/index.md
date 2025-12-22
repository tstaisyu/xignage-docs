# Public（UI）概要

サイネージ端末上の **Chromium（キオスク）** に表示されるフロントページ群（`public/*.html`）と、各ページで利用する **フロントJSモジュール（`public/js/*.js`）** の入口です。

- **実行環境**：Chromium on Xorg
- **配信**：Express の静的配信（`public/`）
- **アセット**：`/images/*`, `/videos/*`
- **ソケット**：ローカル Socket.IO に接続。`kiosk.html` は初期化後に **`clientReady`** を emit（保留イベントのフラッシュ受信に必須）

## **主要ページ**

- **kiosk.html**：メイン再生ビュー（画像/動画のフルスクリーン表示）
- **welcome.html**：起動直後。`/api/config` で `autoPlaylist` を見て **自動遷移（/kiosk.html）**
- **loading.html**：3秒後に **/kiosk.html** へ
- **offline.html**：オフライン通知
- **ai_assist.html**：`/api/ai-assist/latest` を1.5秒間隔でポーリングして表示更新
- **videocall.html**：`sessionStorage.doorbellCall` を元に通話 URL を埋め込み
- **test-csi-camera.html**：CSI スナップショットのポーリング表示
- **test-doorbell.html**：ドアベルテスト送信 UI（QR 画像表示付き）

## **クイックリンク**

- [**ページ一覧（用途・依存スクリプト・挙動）**](./pages.md)
- [**JSモジュール仕様（main / playlistPlayer / switchViewHandler）**](./js.md)

## **イベントとハンドシェイク（共通）**

- 受信想定：`switchView`, `showImage`, `playVideo`, `playYoutubeLocal`, `startPlaylist`, `stopPlaylist`, `setVolume`, `toggleVolume` など  
- 初期化完了後：**`clientReady`** を送信（保留イベントのフラッシュ受信に必須）

!!! note "参考"
    ソケット設計とブリッジは **Components** にまとめています：  
    - Cloud ↔ Device：[`components/cloud-socket.md`](../components/cloud-socket.md)  
    - Local （`/`・`/admin`）：[`components/local-socket.md`](../components/local-socket.md)

!!! note "未配置ページ"
    `main.js` は `/youtube.html` へ遷移する分岐を持ちますが、`public/` 配下に該当 HTML が見当たりません。  
    現行の静的配信は `public/` のみのため、遷移時は 404 となります。
