# Runtime（Server / Middleware）

本ページは **サーバ起動・配線（server.js）／共通ミドルウェア**をまとめた実行時ガイドです。  
Routes／Socket／Services と連携し、HTTP と WebSocket を束ねます。

## **概要**

- **Express**: JSON 受け取り・API ルーティング  
- **HTTP Server**: Express をラップして Socket.IO をぶら下げる  
- **Socket.IO**: `initSocket(server)` 一度だけ初期化 → `getIO()` で参照  
- **静的配信**: `ADMIN_UI_DIST_DIR` があれば `/admin` に React UI を配信  
- **エラーハンドラ**: `next(err)` で集約し、`err.status || 500` を返す

## **起動フロー（server.js）**

1) `.env` 読込（`dotenv`）  
   `dotenv` は標準の `.env` と `/etc/signage/secret.env` を順に読み込みます。

2) `app = express()` → `express.json()` / `bodyParser.json()`  

3) `server = http.createServer(app)`  

4) `initSocket(server)` → `const io = getIO()`  

5) `app.use('/', routes(io))`（内部で `/api` 配下を束ね）  

6) 最後に共通 **エラーハンドラ** を登録  

7) `if (require.main === module)` → `server.listen(PORT)`（既定 3000）

## **環境変数（主要）**

- **HTTP/配信**: `PORT`（既定 3000）, `ADMIN_UI_DIST_DIR`
- **OpenAI**: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`
- **内部 API**: `INTERNAL_API_TOKEN`
- **コンテンツ DB**: `CONTENT_DB_SECRET_ARN`
- **S3**: `CONTENT_BUCKET_NAME`
- **AWS リージョン**: `AWS_REGION` / `AWS_DEFAULT_REGION`
- **認可**: `MASTER_USER_EXTERNAL_IDS`
- **端末ネットワーク**: `WIFI_PRIORITY_INTERFACES`
- **Doorbell/通話**: `DAILY_API_KEY`, `CALL_UI_BASE_URL`, `DOORBELL_MAX_CALL_DURATION_SEC`
- **IoT バンドル**: `IOT_BUNDLE_BUCKET`, `IOT_BUNDLE_PREFIX`, `IOT_BUNDLE_PRESIGN_EXPIRES_IN`
- **OTA バンドル**: `OTA_BUNDLE_BUCKET`, `OTA_BUNDLE_PREFIX`, `OTA_BUNDLE_PRESIGN_EXPIRES_IN`
- **DynamoDB レジャー**: `DEVICE_LEDGER_TABLE`
- **mTLS キャッシュ**: `MTLS_CERT_CACHE_TTL_SEC`
- **CloudWatch Logs**: `DEVICE_ERROR_LOG_GROUP`
- **内部バッチ/中継**: `RELAY_BASE_URL`

## **Middleware**

### **validationResult（`middlewares/validationResult.js`）**

`express-validator` の検証結果をチェックし、**400** を返す共通ミドルウェア。

### **humanAuth（`middlewares/humanAuth.js`）**

- `requireHumanUser`：`userExternalId` を必須化  
- `requireCustomerIdForAdminUi`：`customerId` を必須化  
- `assertUserCanAccessDevice` / `assertUserCanAccessCustomer`：DB 参照でアクセス確認  
- `requireMasterUser`：`MASTER_USER_EXTERNAL_IDS` による管理者判定

### **internalAuth（`middlewares/internalAuth.js`）**

- `INTERNAL_API_TOKEN` と `x-internal-token` ヘッダを一致確認  
  （`/api/content/media/thumbnail` 等の内部用）

## **エラー方針**

- ルート/サービス層で `err.status` を付けて `next(err)`  
- タイムアウトは **504 相当**で扱うのを推奨（実装上 500 の箇所は今後の改善点）

## **補足**

- `/admin` は **静的 UI の配信用**で、React Router のため `/admin/*` を `index.html` にフォールバックします。  
- サーバは **HTTP + Socket.IO を同一プロセス**で扱います。
