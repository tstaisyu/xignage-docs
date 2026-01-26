# Express App（構成）

- 対象ファイル: `app.js`  
- 役割: **Express** のミドルウェア・静的配信・API マウントを一元定義

## **グローバルミドルウェア**

- `cors()`
- `express.json()`, `express.urlencoded({ extended: true })`

## **静的配信**

| URL パス | 実体 | 備考 |
| --- | --- | --- |
| `/` | `public/`（リポ内） | `express.static(path.join(__dirname, 'public'))` |
| `/` | `build/`（リポ内） | `express.static(config.BUILD_DIR)` |
| `/videos` | `config.VIDEOS_DIR` | コンテンツ動画 |
| `/images` | `config.IMAGES_DIR` | コンテンツ画像 |

!!! note
    - **`/admin` SPA 配信は現行実装に存在しません**（管理 UI は別パッケージ運用）。
    - `public/` と `build/` の両方を静的配信します（`build/` が空の場合は 404）。

## **API マウント**

すべて **`/api` プレフィックス**（※一部例外あり）

| Base | ルーター | 概要 |
| --- | --- | --- |
| `/api/kiosk` | `kioskRoutes` | キオスク HTML 配信 |
| `/api/test` | `testRoutes` | テスト用エンドポイント |
| `/api/views` | `viewRoutes` | ビュー切替 |
| `/api/config` | `configRoutes` | ローカル設定取得 |
| `/api/doorbell` | `doorbellRoutes` | ドアベル関連 |

### **例外（非 `/api`）**

| Path | 役割 |
| --- | --- |
| `/localPlaylist` | ローカルプレイリスト取得（`bootstrap.js` が利用） |
| `/forceKiosk` | Chromium 再起動トリガ（`chromiumManager.forceKiosk()`） |
| `/ping` | 疎通確認（200） |
| `/health` | ヘルス（`{ status: 'ok' }`） |
| `/welcome.html` | `/kiosk.html` へ 302 リダイレクト |

## **エラーハンドリング**

- **最後尾**で `errorHandler` を `app.use(errorHandler)`

!!! note
    - **`/localPlaylist` は非 `/api`**：フロント（`bootstrap.js`）の fetch 先に合わせた構成。  
    - **/forceKiosk** は**危険操作**（UI 側の誤操作対策や認証を検討）。
