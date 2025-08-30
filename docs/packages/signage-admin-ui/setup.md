# セットアップ（開発/ビルド/配信）

## **概要**

- Vite（React + TS）構成。**ベースパスは `/admin`**。
- Dev では **バックエンドを `http://localhost:3000`** と想定し、`/api` & `/socket.io` をプロキシ。

## **使い方（開発）**

```bash
# 1) Corepack / pnpm セットアップ（必要に応じて）
corepack enable

# 2) 依存導入（CI と揃えるなら）
pnpm install --frozen-lockfile

# 3) 開発サーバ（既定 http://localhost:5173）
pnpm dev
```

## **前提・環境変数（Vite）**

- **キーは `VITE_` 接頭辞が必須**
- LAN 検知用に `VITE_DEVICE_ID`を使用（`useLanDetect.ts`）

```dotenv
# .env.development / .env.production の例
VITE_DEVICE_ID=device-1234
VITE_API_BASE_URL=http://localhost:8080
```

## **Vite 設定（vite.config.ts 抜粋）**

```ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
  base: '/admin/',
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
```

- **Dev 時**：フロントは 5173、API と Socket.IO は **3000** にプロキシ
- **本番配信**：`/admin/` ベースに静的配信（`base` と Router `basename` が一致）

## **ビルド**

```bash
pnpm build     # → dist/ に成果物生成
pnpm preview   # ローカルで dist を配信して最終確認
```

## **Nginx 配信例**

```nginx
server {
  listen 3000;
  server_name _;
  root /opt/signage-admin-ui;   # dist を配置
  index index.html;

  # SPA のためリロード対応
  location /admin/ {
    try_files $uri /admin/index.html;
  }

  # API はバックエンドへプロキシ（例）
  location /api/admin/ {
    proxy_pass http://127.0.0.1:8080/;
  }

  # Socket.IO（例：/admin 名前空間を同一ホストに転送）
  location /socket.io/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass http://127.0.0.1:8080;
  }
}
```

## **index.html（要点）**

- ルート要素：`<div id="root"></div>`
- エントリ：`<script type="module" src="/src/main.tsx"></script>`
- ビルド後は Vite が適切に書き換え

## **生成/変更されるもの**

- `dist/`：静的配信物（HTML/JS/CSS/アセット）
- 本番サーバへは `dist/` のみ配置（通常はアプリケーション側で書き換え不要）

!!! warning "ベースパスの不一致"
    `basename="/admin"` に対し、Nginx 側の `try_files` が `/index.html`（ルート）になっていると 404 が発生します。
