# API ルーティング（routes/）

`routes/` 配下の HTTP ルーターを **1 ページ**に統合して記述します。  
各項目は「概要 / 共通仕様 / 早見表 / 各ルーター詳細 / メモや注意」で構成しています。  
※ 本ページのパスは **各ルーターの「マウント先」からの相対パス**です（実際の `app.use()` 側での Base Path に依存）。

## **概要**

- **責務**：HTTP エンドポイントの入口。静的 HTML の配信、設定値の取得、プレイリストの取得、動画制御、ビュー切替、管理用の一覧/アップロードなどを提供。
- **関連モジュール**（`routes/index.js` がエクスポート）：
  - `kioskRoutes`, `testRoutes`, `videoRoutes`, `viewRoutes`, `aiAssistRoutes`,
    `localPlaylistRoutes`, `configRoutes`, `adminUploadRoutes`, `adminListRoutes`
- **主な依存**：`controllers/*`, `services/*`, `config/*`, `public/*`, `middlewares/errorHandler.js`

## **共通仕様**

- **Content-Type**：JSON を返す API は `application/json`。静的ページ配信は `text/html`。
- **エラー処理**：一部で `next(err)` により `middlewares/errorHandler.js` に委譲。
- **認証/認可**：現状コード上は未実装（必要に応じて今後追加）。
- **注意**：本ドキュメントは提示されたソース断片に基づくため、アプリ側のマウント構成により実パスは前後します。

## **早見表（エンドポイント一覧・相対パス）**

| Group            | Method | Path                         | 概要                                       | 成功時レスポンス                   | 副作用 / 備考 |
|------------------|--------|------------------------------|--------------------------------------------|------------------------------------|---------------|
| **AI Assist**    | GET    | `/`                          | `public/ai_assist.html` を配信             | HTML                               |              |
|                  | POST   | `/update`                    | テキスト更新（Controller 委譲）            | Controller 依存（JSON 想定）       |              |
|                  | GET    | `/latest`                    | 最新テキスト取得（Controller 委譲）        | Controller 依存（JSON 想定）       |              |
| **Config**       | GET    | `/`                          | 端末ローカル設定を返す                     | `{ autoPlaylist, screenRotation }` | 失敗時はデフォルトにフォールバック |
| **Kiosk**        | GET    | `/`                          | `public/kiosk.html` を配信                 | HTML                               | `offline.html` 分岐はコメントアウト |
| **LocalPlaylist**| GET    | `/`                          | `playlist.json` を読み取り → 正規化して返却 | `{ records: Item[] }`              | ない場合は空配列を書き出して作成 |
|                  | GET    | `/thumbnail`                 | サムネイル取得のプレースホルダ              | `200 "not yet implemented"`         | `400`（パラメータ不足） |
| **Test**         | GET    | `/test1`                     | `public/test1.html` を配信                 | HTML                               |              |
|                  | GET    | `/test2`                     | `public/test2.html` を配信                 | HTML                               |              |
| **Video**        | GET    | `/`                          | ローカル動画一覧（Controller 委譲）        | Controller 依存（JSON 想定）       |              |
|                  | GET    | `/play/:videoFileName`       | 動画再生（Controller 委譲）                | Controller 依存（JSON/HTML 想定）  |              |
| **View**         | GET    | `/switch/:view`              | ビュー切替イベントを送出                   | `{ status: "OK", target }`         | `ioLocal.emit('switchView', view)` |
| **Admin/List**   | GET    | `/`                          | 画像/動画の一覧を返す                      | `[{ type, src }, ...]`             | 例外は `next(err)` |
| **Admin/Upload** | POST   | `/`                          | アップロード（Multer 100MB 制限）          | `201 { ...meta }`                  | `saveFile()` 依存（イベント送出はコメントアウト） |

## **各ルーター詳細**

> ### **AI Assist（`routes/aiAssistRoutes.js`）**

- **GET `/`**：`public/ai_assist.html` を送信。  
- **POST `/update`**：`aiAssistController.updateText` に委譲（リクエスト/レスポンス仕様は Controller 実装に依存）。  
- **GET `/latest`**：`aiAssistController.getLatestText` に委譲（レスポンス仕様は Controller 実装に依存）。

!!! note
    - UI ページ配信と、テキストの更新/取得 API が混在。JSON のスキーマは Controller 実装に追従。

> ### **Config（`routes/configRoutes.js`）**

- **GET `/`**：端末ローカル設定を返す。  
  **読み取り元**：`/var/lib/signage_local/localSettings.json`  
  **フォールバック**（読み取り失敗時）：`{ autoPlaylist: false, screenRotation: 'right' }`

!!! note
    - 例外は握りつぶし `console.error` ログの上で安全なデフォルトを返却（常に 200）。  
    - JSON 形式の妥当性は読み取り側で最低限チェック（`JSON.parse` 失敗もフォールバック）。

> ### **Kiosk（`routes/kioskRoutes.js`）**

