# フック

## useUpload（`signage-admin-ui/src/hook/useUpload.ts`）

- 署名付き URL を使ったクラウドアップロードを担当
- 3 ステップ構成: `upload-url` → S3 PUT → `complete-upload`
- 動画の場合は duration を自動計測して送信
- `createdByUserId` は `admin-ui` 固定

### 返り値

```ts
{
  files: File[];
  startUpload: (accepted: File[]) => Promise<void>;
  progress: number | null;
  currentIndex: number | null;
  totalCount: number | null;
}
```

### 主要フロー

1) `POST /api/content/media/upload-url` で署名 URL を取得
2) `PUT uploadUrl` でファイルをアップロード
3) `POST /api/content/media/complete-upload` で完了登録

## useJwt（`signage-admin-ui/src/hook/useJwt.ts`）

- クエリ `?token=...` を `localStorage('jwt')` に保存
- 現行 UI では未使用

```ts
const jwt = useJwt(); // string | null
```

## isLanReachable（`signage-admin-ui/src/hook/useLanDetect.ts`）

- `https://${VITE_DEVICE_ID}.local/ping` の疎通確認
- 現行 UI では未使用（LAN/ローカル利用の名残）

```ts
export const isLanReachable = async (timeout = 1000): Promise<boolean>;
```
