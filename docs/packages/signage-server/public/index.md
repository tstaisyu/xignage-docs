# Public（UI）概要

サイネージ端末上の **Chromium（キオスク）** に表示されるフロントページ群（`public/*.html`）と、各ページで利用する **フロントJSモジュール（`public/js/*.js`）** の入口です。

- **実行環境**：Chromium on Xorg
- **配信**：Express の静的配信（`public/`）
- **アセット**：`/images/*`, `/videos/*`
- **ソケット**：ローカル Socket.IO に接続。`kiosk.html` は初期化後に **`clientReady`** を emit（保留イベントのフラッシュ受信に必須）

## **主要ページ**

- **kiosk.html**：メイン再生ビュー（画像/動画のフルスクリーン表示、Welcome/通話のオーバーレイを内包）
- **test-csi-camera.html**：CSI スナップショットのポーリング表示
- **test-doorbell.html**：ドアベルテスト送信 UI（QR 画像表示付き）
- **welcome.html**：**実ファイルはなく** `/kiosk.html` へ 302 リダイレクト（`app.js`）

## **クイックリンク**

- [**ページ一覧（用途・依存スクリプト・挙動）**](./pages.md)
- [**JSモジュール仕様（bootstrap / playlistPlayer / app/*）**](./js.md)

## **イベントとハンドシェイク（共通）**

- 受信想定：`switchView`, `showImage`, `playVideo`, `startPlaylist`, `stopPlaylist`, `setVolume`, `toggleVolume`, `doorbell:startCall` など  
- 初期化完了後：**`clientReady`** を送信（保留イベントのフラッシュ受信に必須）

!!! note "参考"
    ソケット設計とブリッジは **Components** にまとめています：  
    - Cloud ↔ Device：[`components/cloud-socket.md`](../components/cloud-socket.md)  
    - Local （`/`・`/admin`）：[`components/local-socket.md`](../components/local-socket.md)
