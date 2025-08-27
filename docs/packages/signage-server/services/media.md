# サービス - Media / Content

プレイリスト・画像/動画サムネイル・アップロードを扱う **コンテンツ層サービス**の仕様をまとめます。  
対象ファイル：`imageService.js`, `videoService.js`, `uploadService.js`, `playlistManager.js`

## **早見表（モジュール別）**

| ファイル | 主な責務 | 主要関数 |
|---|---|---|
| `imageService.js` | 画像のサムネイル生成・画像ファイル配列のメタ化 | `createImageThumbnail(path)`, `buildImageFileObjects(files, deviceId)` |
| `videoService.js` | 動画のサムネイル生成（FFmpeg）・動画ファイル配列のメタ化 | `createVideoThumbnail(path)`, `buildVideoFileObjects(files, deviceId)` |
| `uploadService.js` | Multer 受領ファイルの保存・カテゴリ解決・任意データの保存 | `saveFile(file)`, `uploadFile(dir, fileName, data)` |
| `playlistManager.js` | `playlist.json` のロード/保存、要素追加・挿入・移動・削除、サムネイルURL付与 | `loadPlaylist()`, `savePlaylist()`, `getPlaylist()`, `getPlaylistWithThumbnails()`, `addItem()`, `insertItem()`, `removeItem()`, `moveItem()`, `removeItemByUuid()`, `moveItemByUuid()` |

## **imageService.js**

画像の **正方形 240×240** サムネイル（白背景・EXIF 回転考慮）を生成し、画像ファイル名配列から **サムネイル URL を含むメタ配列**を構築します。

### **createImageThumbnail(imagePath: string): `Promise<string>`**

- 入力：元画像の絶対/相対パス  
- 戻り値：作成された **サムネイルファイルの絶対パス**

> 処理の流れ

1) `path.basename/ extname` で `<base>-thumbnail.jpg` を作成

2) 出力先：`path.join(THUMBNAIL_DIR_IMAGES, thumbnailFile)`

3) `sharp(imagePath).rotate().resize(240,240,{ fit:'contain', background:white }).toFile(thumbnailPath)`

4) `thumbnailPath` を返す

### **buildImageFileObjects(imageFiles: string[], deviceId: string): `{id, fileName, thumbnailUrl}[]`**

- 入力：画像ファイル名配列（ファイル名のみ想定）, デバイスID
- 戻り値：`[{ id, fileName, thumbnailUrl }]`
- サムネイル URL：`<SERVER_URL>/api/images/thumbnail?deviceId=<id>&fileName=<base>-thumbnail.jpg`

> 処理の流れ

1) 各 `fileName` から `<base>-thumbnail.jpg` を導出

2) `thumbnailUrl` を `SERVER_URL` とクエリで構築

3) `{ id: index+1, fileName, thumbnailUrl }` 配列を返す

!!! note
    - `rotate()` により EXIF Orientation を考慮。
    - サムネイル URL は **`/api/images/thumbnail` ルートの実装前提**（実装の有無を確認のこと）。

## **videoService.js**

動画の **1 秒地点をサムネイル化**（白背景で 240×240 にパディング）し、動画ファイル名配列から **サムネイル URL を含むメタ配列**を構築します。

### **createVideoThumbnail(videoPath: string): `Promise<string>`**

- 入力：動画ファイルパス
- 戻り値：**サムネイルの公開 URL**（`<SERVER_URL>/videos/thumbnails/<base>-thumbnail.jpg`）

> 処理の流れ

1) `<base>-thumbnail.jpg` を `THUMBNAIL_DIR_VIDEOS` に決定

2) フィルタ：`scale='if(gt(a,1),240,-2)':'if(gt(a,1),-2,240)',format=yuv420p,pad=240:240:(ow-iw)/2:(oh-ih)/2:0xFFFFFF`

3) `ffmpeg(videoPath).seekInput('00:00:01').outputOptions(['-an']).frames(1).videoCodec('mjpeg').videoFilter(filter).output(thumbnailPath).run()`

4) 成功時：`<SERVER_URL>/videos/thumbnails/<thumbnail>` を **URL として返す**

### **buildVideoFileObjects(videoFiles: string[], deviceId?: string): `{id, fileName, thumbnailUrl, deviceId}[]`**

- 入力：動画ファイル名配列, 任意のデバイスID
- 戻り値：`[{ id, fileName, thumbnailUrl, deviceId }]`
- サムネイル URL：`<SERVER_URL>/api/videos/thumbnail?deviceId=<id>&fileName=<base>-thumbnail.jpg`

> 処理の流れ

1) 各 `fileName` から `<base>-thumbnail.jpg` を導出

2) `thumbnailUrl` を **`/api/videos/thumbnail`** のクエリで構築

3) `{ id: index+1, fileName, thumbnailUrl, deviceId }` 配列を返す

!!! note
    - **URL の不一致に注意**：生成関数は `/videos/thumbnails/`、ビルド関数は `/api/videos/thumbnail` を返す設計です。**どちらかに統一**してください（推奨：API ルートに合わせる）。
    - `ffmpeg` コマンドの存在が必須。コンテナ/端末に同梱・PATH 反映要。

## **uploadService.js**

Multer で受け取った単一ファイルを **カテゴリ（`images` / `videos`）へ自動振り分け**し保存、公開 URL とメタを返します。また任意データをファイルに書き出す汎用関数を提供します。

- 内部定義：`VIDEO_EXT = ['.mp4','.mov','.webm','.mkv']`, `IMAGE_EXT = ['.jpg','.jpeg','.png','.gif','.webp']`

### **getCategory(ext)**

> 処理の流れ

1) 拡張子を小文字化

