# CI / GitHub Actions（signage-aws-nodejs）

本パッケージの CI は以下の 3 ワークフローで構成されます。

- **AWS Node.js CI**：fmt / lint / test を実行（PR/Push）
- **License Check**：依存ライセンスのスキャン（PR/Push）
- **Update Release Badge**：Release 公開時に Gist のバッジ JSON を更新

## **ポリシー（共通運用）**

- **最小権限**：`permissions` は既定（`contents: read`）を基本とする  
- **再現性**：CI では **`npm ci` 推奨**（lockfile 固定）  
- **Node バージョン**：`22`（`actions/setup-node` にて固定）  
- **失敗早期化**：fmt/lint/test のいずれか失敗でジョブを停止  
- **シークレット管理**：`GH_PAT` は **必要最小スコープ（gist）**で保存

※ メンテ時の改善候補：npm キャッシュ（`actions/cache`）、`concurrency` による同一ブランチの重複キャンセル

> ## **1) AWS Node.js CI（`aws-nodejs-ci.yaml`）**

**What**：`npm run fmt` → `npm run lint` → `npm test`  
**When**：`push` / `pull_request`（`main`）  
**Env**：`ubuntu-latest`、Node `22`

**ステップ**  

1) `actions/checkout@v3`

2) `actions/setup-node@v3`（`node-version: '22'`）

3) `npm install`（※再現性重視なら `npm ci` へ置換推奨）

4) `npm run fmt`

5) `npm run lint`

6) `npm test`

**前提（package.json）**  

- `scripts.fmt` / `scripts.lint` / `scripts.test` が定義されていること

!!! note
    - lockfile 運用中は `npm ci` の方が**早く確実**です  
    - 並列ワークフローが多い場合は `concurrency` の導入を検討

> ## **2) License Check（`license-check.yaml`）**

**What**：依存パッケージのライセンス検査（`npm run check:license`）  
**When**：`push` / `pull_request`  
**Env**：`ubuntu-latest`、Node `22`

**ステップ**  

1) `actions/checkout@v4`

2) `actions/setup-node@v4`（`node-version: 22`）

3) `npm ci`

4) `npm run check:license`

**前提**  

- `scripts.check:license` が `license-checker` などのツールを呼び出すこと  
- 出力を CI アーティファクト化・PR コメント化するとレビュー効率が上がる

> ## **3) Update Release Badge（`update-release-badge.yaml`）**

**What**：Release 公開時（非プレリリース）に **Gist の `release.json` を更新**  
**When**：`on: release: [published]`（`if: !prerelease`）  
**Secrets**：`GH_PAT`（**gist スコープのみ**）  
**Vars**：`GIST_ID`（対象 Gist ID）

**ステップ**  

1) **タグ取得**：`${{ github.event.release.tag_name }}` を `GITHUB_OUTPUT` へ

2) **JSON 生成**：`jq` で Shields.io 互換の endpoint JSON を作成  

   ```json
   { "schemaVersion":1, "label":"release", "message":"vX.Y.Z", "color":"blue" }
   ```

3) **Gist 更新**：`curl -X PATCH` で `release.json` を差し替え

**運用メモ**  

- Gist への書き込みは PAT（GH_PAT）で実施。権限は gist のみに限定
- バッジ画像は Shields の endpoint で参照可能（例：<https://img.shields.io/endpoint?url=><raw_json_url>）
- プレリリース時は実行されない（if: !prerelease）
