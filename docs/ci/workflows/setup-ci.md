# Setup CI（Shell / Python）

**What**：シェル・Pythonの静的チェックでPRの品質を担保する  
**When**：push / pull_request（main）、`concurrency: wf-${{ github.ref }}`（推奨）  
**Inputs/Outputs**：入力なし / 出力なし（ログのみ）  
**Permissions/Secrets**：デフォルト `contents: read`（昇格なし）  
**Failure→Fix**：ShellCheckやpy_compileエラーを修正→再push / Re-run jobs  
**Owner**：`<team or name>`

## **導入パッケージ**

- `signage-jetson`

## **基準ルール**

- **Shell（ShellCheck）**  
  対象パス：  
  `migrations/*.sh`, `scripts/bin/*`, `scripts/infra/*.sh`, `scripts/lib/*.sh`, `scripts/setup/*.sh`, `setup_all.sh`, `update.sh`  
  **失敗条件**：ShellCheck の診断エラー（非 0 終了）

- **Python（構文チェック）**  
  実行：`python -B -m py_compile web/*.py $(find scripts -name '*.py')`  
  事前に `PYTHONPYCACHEPREFIX=/tmp/pycache` を設定し、`__pycache__` 汚染を回避  
  **失敗条件**：`py_compile` での構文エラー（非 0 終了）

> メモ：グロブ未一致があると ShellCheck は「ファイルが開けない」エラーになります。必要に応じて `nullglob` や `find` による列挙へ置換してください（下記「運用ノート」）。

## **実行ステップ（CIの流れ）**

1. **Checkout**：`actions/checkout@v3`  
2. **ShellCheck インストール**：`sudo apt-get install -y shellcheck`  
3. **Shell 構文チェック**：上記パス群に対して `shellcheck` を実行  
4. **Python 構文チェック**：`PYTHONPYCACHEPREFIX=/tmp/pycache` で `py_compile` を実行（`-B` で .pyc 書き込みも抑制）

## **Failure → Fix（よくある失敗と対処）**

- **ShellCheck で “can't open file …”**  
  → グロブ未一致。該当ディレクトリにファイルがない場合のガードを追加（`shopt -s nullglob` など）。
- **ShellCheck の規約違反**  
  → 指摘箇所を修正。やむを得ず抑制が必要な場合は **最小範囲**で `# shellcheck disable=SCxxxx` を付与。
- **Python 構文エラー**  
  → 該当ファイルを修正。ローカルで `python -B -m py_compile <file>` を再現してから push。
- **pycache 汚染**  
  → `PYTHONPYCACHEPREFIX=/tmp/pycache` が CI 上で設定されているか確認（本ワークフローは設定済み）。

## **運用ノート / ベストプラクティス（任意）**

- **並行実行の抑止**：古い同ブランチ実行をキャンセル  

  ```yaml
  concurrency:
    group: setup-ci-${{ github.ref }}
    cancel-in-progress: true
  ```

- **グロブ未一致対策**：

  ```bash
  shopt -s nullglob
  shellcheck migrations/*.sh scripts/bin/* scripts/infra/*.sh scripts/lib/*.sh scripts/setup/*.sh setup_all.sh update.sh
  ```

  もしくは `find ... -print0 | xargs -0 shellcheck` で列挙。
- **Actions のバージョン**：長期運用では `actions/checkout@v4` への更新を推奨。
- **ローカル再現**：
  Shell：`shellcheck <files>`
  Python：`PYTHONPYCACHEPREFIX=/tmp/pycache python -B -m py_compile web/*.py $(find scripts -name '*.py')`
