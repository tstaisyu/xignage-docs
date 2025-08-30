# CI / GitHub Actions

本パッケージの CI は以下で構成されています。

- **Test Admin UI**（単体テスト・E2E・ビルド・静的検査）
- **Build Admin UI tar.gz**（リリース用アーカイブ生成 & GH Release）
- **license-check**（依存ライセンススキャン）
- **Update Release Badge (admin-ui)**（Gist のリリースバッジ更新）

## **Test Admin UI（`.github/workflows/test.yml`）**

**トリガ**：`push`（`main`）  
**ランナー**：`ubuntu-latest`  
**使用ツール**：pnpm（v10）

**主なステップ**  

1) リポチェックアウト：`actions/checkout@v4`  

2) pnpm セットアップ：`pnpm/action-setup@v3 (version: 10)`  

3) 依存導入：

   ```bash
   pnpm install --frozen-lockfile
   # PNPM_ENABLE_PREPOSTINSTALL_SCRIPTS は true（環境変数）
   ```

4) Lint：`pnpm lint`

5) Prettier：`pnpm fmt`

6) 単体テスト & カバレッジ：`pnpm test:ci`
`vitest.setup.ts` にて後処理とポリフィル（`ResizeObserver` / PointerCapture スタブ）

7) ビルド：`pnpm build`

8) Cypress バイナリ取得：`pnpm exec cypress install`

9) **E2E（Cypress）**：

- Action：`cypress-io/github-action@v6`
- 起動：`start: pnpm start`
- **待機**：`http://localhost:3000（wait-on-timeout: 120000）`
- 実行：`pnpm exec cypress run --browser chrome`

!!! note "開発/テストでのポート設計"
    Vite 開発サーバは 5173。E2E は `pnpm start` で **UI を 3000 に起動**し、それを待機。
    （開発時の Vite は `/api` と `/socket.io` を **3000 のバックエンド**へプロキシ）

## **Build Admin UI tar.gz（`.github/workflows/build-release.yml`）**

**トリガ**：`push` の **タグ** `v*` / `workflow_dispatch`  
**権限**：`permissions: contents: write`（GH Release へのアップロード用）  

**主なステップ**  

1) チェックアウト / pnpm セットアップ

2) 依存導入 + ビルド：

   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   ```

3) `dist/VERSION.txt` 生成（タグ時のみ, UTC 日付付き）

4) **アーカイブ生成**：

   ```bash
   cd dist && tar -czf ../admin-ui.tar.gz .
   ```

5) **チェックサム**（SHA-256）生成

6) **GH Release アップロード**：`softprops/action-gh-release@v2`

- `files`: `admin-ui.tar.gz` / `admin-ui.tar.gz.sha256`
- `generate_release_notes: true`

!!! tip "シェル厳格化"
    `defaults.run.shell: bash -euxo pipefail {0}` をジョブに設定済み。

## **license-check（`.github/workflows/license-check.yml`）**

**トリガ**：`push` / `pull_request`  
**ランナー**：`ubuntu-latest`  

**主なステップ**  

1) チェックアウト

2) Node 22：`actions/setup-node@v4`

3) `corepack enable`（pnpm 有効化）

4) 依存導入：`pnpm install --frozen-lockfile`

5) **ライセンス検査**：`pnpm run check:license`

!!! note "成果物の扱い"
    スキャン結果（例：ORT の `analyzer-result.yml` 等）は **公開ドキュメントに含めない**方針。リポ内/社内参照に留める。

## **Update Release Badge（`.github/workflows/update-release-badge.yml`）**

**トリガ**：`push` のタグ `v*.*.*` / `release: published`
**目的**：最新リリースタグを Gist（JSON）に反映し、バッジとして利用

**主なステップ**  

1) **タグ名の決定**（push or release イベントで条件分岐）

2) **バッジ JSON 生成**（`jq`）：

   ```json
   { "schemaVersion":1, "label":"release", "message":"<TAG>", "color":"blue" }
   ```

3) **Gist 更新**（`curl -X PATCH`）：

- ファイル名：`signage-admin-ui-release.json`
- **環境変数**：
  `GIST_ID`: ...
  `GH_PAT`: `secrets.GH_PAT`（**Scope**: `gist`）

!!! warning "シークレット"
    `GH_PAT` は **Gist 更新に十分なスコープ**（`gist`） を付与。リポ書き込みは不要。

## **共通ポリシー（推奨）**

- **最小権限**：原則 `contents: read`。Release アップロード時のみ `contents: write`。
- **再現性**：`pnpm install --frozen-lockfile` / `bash -euxo pipefail`。
- **PR ゲート**：`lint` / `fmt` / `test:ci` / `build` を必須化で品質担保。
