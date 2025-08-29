# Release TAR / Patches — `release-tar-and-patches`

**What**：リポのソースから **配布用 tar.gz** を生成し **GitHub Release に添付**、あわせて **patches_all.zip**（累積パッチ）を作成して同じ Release に添付する。  
**Who 消費**：`update_runner` / `update.sh` が **asset API** 経由で取得（ファイル名・配置が契約）。

## **導入パッケージ**

- `signage-jetson`

## **When（トリガ / 条件）**

- `push`（タグ `v*.*.*`）  
- `workflow_dispatch`（手動）  
- `if: ${{ !contains(github.ref, '-') }}` により **プリリリース（`-rc`,`-beta` などハイフン付きタグ）を除外**  
  → RC ビルドは **手動トリガ**で実行可能

## **Permissions / Secrets**

- `permissions: contents: write`（Release 作成・更新に必要）
- `with.token: ${{ secrets.GH_PAT_RELEASE }}`（`softprops/action-gh-release` 用）  
  - 代替：`GITHUB_TOKEN` でも動作可能（権限は `contents: write` 必須）
- PAT を使う場合は **repo:write に最小化**、ローテーション運用

## **Inputs / Outputs**

- **Inputs**：なし
- **Outputs（Release Assets）**
  - `signage-scripts.tar.gz`（配布物）
  - `signage-scripts.tar.gz.sha256`（整合性検証用）
  - `patch_bundle/patches_all.zip`（累積パッチ）

## **Steps（処理の流れ）**

### **Job 1: build-and-release**

1. **Checkout**
2. **VERSION 注入**：タグ名と日付で `VERSION.txt` を生成（タグ push 時のみ）
3. **tar.gz 作成**  
   - 収録：`migrations/`, `scripts/`, `setup_all.sh`, `update.sh`, `web/wifi_manager.py`, `static/index.html`, `static/index_autoresearch.html`, `VERSION.txt`  
   - 一時コピー：`static/index.html → ./index.html`, `web/wifi_manager.py → ./wifi_manager.py`（収録のため）  
   - 除外：`.github/`, `*.md`, バックアップ/スワップなど
4. **SHA256 生成**：`signage-scripts.tar.gz.sha256`
5. **Release へアップロード**（作成 or 更新）  
   - `tag_name: ${{ github.ref_name }}`  
   - `generate_release_notes: true`  
   - `append: true`（既存アセットに追記）

### **Job 2: build-patch（needs: build-and-release）**

1. **Checkout（fetch-depth: 0）**
2. **パッチ実行権限付与**：`patches/*.sh` に `+x`
3. **累積 ZIP 作成**：`patch_bundle/patches_all.zip`（`patches/*.sh` をまとめる）
4. **Release へアップロード**（同タグに添付）  
   - `append: true`（既存のアセットを保持）  
   - ※ `remove_assets` の挙動は **アクションのバージョン実装に依存**。未サポートなら手動削除 or 専用ステップで削除を検討

## **契約（消費側との取り決め）**

- **ファイル名**：`signage-scripts.tar.gz` / `.sha256`、`patches_all.zip`  
- **検証**：ダウンロード後に **`sha256sum -c`** を実施  
- **バージョン**：`VERSION.txt` に **タグ名 + UTC 日付** を記録（配布物内）

## **Failure → Fix（失敗時の対処）**

- **401/403（Release への upload 失敗）**  
  - `contents: write` 権限 / `GH_PAT_RELEASE` のスコープ確認、または `GITHUB_TOKEN` に切替
- **`zip` で失敗 / `patches/*.sh` が存在しない**  
  - パッチ未運用のリポでは **ガード**を追加（例：`shopt -s nullglob` または `if ls patches/*.sh 2>/dev/null; then ... fi`）
- **プリリリースタグで動かない**  
  - `if: !contains(github.ref, '-')` により除外。RC は `workflow_dispatch` で手動実行
- **アセット重複 / 置換されない**  
  - `append: true` は **追記**。置換が必要ならアップロード前に **同名アセット削除**のステップを追加
- **`VERSION.txt` の欠落**  
  - タグ以外（手動実行）では生成されない。必要なら `workflow_dispatch` に入力パラメータを設けて注入

## **運用ノート / ベストプラクティス**

- **並行実行制御**（任意）：古い実行をキャンセル

  ```yaml
  concurrency:
    group: release-tar-${{ github.ref }}
    cancel-in-progress: true
  ```

- **サイズと内容の見直し**：tar に **不要なファイル（テスト・ドキュメント）を含めない**
- **再現性**：`-euxo pipefail` により失敗を早期検出、アーカイブの **生成順/権限**も定期チェック
- **安全性**：配布物に **秘密情報や内部設定を含めない**（例：`/etc/signage/secret.env` の類は収録しない）
- **一貫性**：`update_runner` 側の **期待パス/ファイル名** と変更がないか **PR でレビュー必須**
