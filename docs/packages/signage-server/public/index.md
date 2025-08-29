# Public（UI）概要

サイネージ端末上の **Chromium（キオスク）** に表示されるフロントページ群（`public/*.html`）と、各ページで利用する **フロントJSモジュール（`public/js/*.js`）** の入口です。

- **実行環境**：Chromium on Xorg（全画面／黒背景中心）
- **配信**：Express の静的配信（構成により Nginx 経由）
- **アセット**：`/images/*`, `/videos/*`（サムネイルは `…/thumbnails/`）
- **ソケット**：ローカル Socket.IO に接続。ページ初期化後に **`clientReady`** を emit（保留中の `showImage` / `playVideo` を受信するため）

## **主要ページ**

- **kiosk.html**：メイン再生ビュー（画像/動画のフルスクリーン表示、フェード演出はJS側）
- **welcome.html**：起動直後。`/api/config` で `autoPlaylist` を見て **自動遷移（/kiosk.html）**
- **loading.html**：3秒後に **/kiosk.html** へ
- **offline.html**：オフライン通知
- **menu.html**：メニュー（`switchView` 受け取り）
- **mirror.html**：カメラの左右反転ミラー表示
- **screensaver.html**：中央画像のフェードイン/アウト周期表示（`?image=` 指定可）
- **ai_assist.html**：`/api/ai-assist/latest` を1.5秒間隔でポーリングして表示更新
- **videocall.html**：Jitsi 埋め込み（現状 URL 固定／`room` は未反映）
- **youtube.html**：YouTube IFrame API。`?youtubeUrl=` から **video / playlist** を埋め込み

## **クイックリンク**

- [**ページ一覧（用途・依存スクリプト・挙動）**](./pages.md)
- [**JSモジュール仕様（main / playlistPlayer / switchViewHandler / youtube）**](./js.md)

## **イベントとハンドシェイク（共通）**

- 受信想定：`switchView`, `showImage`, `playVideo`, `playYoutubeLocal`, `startPlaylist`, `stopPlaylist`, `setVolume`, `toggleVolume` など  
- 初期化完了後：**`clientReady`** を送信（保留イベントのフラッシュ受信に必須）

!!! note "参考"
    ソケット設計とブリッジは **Components** にまとめています：  
    - Cloud ↔ Device：[`components/cloud-socket.md`](../components/cloud-socket.md)  
    - Local （`/`・`/admin`）：[`components/local-socket.md`](../components/local-socket.md)
