# コントローラー（api/）

`controllers/` 配下のコントローラを 1 ページに統合して記述します。  
各項目は「概要 / 前提・引数・戻り値 / ファイル内の関数について、処理の流れなど / メモや注意」で構成しています。  
※ 本ページのパス表記は **ルーターのマウント先からの相対パス**です（実際の URL は `app.use()` に依存）。

## **早見表（Routes ↔ Controllers 対応）**

| Group         | Method | Path                     | Controller (Function)                | 成功時レスポンス例                     | 副作用 / 備考 |
|---------------|--------|--------------------------|--------------------------------------|----------------------------------------|---------------|
| AI Assist     | POST   | `/ai-assist/update`      | `aiAssistController.updateText`      | `{ status: "OK" }`                     | `textStore.setLatestText(text)` |
| AI Assist     | GET    | `/ai-assist/latest`      | `aiAssistController.getLatestText`   | `{ text: "<current>" }`                | なし |
| Video         | GET    | `/video/`                | `videoController.getLocalVideoList`  | `{ videos: [...] }`                    | `config.VIDEOS_DIR` を走査 |
| Video         | GET    | `/video/play/:fileName`  | `videoController.playVideo`          | `{ status: "OK", target: "<name>" }`   | `ioLocal.emit("playVideo", fileName)` |
| Camera        | —      | —                        | `cameraController`                   | —                                      | **空ファイル（プレースホルダ）** |

## **aiAssistController.js**

AI アシスト用のテキストを保存・取得するシンプルな API。  
内部の `store/textStore` を介して最新テキストを保持します。

- 依存：`../store/textStore`（`setLatestText(text)`, `getLatestText()`）

### **updateText(req, res)**

- 期待ボディ：`{ text: string }`
- 戻り値：`200 { status: "OK" }`
- 例外：特に投げない（`text` 未指定でも 200 を返す）

> 処理の流れ

1) `req.body.text` を取得  

2) `text` があれば `textStore.setLatestText(text)` を実行しログ出力  

3) 常に `res.json({ status: 'OK' })`  

### **getLatestText(req, res)**

- 引数：なし
- 戻り値：`200 { text: <currentText> }`
- 例外：特に投げない

> 処理の流れ

1) `textStore.getLatestText()` で現在値を取得  

2) `res.json({ text: currentText })` を返す  

!!! note
    - バリデーションは最小限（`text` 未指定でも成功扱い）。必要ならルーター層での検証・400 応答を検討。
    - `textStore` の永続化要件は別途検討（現状はメモリ/簡易ストア想定）。

## **videoController.js**

ローカル動画の一覧取得と、指定ファイルの再生要求（Socket.IO 送出）を提供します。

- 依存：`fs.promises.readdir`, `config.VIDEOS_DIR`, `buildVideoFileObjects(files, deviceId)`, `ioLocal`（グローバル/アプリ注入想定）

### **getLocalVideoList(req, res)**

- 引数：なし
- 戻り値（成功）：`200 { videos: fileObjects[] }`
- 戻り値（失敗）：`500 { error: 'Failed to list videos' }`

> 処理の流れ

1) `config.VIDEOS_DIR` を `readdir` し、`.mp4` / `.mov` のみ抽出  

2) `buildVideoFileObjects(videoFiles, 'someDeviceId')` でメタ配列化  

3) `res.json({ videos: fileObjects })` を返す  
    失敗時はログ出力の上、`500` を返す  

### **playVideo(req, res)**

- パスパラメータ：`videoFileName`
- 戻り値：`200 { status: 'OK', target: videoFileName }`

> 処理の流れ

1) `req.params.videoFileName` を取得  

2) `ioLocal.emit('playVideo', videoFileName)` を送出  

3) `res.json({ status: 'OK', target: videoFileName })` を返す  

!!! note
    - `buildVideoFileObjects` の戻り構造は本コントローラ外で定義。スキーマを別途ドキュメント化推奨。
    - `ioLocal` はアプリ初期化時に `app.set('io', ...)` 等で注入・参照統一を推奨（グローバル直参照はテスト困難）。
    - パス走査や拡張子検証は Controller/Service いずれかで厳格化を（`..` などの無効名対策）。

> ## **cameraController.js**

現在は **空ファイル**（将来拡張のプレースホルダ）。

## **付録：Routes との対応（参照）**

- `aiAssistRoutes.js`
  `POST /ai-assist/update` → `aiAssistController.updateText`
  `GET /ai-assist/latest` → `aiAssistController.getLatestText`
- `videoRoutes.js`
  `GET /video/` → `videoController.getLocalVideoList`
  `GET /video/play/:videoFileName` → `videoController.playVideo`

!!! note
    実際の URL は `app.use('/api/...', router)` のマウントにより確定します。ここでのパスは **各ルーター内の相対パス**を示しています。
