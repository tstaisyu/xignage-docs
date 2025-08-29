# フロントページ（HTML 一覧）

各ページが受け取る Socket イベントのうち、**`switchView` を除く詳細ロジック**は読み込まれる JS（`/js/*.js`）側の実装に依存します。

## **一覧表（要約）**

| ファイル | 目的/用途 | 読み込むスクリプト | ソケット処理 | ナビゲーション/タイマー | クエリパラメータ | 補足 |
|---|---|---|---|---|---|---|
| `kiosk.html` | メイン再生ビュー（黒背景・画像/動画のフルスクリーン表示） | `/socket.io/socket.io.js`, **`/js/playlistPlayer.js`**（module）, **`/js/main.js`**（module） | （ページ内で直接購読は記述なし）※module側に委譲 | なし | なし | `#displayImage` `#playVideo` `#blackScreen` を備える |
| `loading.html` | ローディング画面 | なし | なし | **3秒後** `/kiosk.html` へリダイレクト | なし | 画面中央「Loading…」表示 |
| `offline.html` | オフライン通知 | なし | なし | なし | なし | 黒背景＋白文字の固定文言 |
| `menu.html` | メニュー（管理UI などからの遷移起点想定） | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` 呼び出し（`switchView` を処理） | なし | なし | 空の `#menu` コンテナのみ |
| `mirror.html` | カメラのミラー表示（左右反転） | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` 呼び出し | ページ読込時に **カメラ起動** | なし | `<video id="videoElem">` `object-fit: cover` ＆ **`transform: scaleX(-1)`** |
| `screensaver.html` | スクリーンセーバ（中央画像のフェードイン/アウト周期表示） | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` 呼び出し | フェード：**2s** in → **5s** 表示 → **2s** out → **2s** hidden のループ | `?image=<ファイル名>`（既定 `screensaver.png`） | 画像パスは **`/images/<name>`**（サーバの静的配信設定が必要） |
| `welcome.html` | 起動直後のウェルカム画面 | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` 呼び出し | `/api/config` を取得し、**`autoPlaylist=true` なら `/kiosk.html` へ遷移** | なし | `#welcome` を 1.5s 後にフェードイン |
| `ai_assist.html` | テキスト表示（AIアシスト） | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` 呼び出し | **1.5s 間隔**で `/api/ai-assist/latest` をポーリングして文言更新 | なし | フェードイン演出あり |
| `videocall.html` | ビデオ通話（Jitsi 埋め込み） | `/socket.io/socket.io.js`, `/js/switchViewHandler.js` | `setupSwitchView(socket)` 呼び出し | なし | `?room=<部屋名>` を **取得はするが未使用** | 実際の埋め込み URL は **固定の `XIG-001-66B`** に設定されている |
| `youtube.html` | YouTube 埋め込み再生（動画/プレイリスト対応） | YouTube IFrame API, `/socket.io/socket.io.js`, `/js/switchViewHandler.js`, `/js/youtube.js` | `setupSwitchView(socket)`, `setupYoutubeVolume(socket)` 呼び出し | なし | `?youtubeUrl=<URLまたはID>` | `youtubeUrl` から **videoId / playlistId** を抽出し、`embedUrl` を組み立て |

## **各ページ詳細**

> ### **kiosk.html**

- **DOM**：`#displayImage`（`<img>`）, `#playVideo`（`<video muted autoplay>`）, `#blackScreen`（フェード用オーバーレイ）, `.media-container`（全画面センタリング）
- **スタイル**：黒背景、画像/動画は `object-fit: contain` で等比フィット、初期表示は `display: none`
- **スクリプト**：  
  `/js/playlistPlayer.js`（module）— *コメント*: ループ再生機能を提供
  `/js/main.js`（module）— *コメント*: 初期化と Socket.IO イベント処理
- **備考**：ページ内に直接の Socket イベント購読は記述なし（module 側に委譲）。`#blackScreen` はオーバーレイ要素として定義（使用は module 側次第）。

> ### **loading.html**

- **役割**：シンプルなローディング表示
- **挙動**：`setTimeout(..., 3000)` で **3秒後**に `/kiosk.html` へ遷移
- **スタイル**：黒背景・白文字、中央に「Loading... Please wait.」

> ### **offline.html**

- **役割**：オフライン状態の固定メッセージ表示
- **スタイル**：黒背景・白文字、中央寄せ

