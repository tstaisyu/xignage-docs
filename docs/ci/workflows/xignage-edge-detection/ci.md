# CI / GitHub Actions（xignage-edge-detection）

本パッケージの CI は次の 3 ワークフローで構成されます。

- **Test**：フォーマット/リント/ユニットテスト（Python マトリクス）
- **release-tar**：タグ push 時に `tar.gz` を生成して Release へ添付（`pyproject.toml` の version をタグに同期）
- **update-release-badge**：Release 作成/編集時に Gist のバッジ JSON を更新

## **ポリシー（共通運用）**

- **最小権限**：`permissions` は必要箇所のみ（Release 作成ジョブで `contents: write`）
- **再現性**：Python は **バージョンマトリクス**で検証、依存は `requirements-dev.txt` とし本体は `pip install -e . --no-deps`
- **キャッシュ**：`actions/cache` で `~/.cache/pip` をキャッシュ
- **ネイティブ依存**：`dlib`/OpenCV 系のため **`build-essential` / `cmake`** をインストール
- **シークレット**：`update-release-badge` / `release-tar` は **最小スコープの PAT**（例：`GH_PAT`→gist、`GH_PAT_RELEASE`→repo）

> ## **1) Test（`test.yaml`）**

**What**：Black / Ruff / Pytest を Python 3.9/3.10/3.11 で実行  
**When**：`push`（`main`/`dev`）

**ポイント**  

- **ビルド依存**：`build-essential` / `cmake` を apt で導入
- **pip キャッシュ**：`requirements-dev.txt` のハッシュをキーにキャッシュ
- **編集インストール**：`pip install -e . --no-deps`（重い DL スタックを避けつつパッケージ構造を検証）

**ステップ（要約）**  

1) checkout  

2) setup-python（matrix: 3.9/3.10/3.11）  

3) apt 依存導入（`build-essential` / `cmake`）  

4) pip キャッシュ  

5) `pip install -r requirements-dev.txt`  

6) `pip install -e . --no-deps`  

7) `black --check .` / `ruff check . --output-format=github`  

8) `pytest -q`

> ## **2) release-tar（`release-tar.yaml`）**

**What**：`v*.*.*` タグ push で `tar.gz` + `sha256` を生成し、GitHub Release に添付  
**When**：`on: push: tags: 'v*.*.*'`、手動 `workflow_dispatch`  
**Permissions**：`contents: write`

**ポイント**  

- **タグ→version 同期**：`pyproject.toml` の `project.version` をタグに合わせて更新（`tomli/tomli-w`）
- **アーカイブ**：`git archive --format=tar.gz HEAD` でソース一式を固める
- **整合性**：`sha256sum` を同梱
- **秘密情報**：`softprops/action-gh-release` の `token` は `GH_PAT_RELEASE` を使用

**フロー（要約）**  

1) checkout  

2) `VERSION.txt` をタグと日付で生成（タグ時のみ）  

3) Python 3.10 をセットアップ → `tomli`/`tomli-w` をインストール  

4) `pyproject.toml` の version を **タグ（`vX.Y.Z` → `X.Y.Z`）**で上書き  

5) `git archive` で `xignage-edge-detection.tar.gz` を作成  

6) `sha256sum` を生成  

7) `softprops/action-gh-release` で **Releaseへ添付**（自動リリースノート）

!!! note
    ジョブ条件 `if: ${{ !contains(github.ref, '-') }}` により **ハイフンを含むタグ（プレリリース等）を除外**します。

> ## **3) update-release-badge（`update-release-badge.yaml`）**

**What**：Release 作成/公開/編集時に Gist の `release.json` を更新（Shields.io endpoint 用）  
**When**：`on: release: types: [created, published, edited]`（＋タグ push）  
**Secrets**：`GH_PAT`（**gist スコープ**のみ）  
**Vars**：`GIST_ID`

**フロー（要約）**  

1) checkout  

2) **タグ名取得**：`github.event.release.tag_name` を `GITHUB_OUTPUT` に保存  

3) `jq` でバッジ JSON を生成  

4) `curl -X PATCH` で **Gist を更新**（`release.json`）

**出力（例）**  

```json
{ "schemaVersion":1, "label":"release", "message":"v1.2.3", "color":"blue" }
```

!!! warning "push トリガー時の注意"
    `on: push` でも起動しますが、その場合 `github.event.release.tag_name` が **空**になるため、
    実運用では **Release イベント**での更新を主とし、push 起動は補助と考えてください（必要に応じてフォールバック実装を追加）。

## **運用メモ**

- `requirements-full.txt` は **Jetson 向けの重い依存**を含むため、CI の Test では **dev 要件のみ**を使用
- dlib/OpenCV のビルドが必要な場合は **追加のシステム依存**（`libopenblas-dev` など）を検討
- 将来、ビルド成果物の配布を拡張する場合は **sdist/wheel** 生成ワークフローを追加
