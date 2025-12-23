# API 概要

本パッケージの HTTP API レイヤ（Express）は、**ルーティング（routes）** を入口として、必要に応じて **Controller / Service** に処理を委譲します。  
静的ページ配信（`sendFile`）と JSON API が混在します。

- **想定 Base URL**: `/api`（最終的なパスは `app.use()` のマウント設定に依存）
- **主な責務**:
  ルーティング定義、簡易バリデーション、入出力整形
  ビジネスロジックは Controller / Service に委譲
- **戻り形式**:
  JSON API: `application/json`
  静的ページ: `text/html`
- **エラー処理**: 一部エンドポイントは `next(err)` により `middlewares/errorHandler.js` へ委譲

!!! note "実パスの確定"
    ここに記載のパスは **ルーター内の相対パス**です。実際の URL はアプリ側のマウント構成（`app.use('/api/...', router)`）により決まります。

## 構成（層）

| 層 | 役割の要点 | ドキュメント |
| --- | --- | --- |
| ルーティング | 入口、パラメータ受け口、簡易バリデーション | [`api/routes.md`](./routes.md) |
| コントローラー | 具体的な処理呼び出し、Store/Service 連携 | [`api/controllers.md`](./controllers.md) |

> ## クイックリンク

- [**Routes 一覧・詳細（早見表つき）**](./routes.md)
- [**コントローラー（対応表・処理の流れ）**](./controllers.md)

## 共通仕様（推奨）

- **エラー応答の形**（例）:

  ```json
  { "error": { "code": "string", "message": "string", "details": {} } }
  ```

- **ヘッダ例**: `X-Request-Id`, `Cache-Control: no-store`
- **認証/認可**: 現状コードには未実装（必要に応じて今後追加）

### エラーハンドラ（`middlewares/errorHandler.js`）

Express のエラー処理用ミドルウェア。スタックをログ出力し、Express の `res` でない場合は `next(err)` に委譲。既定では **HTTP 500** を JSON で返す。

> **応答仕様（現実装）**

```json
{ "error": "Internal Server Error または err.message" }
```

> **処理の流れ**

1) `console.error(err.stack)` でスタックを出力  

2) `!res || typeof res.status !== 'function'` の場合は警告ログを出して `next(err)` へ委譲  

3) `res.status(500).json({ error: err.message || 'Internal Server Error' })` を返却

!!! note
    - 現実装は **常に 500** を返します。入力エラー等で **4xx** を返したい場合は、各ルートで明示的に `res.status(...).json(...)` するか、**エラークラス→HTTPステータス**のマッピングを本ミドルウェアに追加してください。  
    - スタック等の機微情報は **レスポンスに含めない**（ログのみ）。本番では `err.message` の詳細露出も最小化を検討。  
    - 推奨フォーマット（`{ error: { code, message, details } }`）に合わせる場合、本ミドルウェアで **ラップ**してください。  
    - Express のエラーハンドラは **最後に `app.use(errorHandler)`** で登録すること（順序依存）。  
    - Multer 等のミドルウェア由来エラー（例：`LIMIT_FILE_SIZE`）を **個別に 4xx/413** へ変換する処理を追加すると UX が向上します。

## 変更時の注意

- ルーティングの追加・変更は `api/routes.md` に必ず反映すること
- コントローラーの追加・変更は `api/controllers.md` に必ず反映すること
- 静的ページ配信（`sendFile`）はデプロイ先のディレクトリ構成と相対パスを要確認
- `next(err)` を用いる経路は **共通エラーハンドラ**の整形方針に合わせる
