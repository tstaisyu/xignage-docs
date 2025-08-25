# Build Patches（cumulative `patches_all.zip`）— `build-signage-jetson-patches`

**What**：`patches/*.sh` をまとめて **`patches_all.zip`** を作成し、**最新タグの GitHub Release** に添付する。  
**Who 消費**：`update_runner`（patches 実行フェーズ）。パッチ命名・実行規約は「patches / migrations の実行規約」を参照。

## **導入パッケージ**

- `signage-jetson`

## **When（トリガ / 条件）**

- `push`: `main`、`tags: v*`
- `create`: `tags: v*`
- 既存の Release（対象タグ）がある場合のみ **添付**（なければスキップ）

> 対象タグは `git describe --tags --abbrev=0` の結果（= 直近タグ）。  
> **先に Release TAR ワークフロー**で同タグの Release を作成しておく運用が前提。

## **Permissions / Secrets**

- `permissions: contents: write`
- `GITHUB_TOKEN` を使用（`gh api`・アセット削除/追加）

## **Inputs / Outputs**

- **Inputs**：`patches/*.sh`
- **Outputs（Release Assets）**：`patches_all.zip`（同名アセットは**置換**）

## **Steps（処理の流れ）**

1. **Checkout（fetch-depth: 0）**：タグ参照のため履歴を取得  
2. **Last Tag 抽出**：`git describe --tags --abbrev=0` → `steps.lasttag.outputs.tag`  
3. **パッチの実行権限付与**：`git diff "$LAST"...HEAD -- patches/*.sh | xargs -r chmod +x`  
   - 直近タグ以降に変更のあったパッチに `+x` を付与
4. **ZIP 作成**：`zip -qr patch_bundle/patches_all.zip patches/*.sh`  
5. **Release 存在確認**：`gh api repos/<repo>/releases/tags/<tag>`  
   - 存在すれば `release_id` を取得、`RELEASE_EXISTS=true`  
6. **既存アセット削除**（あれば）：`flcdrg/remove-release-asset-action@v1`（`asset_name: patches_all.zip`）  
7. **ZIP 添付**：`softprops/action-gh-release@v2.3.2`（`tag_name: <lasttag>`）

## **契約（消費側との取り決め）**

- **ファイル名**：`patches_all.zip`（固定）  
- **内容**：`patches/*.sh` をそのまま同梱  
- **実行規約**：パッチは **日時昇順で厳格実行**、成功時に `PATCH_MARK` 更新（詳細は該当ドキュメント参照）

## **Failure → Fix（失敗時の対処）**

- **`git describe` が失敗（タグなし）**  
  - まずタグを作る（例：`v1.0.0`）。必要なら `workflow_dispatch` にフォールバック用入力を追加する運用も検討。
- **`patches/*.sh` が存在しない / グロブ未一致**  
  - ZIP 作成前に存在確認のガードを推奨（例：`shopt -s nullglob` または `find patches -name '*.sh'` で判定）。
- **Release が存在しない**  
  - 本ワークフローは**添付のみ**。先に **Release TAR ワークフロー**で当該タグの Release を作成してから再実行。
- **アセット削除/追加で 403/404**  
  - `permissions: contents: write` と `GITHUB_TOKEN` の権限を確認。対象 `release_id` / `tag_name` の整合性をチェック。
- **`gh` CLI が見つからない**  
  - GitHub Hosted Runner では同梱の想定。必要に応じて `apt-get install gh` または専用 Action を追加。

## **運用ノート / ベストプラクティス**

- **並行実行制御**（任意）  

  ```yaml
  concurrency:
    group: build-patches-${{ github.ref }}
    cancel-in-progress: true
  ```

- **権限付与の網羅**：直近タグ以降に追加されたファイルだけでなく、過去の未実行パッチも含めたい場合は一律で `chmod +x patches/*.sh` を先行してもよい。
- **ZIP の再現性**：ファイル順や改行コードの差異は実行には影響しないが、検証のために生成ログを残すのが無難。
- **スケール**：複数パッケージで共通化する場合は **ファイル名/添付先タグ**の契約を統一し、消費側（`update_runner`）にも同契約を明記。