> ### **menu.html**

- **役割**：メニュー画面（中身は空の `#menu`）
- **スクリプト**：`/socket.io/socket.io.js`, `/js/switchViewHandler.js`
  `const socket = io(); setupSwitchView(socket);` で **`switchView` に反応**（遷移/切替は `switchViewHandler.js` 実装に依存）

> ### **mirror.html**

- **役割**：カメラ映像を**左右反転**で全画面表示（ミラーモード）
- **DOM**：`<video id="videoElem" autoplay muted playsinline>`
- **スタイル**：`object-fit: cover; transform: scaleX(-1);`（全面フィル）
- **処理**：`getUserMedia({ video:true, audio:false })` で起動し、`videoElem.srcObject = stream`
- **ソケット**：`setupSwitchView(socket)` を呼ぶ（`switchView` に反応）

> ### **screensaver.html**

- **役割**：中央画像をフェードイン/アウトで **ループ**表示
- **画像ソース**：`/images/<image>`（`?image=` で指定、既定は `screensaver.png`）
- **アニメーション**：
  in：**2s** → 表示維持：**5s** → out：**2s** → hidden：**2s** → 繰り返し
  `#screensaverImg` に `fade-in` / `fade-out` クラスと `opacity` を適用
- **ソケット**：`setupSwitchView(socket)` を呼ぶ

> ### **welcome.html**

- **役割**：ウェルカム表示と **自動再生設定の確認**
- **起動時処理**：  
  1) `fetch('/api/config')` → `autoPlaylist` が **true** なら `/kiosk.html` へ遷移  
  2) 1.5秒後に `#welcome` をフェードイン  
- **ソケット**：`setupSwitchView(socket)`

> ### **ai_assist.html**

- **役割**：AI テキストの**定期更新表示**
- **ポーリング**：**1.5秒間隔**で `/api/ai-assist/latest` を取得し、`#response` のテキストをフェードイン更新
- **ソケット**：`setupSwitchView(socket)`

> ### **videocall.html**

- **役割**：Jitsi の iFrame 埋め込み
- **クエリ**：`?room=<部屋名>` を **取得してログ出力するが、URL生成に未使用**
- **実際の埋め込み URL**：
  `https://meet.jit.si/XIG-001-66B#config.prejoinPageEnabled=false&...`（固定）  
  → 将来的に `roomName` を URL に反映する必要あり  
- **ソケット**：`setupSwitchView(socket)`

> ### **youtube.html**

- **役割**：YouTube 動画/プレイリストの埋め込み再生
- **IFrame API**：`<script src="https://www.youtube.com/iframe_api">`、`onYouTubeIframeAPIReady()` → `new YT.Player('playerFrame', …)`
- **クエリ**：`?youtubeUrl=<URLまたはID>` を解析
  `list=` があれば **プレイリスト埋め込み**を優先  
  なければ `v=` / `youtu.be/` / **生ID（英数`_``-` 最低8字）** を抽出して単体動画を埋め込み  
  いずれも取れなければ **渡された値をそのまま `iframe.src` に適用**
- **最終 URL 例**：  
  プレイリスト：`https://www.youtube.com/embed?listType=playlist&list=<PLAYLIST_ID>&loop=1&autoplay=1&mute=1&controls=0&rel=0&enablejsapi=1`  
  単体動画：`https://www.youtube.com/embed/<VIDEO_ID>?autoplay=1&mute=1&controls=0&rel=0&enablejsapi=1`  
- **ソケット**：`setupSwitchView(socket)`, `setupYoutubeVolume(socket)` を呼ぶ（`/js/youtube.js` 実装に依存）

## **共通メモ**

- **`switchView`**：多くのページで `setupSwitchView(socket)` を呼んでおり、**ビュー切替**に対応。具体的な遷移挙動は `/js/switchViewHandler.js` に依存します。
- **静的配信パス**：
  スクリーンセーバの画像は `/images/<name>` を参照。サーバ側で `/images` → 実ファイルの静的マッピングが必要です。
- **モジュール依存**：
  `kiosk.html` のメディア表示は **`/js/playlistPlayer.js` / `/js/main.js` に実装が依存**（本 HTML にはイベント購読の直接記述なし）。
- **アクセシビリティ/パフォーマンス**：
  長時間稼働を想定し、画像/動画のリソース解放・タイマ/リスナの解除などは JS 側で配慮してください。
