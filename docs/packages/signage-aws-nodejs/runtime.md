# Runtime（Server / Middleware / Utils）

本ページは **サーバ起動・配線（server.js）／共通ミドルウェア／ユーティリティ**を 1 つに集約した実行時ガイドです。  
Routes／Socket／Services と連携し、HTTP と WebSocket を束ねます。

## **概要**

- **Express**: JSON 受け取り・API ルーティング  
- **HTTP Server**: Express をラップして Socket.IO をぶら下げる  
- **Socket.IO**: `initSocket(server)` 一度だけ初期化 → `getIO()` で参照  
- **エラーハンドラ**: `next(err)` で集約し、`err.status || 500` を返す

## **起動フロー（server.js）**

1) `.env` 読込（`dotenv`）  

2) `app = express()` → `express.json()` / `bodyParser.json()`  

3) `server = http.createServer(app)`  

4) `initSocket(server)` → `const io = getIO()`  

5) `app.use('/', routes(io))`（内部で `/api` 配下を束ね）  

6) 最後に共通 **エラーハンドラ** を登録  

7) `if (require.main === module)` → `server.listen(PORT)`（既定 3000）

**環境変数**  

- `PORT` … HTTP リッスンポート（既定 `3000`）  
- （参考）OpenAI 利用時：`OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_MAX_TOKENS`

**エラー方針**  

- ルート/サービス層で `err.status` を付けて `next(err)`  
- タイムアウトは **504 相当**で扱うのを推奨（実装が 500 の箇所は置き換え候補）

## **Middleware**

### **validationResult（`middlewares/validationResult.js`）**

`express-validator` の検証結果をチェックし、**400** を返す共通ミドルウェア。

```js
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
```

**適用例**  

```js
router.get('/', validators.validateList, validationResult, controller.list);
```

## **utils**

### **extractFileNameFromUrl（`utils/fileUtils.js`）**

URL からファイル名のみを安全に抽出（失敗時は `'unknown'`）。

```js
function extractFileNameFromUrl(fileUrl) {
  try {
    return new URL(fileUrl).pathname.split('/').pop() || 'unknown';
  } catch {
    return 'unknown';
  }
}
```

**使用箇所例**  

- `/api/uploads/image|video` … 外部 URL から Buffer 取得後、`<timestamp>-<original>`
