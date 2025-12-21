# セットアップ（開発/ビルド/配信）

## 概要

- Vite（React + TS）構成。**ベースパスは `/admin`**。
- Dev では **`/api` → `http://localhost:3000`** にプロキシ（`vite.config.ts`）。
- 本番配信は **`/admin/` ベースの SPA** を静的配信する。

## 開発

```bash
corepack enable
pnpm install
pnpm dev
```

- 既定: `http://localhost:5173/admin/`
- API は Vite プロキシ経由で `http://localhost:3000` に転送

## テスト

```bash
pnpm test
```

- Vitest 実行（`vitest run`）
- 設定は `vite.config.ts` の `test` セクション参照

## ビルド / 配信

```bash
pnpm build
pnpm preview
```

- `dist/` に成果物を生成
- `pnpm preview` は `dist/` をローカルで配信

### signage-server へコピーする場合

```bash
pnpm build:server
```

- `dist/` を `../signage-server/public/admin/` に同期
- 参照: `signage-admin-ui/package.json`

## 環境変数（Vite）

| 変数名 | 用途 | 参照 |
| --- | --- | --- |
| `VITE_SIGNAGE_API_BASE_URL` | API ベース URL（空なら同一オリジン） | `signage-admin-ui/src/page/*.tsx`, `signage-admin-ui/src/hook/useUpload.ts` |
| `VITE_ADMIN_MASTER_PASSWORD` | 管理者 UI のログインパスワード | `signage-admin-ui/src/context/AdminAuthContext.tsx` |
| `VITE_DEVICE_ID` | LAN 検知用（現行 UI 未使用） | `signage-admin-ui/src/hook/useLanDetect.ts` |

```dotenv
# .env.development の例
VITE_SIGNAGE_API_BASE_URL=http://localhost:3000
VITE_ADMIN_MASTER_PASSWORD=your-admin-password
```

!!! note "MediaList のデフォルト API"
    `MediaList` のみ `VITE_SIGNAGE_API_BASE_URL` が未設定の場合に
    `https://api.xrobotics.jp` をデフォルトとしている。  
    参照: `signage-admin-ui/src/page/MediaList.tsx`

## Vite 設定（抜粋）

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

- Dev 時: `/api` をローカル API に転送
- 本番: `/admin/` で静的配信（`base` と Router `basename` の整合が必要）
