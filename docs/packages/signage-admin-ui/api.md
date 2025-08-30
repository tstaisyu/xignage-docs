# API contract

## **サーバ（OpenAPI 準拠）**

- **Spec**：`openai/spec.yaml`
- **servers**
  `https://{deviceId}.local/api`（LAN 経由）
  `https://api.signage.example.com`（クラウド経由）

## **呼び出しパスの対応関係**

- **フロント実装**：`/api/admin/*` を使用  
  例：アップロード `POST /api/admin/upload`、一覧 `GET /api/admin/list`（SWR キー）
- **OpenAPI 定義**：`/api/v1/*` を使用  
  例：`POST /api/v1/upload`、`POST /api/v1/play`、`GET /api/ping`

!!! warning "リライト前提"
    本番配信では **リバースプロキシで** `/api/admin/*` → `/api/v1/*` に写像してください（例：`rewrite ^/api/admin/(.*)$ /api/v1/$1`）。  
    また、**`GET /api/admin/list` は OpenAPI に未記載**の実装補助 API です。

!!! note "Ping パスの整合"
    OpenAPI は `GET /api/ping` を定義しています。一方、フロントの `useLanDetect` は `https://{VITE_DEVICE_ID}.local/ping` を叩く実装です。  
    **どちらかに統一**（`/api/ping` を使う or `/ping` を `/api/ping` にプロキシ）してください。

## **エンドポイント（OpenAPI 要約）**

> ### **`GET /api/ping`**

- 用途：ヘルスチェック（`useLanDetect`）
- 成功：`200 OK`（ボディなし）

> ### **`POST /api/v1/upload`**

- 用途：メディアアップロード（multipart/form-data）
- フィールド：`file`（binary）
- 成功：`201` + `UploadResponse { id, name, size }`

> ### **`POST /api/v1/play`**

- 用途：端末でのメディア再生
- ボディ：`PlayRequest { fileId: string, loop: boolean }`
- 成功：`200 Accepted`

## **フロントからの呼び出し例**

```ts
// Upload（フロント実装）
const fd = new FormData();
fd.append('file', file);
await fetch('/api/admin/upload', { method: 'POST', body: fd });

// List（SWR）
const fetcher = (url: string) => fetch(url).then(r => r.json());
useSWR('/api/admin/list', fetcher);
```