2) 動画/画像拡張子表に含まれるか判定

3) `videos` / `images` を返す（未対応は `Error`）

### **saveFile(file: MulterFile): `Promise<{ fileName, url, mime, size }>`**

- 入力：`multer` の `single('file')` で得られる `file` オブジェクト
- 戻り値：`{ fileName, url: '/contents/<category>/<name>', mime, size }`

> 処理の流れ

1) `ext = path.extname(file.originalname)` → `category = getCategory(ext)`

2) `uploadRoot = (category==='images'? IMAGES_DIR : VIDEOS_DIR)` を `mkdir -p`

3) `safeName = Date.now() + '_' + originalname（空白→`_`）`

4) 一時ファイル `file.path` を `rename()` で `dest` へ移動

5) `mime = mime.lookup(ext) || 'application/octet-stream'`

6) `{ fileName: safeName, url: '/contents/<category>/<safeName>', mime, size }` を返す
  
### **uploadFile(directory: string, fileName: string, fileData: Buffer|string): `Promise<string>`**

- 入力：保存先ディレクトリ・ファイル名・内容
- 戻り値：保存した **絶対パス**

> 処理の流れ

1) `path.join(dir, fileName)` に `writeFile`

2) 絶対パスを返す

!!! note
    - `/contents` パスの **静的配信設定（Express static 等）** が必要です。
    - `originalname` のサニタイズは空白置換のみ。**パス区切り文字の除去・長さ上限・重複対策**など追加検討を推奨。
    - 拡張子で MIME を判定するため、**実体検査**（magic bytes）を追加すると安全性が向上します。

## **playlistManager.js**

`<CONTENTS_DIR>/playlist.json` を **モジュール初期化時にロード**し、メモリ上の `playlist` をソースオブトゥルースとして管理。保存時は **配列順を正**として `order = index` に再付与します。  
要素の **追加（UUID 発行）/ 挿入 / 移動 / 削除** と、**サムネイルURL付与ビュー**を提供します。

- 定数：`PLAYLIST_JSON_PATH = path.join(config.CONTENTS_DIR, 'playlist.json')`

### **loadPlaylist(): `void`**

ディスク → メモリ読込（失敗/空は `[]`）

> 処理の流れ

1) `PLAYLIST_JSON_PATH` がなければ `playlist = []`

2) あれば UTF-8 読込 → 空文字なら `[]`、そうでなければ `JSON.parse`

3) 例外時はログ出力の上 `[]`

### **savePlaylist(): `void`**

メモリ → ディスク書込（`order = index` を再付与）

> 処理の流れ

1) `playlist.forEach((item, idx) => item.order = idx)`

2) `JSON.stringify(playlist, null, 2)` をファイルへ書込（例外はログ）

### **getPlaylist(): `any[]`**

現在のメモリ配列を返す

### **getPlaylistWithThumbnails(): `any[]`**

`buildThumbnailUrl()` を使って各要素に `thumbnailUrl` を付与して返す

> 処理の流れ

1) `loadPlaylist()` で最新化

2) 各要素に `thumbnailUrl = buildThumbnailUrl(item.contentId)` を付与して返す

### **buildThumbnailUrl(contentId)**

> 処理の流れ

1) 未指定時 `null` を返す

2) `SERVER_URL + '/api/playlist/thumbnail?deviceId=' + DEVICE_ID + '&contentId=' + encodeURIComponent(contentId)`

### **addItem({ contentId: string, duration: number }): `any[]`**

**UUID 付与**で末尾に追加（`type` は拡張子で推定, `duration` 既定 10）

> 処理の流れ

1) `PLAYLIST_JSON_PATH` の有無で `playlist` を初期化 or `loadPlaylist()`

2) `uuidv4()` を発行、拡張子で `type` 判定（`.mp4`/`.mov`=video, それ以外=image）

3) `duration` は `parseInt(...) || 10`

4) `{ uuid, contentId, type, duration }` を push → `savePlaylist()` → `playlist` を返す

### **insertItem(content: { contentId: string }, index: number): `any[]`**

指定位置へ挿入（簡易構造）

> 処理の流れ

1) `index` を `[0, playlist.length]` にクランプ

2) `{ contentId: content.contentId, order: index }` を生成して `splice` 挿入

3) `savePlaylist()` → `playlist` を返す

### **removeItem(index: number): `any[]`**

旧実装の **インデックス削除**

### **moveItem(fromIndex: number, toIndex: number): `any[]`**

旧実装の **インデックス移動**

> 処理の流れ

1) 範囲チェック → `splice` 操作

2) `savePlaylist()` → `playlist` を返す

### **removeItemByUuid(itemUuid: string): `any[]`**

**UUID 指定**で削除

### **moveItemByUuid(itemUuid: string, targetIndex: number): `any[]`**

**UUID 指定**で移動（境界はクランプ）

> 処理の流れ

1) `loadPlaylist()` → `findIndex(item.uuid === itemUuid)`

2) 未発見は現状維持で返す

3) 見つかれば削除 or 指定位置へ移動 → `savePlaylist()` → 返す

!!! note
    - **二系統の API が混在**：`index` ベース（旧）と `uuid` ベース（新）。将来的には **uuid ベースに統一**を推奨。
    - `insertItem()` は `uuid/type/duration` を付与しない**簡易要素**を挿入します。後段での利用前提がある場合は統一スキーマに正規化してください。
    - モジュール読込時に `loadPlaylist()` を実行し **メモリ常駐**。複プロセス/クラスタ構成では **整合性ズレ**が起き得ます（外部ストアやロックを検討）。
    - `buildThumbnailUrl()` は `/api/playlist/thumbnail` 前提。**ルート実装の有無**を確認してください。
