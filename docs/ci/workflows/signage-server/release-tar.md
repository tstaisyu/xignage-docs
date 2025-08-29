# Release TAR（signage-server）

**What**：`signage-server.tar.gz` を作成し GitHub Release に添付（`.sha256` 生成含む）  
**When**：`push` の **タグ**（`v*.*.*`） / `workflow_dispatch`（手動）  
**Outputs**：`signage-server.tar.gz`、`signage-server.tar.gz.sha256`（Release Assets）  
**Permissions**：`contents: write`（明示）  
**Concurrency**：なし  
**Secrets**：`GH_PAT_RELEASE`（Release へのアップロードに使用）

## **定義（workflow）**

- **ファイル**：`.github/workflows/release-tar.yaml`
- **name**：`release-zip`
- **jobs**：`build-and-release`（`ubuntu-latest`）  
  **if 条件**：`${{ !contains(github.ref, '-') }}`（`-rc` 等のハイフン付きタグを除外）

## **Steps**

1) **Checkout**：`actions/checkout@v4`  

2) **Node セットアップ**：`actions/setup-node@v4`（`node-version: 22`, `cache: 'npm'`）  

3) **依存導入**：`npm ci`  

4) **Dev 依存削除**：`npm prune --omit=dev`  

5) **タグ版へ同期**（タグ時のみ）：`npm pkg set version="${TAG#v}"`  

6) **bundle/ を作成**：`rsync -a --delete` で `.git`/`.github`/`uploads`/`playlists`/`*.md` を除外してコピー  

7) **圧縮**：`tar -czf signage-server.tar.gz -C bundle .`（同じ除外指定を適用）  

8) **チェックサム**：`sha256sum signage-server.tar.gz > signage-server.tar.gz.sha256`  

9) **Release へアップロード**：`softprops/action-gh-release@v2.2.2`  
   **files**：`signage-server.tar.gz` / `.sha256`  
   **generate_release_notes: true`**  
   **token**：`${{ secrets.GH_PAT_RELEASE }}`

!!! note
    - タグ名からバージョンを **package.json に反映**（`v1.2.3` → `1.2.3`）。  
    - 除外対象（`uploads`/`playlists`/`*.md`）は配布物の最小化目的。必要に応じて見直す。