- **GET `/`**：`public/kiosk.html` を送信。  
  `offline.html` への分岐はコメントアウト（`isOnline` 判定の将来拡張用）

!!! note
    - オフライン検知ロジックを有効化する場合は `isOnline` の実装と HTML パスを整合させる。

> ### **Local Playlist（`routes/localPlaylistRoutes.js`）**

- **GET `/`**：ローカルの `playlist.json` を読み取り、**正規化された配列**を返す。  
  **パス**：`path.join(config.CONTENTS_DIR, 'playlist.json')`  
  **ファイルが無い場合**：`[]` を書き出して作成（ログ出力あり）  
  **入力想定**：各要素 `{ contentId, order?, duration? }`（`file` フィールドでも可）  
  **正規化**：`buildPlaylistItem(contentId, order??index, duration)`  
    `type` は拡張子で推定（`.mp4`/`.mov` → `video`、それ以外 → `image`）  
    `duration` は数値化（不正値は `10`）  
  **ソート**：`order` 昇順  
  **レスポンス**：`{ records: { file, type, order, duration }[] }`

- **GET `/thumbnail`**：プレースホルダ（未実装）。  
  **Query**：`contentId`, `deviceId` は必須（未指定は `400`）  
  現状は `200 'Thumbnail route not yet implemented'` を返す

!!! note
    - `config.CONTENTS_DIR` の実体（権限/パス）が前提。  
    - `thumbnail` は実装時に動画/画像で処理分岐（コメントにヒントあり）。

> ### **Test（`routes/testRoutes.js`）**

- **GET `/test1`**：`public/test1.html` を送信。  
- **GET `/test2`**：`public/test2.html` を送信。

!!! note
    - 疎通確認/デモ用の静的ページ。

> ### **Video（`routes/videoRoutes.js`）**

- **GET `/`**：`videoController.getLocalVideoList` に委譲（ローカル動画の一覧を返す想定）。  
- **GET `/play/:videoFileName`**：`videoController.playVideo` に委譲（指定ファイルの再生制御）。

!!! note
    - 具体的なレスポンス形式/エラーコードは Controller 実装に依存。  
    - `:videoFileName` のバリデーション（拡張子/パス走査防止）は Controller 側で担保すること。

> ### **View（`routes/viewRoutes.js`）**

- **GET `/switch/:view`**：ビュー切替。  
  **処理**：`ioLocal.emit('switchView', view)` を送出し、`{ status: 'OK', target: view }` を返却  
  **ログ**：`[viewRoutes] Switched view to: <view>` を出力

!!! note
    - `ioLocal` はアプリ側で設定済みの Socket.IO 名前空間/インスタンスを想定。  
    - `:view` の許容値はフロント側の実装に依存（kiosk, menu, welcome など）。

> ### **Admin/List（`routes/admin/list.js`）**

- **GET `/`**：画像/動画ファイルの一覧を返却。  
  **読み取り元**：`IMAGES_DIR`, `VIDEOS_DIR`（存在しない場合は `[]` として扱う）  
  **処理**：  
    画像 → `{ type: 'image', src: '/contents/images/<file>' }`  
    動画 → `{ type: 'video', src: '/contents/videos/<file>' }`  
    上記を配列で返却  
  **エラー**：例外時は `next(err)`（共通エラーハンドラへ）

!!! note
    - ディレクトリの所有権/権限に注意。拡張子フィルタは `readdir` 結果そのままのため、不要ファイル混入に留意。

> ### **Admin/Upload（`routes/admin/upload.js`）**

- **POST `/`**：ファイルアップロード。  
  **ライブラリ**：`multer`（`dest: 'tmp/'`、`limits.fileSize: 100MB`）  
  **入力**：`multipart/form-data` フィールド名 `file`  
  **処理**：`saveFile(req.file)` に委譲  
  **レスポンス**：`201 { ...meta }`（メタ構造は `saveFile` 実装に依存）  
  **イベント**：`uploadFinished` の Socket.IO 送出は **コメントアウト中**

!!! note
    - 100MB 超過時は Multer により自動的に `413` などが返る構成が一般的（エラーハンドラ要確認）。  
    - 一時領域 `tmp/` のクリーンアップ方針と、ストレージ側保存先/命名規則は `saveFile` 実装に準拠。

## **メモや注意（全体）**

- **マウントパス**：実際の URL は `app.use()` の設定に依存（例：`app.use('/api/kiosk', kioskRoutes)` など）。本書は各ルーター内で定義された **相対パス**で記述。  
- **静的配信**：`res.sendFile()` のベースは `__dirname/../public/`。デプロイ時の相対位置に留意。  
- **エラー整形**：`admin/list` と `admin/upload` は `next(err)` を使用。共通ハンドラ側で JSON 形式に正規化することを推奨。  
- **将来拡張**：`LocalPlaylist` の `/thumbnail`、`Kiosk` のオフライン分岐、`AI Assist` の I/O スキーマ固定など。
