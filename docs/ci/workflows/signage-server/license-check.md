# License Check（signage-server）

**What**：Node 依存のライセンス検査を実行（`npm run check:license`）  
**When**：`push` / `pull_request`  
**Inputs/Outputs**：入力なし / 出力なし（ログのみ）  
**Permissions**：既定（`contents: read`）  
**Concurrency**：なし

## **定義（workflow）**

- **ファイル**：`.github/workflows/license-check.yaml`
- **name**：`license-check`
- **jobs**：`scan`（`ubuntu-latest`）

## **Steps**

1) **Checkout**：`actions/checkout@v4`  

2) **Node セットアップ**：`actions/setup-node@v4`（`node-version: 22`）  

3) **依存導入**：`npm ci`  

4) **ライセンス検査**：`npm run check:license`

!!! note
    - 依存が大きい場合は `setup-node` の `cache: npm` を検討。
