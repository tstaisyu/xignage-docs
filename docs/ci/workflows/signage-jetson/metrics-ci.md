# Metrics CI — `metrics-ci.yaml`

**What**：`scripts/metrics/`（Node.js パッケージ）の **Lint / Format チェック / テスト**を自動実行し、PR と main への品質ゲートを提供する。

## **導入パッケージ**

- `signage-jetson`

## **When（トリガ / 対象）**

- `push` / `pull_request`  
  - `paths: scripts/metrics/**`（メトリクス関連の変更に限定）

## **Permissions / Secrets**

- 追加の権限・Secrets **不要**（デフォルト権限で可）

## **Inputs / Outputs**

- **入力**：`scripts/metrics` 配下のソース / `package-lock.json`
- **出力**：ログ（アーティファクトなし）

## **Steps（処理の流れ）**

1. **Checkout**：`actions/checkout@v4`
2. **Node セットアップ**：`actions/setup-node@v4`  
   - `node-version: 20`  
   - `cache: npm` + `cache-dependency-path: scripts/metrics/package-lock.json`
3. **依存インストール**：`npm ci --prefix scripts/metrics`
4. **Lint**：`npm run --prefix scripts/metrics lint`
5. **Prettier 形式チェック**：`npm run --prefix scripts/metrics format`
6. **Jest テスト**：`npm run --prefix scripts/metrics test`

## **Failure → Fix（よくある失敗と対処）**

- **Lint/Format 失敗**：ローカルで `npm run lint` / `npm run format`（または `format:check`）を実行して修正 → 再push
- **テスト失敗**：`npm test` で再現し、モック・環境変数依存を解消
- **キャッシュ不整合**：`package-lock.json` 更新後は `npm ci` を再実行。CI 側は自動で新キャッシュに更新される
- **Node バージョン差異**：ローカル（または実行環境）と CI の Node バージョンが異なる場合は `.nvmrc` を用意し揃える

## **運用ノート / ベストプラクティス**

- **バージョン整合性**：本番実行バージョン（例：Node 22）と **CI の Node バージョンを一致**させるか、必要なら **Matrix（20 / 22）** で検証
- **並行実行制御（任意）**：古い同ブランチの実行をキャンセル

  ```yaml
  concurrency:
    group: metrics-ci-${{ github.ref }}
    cancel-in-progress: true
  ```

- **フォーマットコマンド**：`format` が書き換えを行う場合は、CI 用に `format:check`**（非破壊）** を用意して使い分ける
- **テストの安定化**：ネットワーク I/O を含む場合は モック化し、CI での flaky を防ぐ
