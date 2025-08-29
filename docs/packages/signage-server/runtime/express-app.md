# Express App（構成）

- 対象ファイル: `app.js`  
- 役割: **Express** のミドルウェア・静的配信・API マウントを一元定義

## **グローバルミドルウェア**

- `cors()`
- `express.json()`, `express.urlencoded({ extended: true })`

## **静的配信**

| URL パス | 実体 | 備考 |
|---|---|---|
| `/admin` | `config.ADMIN_UI_DIR` | SPA。`/admin/*` は `index.html` へフォールバック |
| `/` | `public/`（リポ内） | `express.static(path.join(__dirname, 'public'))` |
| `/` | `config.BUILD_DIR` | ビルド成果物 |
| `/videos` | `config.VIDEOS_DIR` | コンテンツ動画 |
| `/images` | `config.IMAGES_DIR` | コンテンツ画像 |

> `/admin` は `extensions: ['html']`、本番時 `maxAge: '1h'` でキャッシュ。

## **API マウント**

すべて **`/api` プレフィックス**（※一部例外あり）

| Base | ルーター | 概要 |
|---|---|---|
| `/api/kiosk` | `kioskRoutes` | キオスク関連 |
| `/api/test` | `testRoutes` | テスト用 |
| `/api/ai-assist` | `aiAssistRoutes` | AI テキスト |
| `/api/videos` | `videoRoutes` | 動画一覧/再生 |
| `/api/views` | `viewRoutes` | ビュー切替 |
| `/api/config` | `configRoutes` | ローカル設定 取得 |
| `/api/admin/upload` | `adminUploadRoutes` | アップロード（multer） |
| `/api/admin/list` | `adminListRoutes` | 画像/動画リスト |

### **例外（非 `/api`）**

| Path | 役割 |
|---|---|
| `/localPlaylist` | ローカルプレイリスト取得（`main.js` が利用） |
| `/forceKiosk` | Chromium 再起動トリガ（`chromiumManager.forceKiosk()`を呼び出し） |
| `/ping` | 疎通確認（200） |
| `/health` | ヘルス（`{ status: 'ok' }`） |

## **エラーハンドリング**

- **最後尾**で `errorHandler` を `app.use(errorHandler)`  
  現実装は **常に 500** の JSON（詳細: [`api/index.md` のエラーハンドラ節](../api/index.md)）

!!! note
    - **`/localPlaylist` は非 `/api`**：フロント（`main.js`）の fetch 先に合わせた構成。API 整理時は合わせて変更。  
    - **/forceKiosk** は**危険操作**（UI 側の誤操作対策や認証を検討）。
