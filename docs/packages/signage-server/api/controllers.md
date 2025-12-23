# コントローラー（api/）

`controllers/` 配下のコントローラを 1 ページに統合して記述します。  
本ページのパス表記は **ルーターのマウント先からの相対パス**です（実際の URL は `app.use()` に依存）。

## **早見表（Routes ↔ Controllers 対応）**

| Group | Method | Path | Controller (Function) | 成功時レスポンス例 | 備考 |
| --- | --- | --- | --- | --- | --- |
| AI Assist | POST | `/ai-assist/update` | `aiAssistController.updateText` | `{ status: "OK" }` | `textStore` に保存 |
| AI Assist | GET | `/ai-assist/latest` | `aiAssistController.getLatestText` | `{ text: "<current>" }` | |
| Test | GET | `/test/csi-snapshot` | `cameraController.getCsiSnapshot` | `image/jpeg` | `rpicam-jpeg` を実行 |

## **aiAssistController.js**

AI アシスト用のテキストを保存・取得するシンプルな API。  
内部の `store/textStore` を介して最新テキストを保持します。

### **updateText(req, res)**

- 期待ボディ：`{ text: string }`
- 戻り値：`200 { status: "OK" }`
- 例外：`text` 未指定でも 200 を返す

> 処理の流れ

1) `req.body.text` を取得  
2) `text` があれば `textStore.setLatestText(text)` を実行  
3) `res.json({ status: 'OK' })` を返す

### **getLatestText(req, res)**

- 引数：なし
- 戻り値：`200 { text: <currentText> }`

> 処理の流れ

1) `textStore.getLatestText()` で現在値を取得  
2) `res.json({ text: currentText })` を返す

### **Store（`store/textStore.js`）**

AI アシスト用の「最新テキスト」を **プロセス内メモリ**に保持する最小ストア。再起動で内容は消えます。

| 関数 | 引数 | 戻り値 | 説明 |
| --- | --- | --- | --- |
| `getLatestText()` | なし | `string` | 現在保持しているテキストを返す |
| `setLatestText(value)` | `string value` | `void` | 最新テキストを更新する |

## **cameraController.js**

CSI カメラのスナップショットを **`rpicam-jpeg`** で取得し、`image/jpeg` としてストリーム返却します。

### **getCsiSnapshot(req, res)**

- 戻り値：`image/jpeg` ストリーム
- 失敗時：`500 { error: "CSI camera error" }`（ヘッダ送信前のみ）

> 処理の流れ

1) `rpicam-jpeg` を `spawn` し、`stdout` を `res` に pipe  
2) `stderr` は logger に流す（`logger.debug` が存在する場合）  
3) `error` 時は `500` を返す（ヘッダ送信済みなら `res.end()`）  
4) クライアント切断時は `SIGTERM` で停止

!!! note
    - `rpicam-jpeg` が未導入の場合は常に失敗します。  
    - レスポンスは **連続ストリームではなくスナップショット**です（呼び出し側でポーリング）。
