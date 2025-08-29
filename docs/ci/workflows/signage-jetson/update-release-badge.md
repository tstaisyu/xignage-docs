# Update Release Badge — `update-release-badge.yaml`

**What**：新しい **Release（正式版）** が公開されたタイミングで、`<latest tag>` を埋め込んだ **Shields.io 互換 JSON** を生成し、指定 **Gist** の `release.json` を更新して **動的バッジ**を最新化する。

## **導入パッケージ**

- `signage-jetson`

## **When（トリガ / 対象）**

- `on: release`（`created`, `published`）
- `if: !github.event.release.prerelease` により **プレリリースは除外**（RC/βは対象外）

## **Permissions / Secrets**

- リポ側の追加権限は不要（Gist 更新は **PAT** で実施）
- **必要な Secrets**
  - `GH_PAT`：**gist スコープ**を付与した Personal Access Token
- **環境変数**
  - `GIST_ID`：更新対象 Gist の ID（ワークフロー内で固定値）

> `GITHUB_TOKEN` は Gist API には使えないため **PAT 必須**。

## **Inputs / Outputs**

- **Input**：`release.tag_name`（イベントから取得）
- **Output**：Gist `release.json`（Shields.io endpoint 用 JSON）

  ```json
  { "schemaVersion":1, "label":"release", "message":"vX.Y.Z", "color":"blue" }
  ```

### **Steps（処理の流れ）**

1. **タグ取得**
   - リリースイベントから `github.event.release.tag_name` を取得し、`TAG` として出力。
   - ログに最新タグを出力して可視化。

2. **Badge JSON の生成**
   - `jq` を用いて Shields.io 互換の JSON を組み立て、`badge.json` に保存。
   - 例：`{schemaVersion:1,label:"release",message:"vX.Y.Z",color:"blue"}`

3. **Gist へ PATCH**
   - `badge.json` を **生文字列**として読み込み、`files.release.json.content` に格納する payload を作成。
   - `curl -X PATCH https://api.github.com/gists/${GIST_ID}` に `Authorization: Bearer $GH_PAT` を付与して更新。

### **Failure → Fix（よくある失敗と対処）**

- **401 / 403（Unauthorized / Forbidden）**
  - `GH_PAT` が無効・権限不足（`gist` スコープ必須）・期限切れの可能性。PAT を再発行し Secrets を更新。

- **404（Gist Not Found）**
  - `GIST_ID` が誤り、または削除済み。Gist の可用性と ID を再確認（Secret Gist でも API 更新は可）。

- **プリリリースで動かない**
  - ワークフローに `if: !github.event.release.prerelease` があるため仕様通り。RC/βにも反映したい場合は条件を調整。

- **バッジが古いまま**
  - Shields 側のキャッシュ。バッジ URL に `?cacheSeconds=300` 等を付与、もしくは数分待機。Gist の `release.json` が更新済みかを確認。

- **`jq` が見つからない**
  - まれにランナーのミニマルイメージで不足。`sudo apt-get update && sudo apt-get install -y jq` を前段に追加。

- **`GH_PAT` 未設定**
  - Secrets に `GH_PAT` を追加（リポ or Org 単位）。権限は **gist のみ**に最小化。

### **運用ノート / ベストプラクティス**

- **Shields 埋め込み例（README / Docs）**

  ```markdown
  ![release](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<USER>/<GIST_ID>/raw/release.json&cacheSeconds=300)
  ```

- **PAT の最小権限**
  `GH_PAT` は **gist スコープのみ**付与。定期ローテーション・監査ログの確認を運用に組み込む。
- **並行実行の抑止（任意）**

  ```yaml
  concurrency:
  group: release-badge-${{ github.ref }}
  cancel-in-progress: true
  ```

- **表示文言/色のカスタム**
  `label`, `color` は `jq` 生成時に固定化。製品ラインや環境（prod/stg）で色分けも可能。
- **多言語・複数バッジ**
  同一 Gist の `files` に `release.json`, `release-ja.json` など複数ファイルを持たせ、用途別にエンドポイントを分ける。
- **手動テスト**
  `workflow_dispatch` を併設して、タグ無しでも一時的な JSON を発行→Gist 反映テストが可能（本番運用では release イベント運用を主とする）。
