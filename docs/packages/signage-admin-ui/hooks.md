# フック

> ## **useJwt（`src/hook/useJwt.ts`）**

- クエリ文字列 `?token=...` を検出して `localStorage('jwt')` に保存し、状態として返す

### **使い方**

```ts
const jwt = useJwt(); // string | null
```

> **実施内容**

1) マウント時に `location.search` から `token` を取得

2) あれば `localStorage('jwt')` に保存

3) `jwt` ステートに格納して返す

!!! warning "セキュリティ"
    `localStorage` 保管は XSS に対して脆弱です。必要ならメモリ保持や `HttpOnly` Cookie への切替を検討。

> ## **isLanReachable（`src/hook/useLanDetect.ts`）**

- `VITE_DEVICE_ID` を用いた `.local` ドメイン（`https://{id}.local/ping`）の疎通チェック

### **API**

```ts
export const isLanReachable = async (timeout = 1000): Promise<boolean>;
```

> **実施内容**

- `AbortController` で `timeout` ミリ秒後に中断
- 成功→`true`、失敗→`false`

!!! note "証明書"
    `https://*.local` の証明書は環境により警告となる場合があります。運用ポリシーに合わせて HTTP/TLS を選定してください。

> ## **useUpload（`src/hook/useUpload.ts`）**

- 選択/ドロップされたファイルを **逐次** `POST /api/admin/upload` へ送信
- 成功時はトースト表示、SWR `mutate()` で `/api/admin/list` を再検証

### **返り値**

```ts
{ files: File[]; startUpload: (accepted: File[]) => Promise<void>; }
```

> **処理の流れ**

1) `accepted` の各 `File` を `new FormData()` に詰め、`fd.append('file', file)` する

2) `fetch('/api/admin/upload', { method: 'POST', body: fd })`

3) `res.ok`：`toast.success`、`files` に追加、`mutate()`

4) 失敗：`res.text()` をエラーメッセージとして `toast.error`

5) 例外：`toast.error('Network error')`

!!! tip "並列化"
    現状は逐次ループ。大容量/多数ファイルの場合は並列度や再試行ポリシーを検討してください。
