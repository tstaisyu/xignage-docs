# Server CI（signage-server）

**What**：Lint / Format / Test を中心とした CI（Node）  
**When**：`push`（`main`）/ `pull_request`（`main`）  
**Inputs/Outputs**：入力なし / 出力なし（ログのみ）  
**Permissions**：既定（`contents: read`）  
**Concurrency**：なし

## **定義（workflow）**

- **ファイル**：`.github/workflows/server-ci.yaml`
- **name**：`Server CI`
- **jobs**：`build`（`ubuntu-latest`）

## **Steps**

1) **Checkout**：`actions/checkout@v2`  

2) **Node セットアップ**：`actions/setup-node@v2`（`node-version: '22'`）  

3) **依存導入**：`npm install`  

4) **Format**：`npm run fmt`  

5) **Lint**：`npm run lint`  

6) **Test**：`npm test`

!!! note
    - 速度・再現性向上のため、将来的に  
      `actions/checkout@v4` / `actions/setup-node@v4` への更新  
      `npm ci` + `cache: 'npm'` の導入  
    を推奨。
