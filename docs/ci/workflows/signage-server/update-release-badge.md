# Update Release Badge（signage-server）

**What**：新規リリース時に Gist の `release.json` を更新（Shields.io のエンドポイント用）  
**When**：`release`（`created`, `published`）  
**Outputs**：Gist 更新（バッジに反映）  
**Permissions**：既定（API は PAT で実施）  
**Concurrency**：なし  
**Secrets**：`GH_PAT`（Gist への PATCH 用；`gist` スコープ）

## **定義（workflow）**

- **ファイル**：`.github/workflows/update-release-badge.yaml`
- **name**：`Update Release Badge`
- **jobs**：`badge`（`ubuntu-latest`）  
  **if 条件**：`${{ !github.event.release.prerelease }}`（プレリリースを除外）

## **Steps**

1) **タグ決定**（`id: vars`）：  
   `release` イベント：`${{ github.event.release.tag_name }}`  
   それ以外：`${GITHUB_REF#refs/tags/}` → `TAG` を `GITHUB_OUTPUT` へ

2) **JSON 生成**（`id: badge`）：`jq` で、以下を `badge.json` に出力  

   ```json
   { "schemaVersion": 1, "label": "release", "message": "<TAG>", "color": "blue" }
   ```

3) **Gist 更新**：`curl -X PATCH`

- **URL**：`https://api.github.com/gists/${GIST_ID}`
- **Header**：`Authorization: Bearer $GH_PAT`
- **Payload**：`{ "files": { "release.json": { "content": "<badge.json の文字列>" } } }`
（`jq -Rs` でファイル内容を文字列化）

!!! note
    - `GIST_ID` は固定値（ワークフロー内で環境変数に設定）。
    - 既存 Gist を**上書き**するため、公開範囲/権限の管理に注意。
    - **プレリリースは無視**（安定版のみバッジ更新）。
