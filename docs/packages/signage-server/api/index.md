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

## **構成（層）**

| 層            | 役割の要点                                   | ドキュメント |
|---------------|----------------------------------------------|-------------|
| ルーティング   | 入口、パラメータ受け口、簡易バリデーション   | [`api/routes.md`](./routes.md) |
| コントローラー | 具体的な処理呼び出し、Store/Service 連携     | [`api/controllers.md`](./controllers.md) |

> ## **クイックリンク**

- [**Routes 一覧・詳細（早見表つき）**](./routes.md)
- [**コントローラー（対応表・処理の流れ）**](./controllers.md)

## **共通仕様（推奨）**

- **エラー応答の形**（例）:

  ```json
  { "error": { "code": "string", "message": "string", "details": {} } }
  ```

- **ヘッダ例**: `X-Request-Id`, `Cache-Control: no-store`
- **認証/認可**: 現状コードには未実装（必要に応じて今後追加）

## **変更時の注意**

- ルーティングの追加・変更は `api/routes.md` に必ず反映すること
- コントローラーの追加・変更は `api/controllers.md` に必ず反映すること
- 静的ページ配信（`sendFile`）はデプロイ先のディレクトリ構成と相対パスを要確認
- `next(err)` を用いる経路は **共通エラーハンドラ**の整形方針に合わせる
