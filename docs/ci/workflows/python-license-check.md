# Python License Check — `python-license-check.yaml`

**What**：`pip-licenses` を用いて **Python 依存（直・間接）のライセンスを検査**し、NG/不明ライセンスを検出したら PR / push をブロックする。

## **導入パッケージ**

- `signage-jetson`

## **When（トリガ / 対象）**

- `on: [push, pull_request]`（全ブランチ対象）

## **Permissions / Secrets**

- 追加の Secrets 不要（既定の `contents: read` 権限で可）

## **Inputs / Outputs**

- **入力**：`deps/pip-common.txt`（必須）、`deps/pip-raspi.txt`（ランナーが ARM64 のとき）
- **出力**：Actions ログ（必要ならレポートをアーティファクト化する実装に拡張可）

## **Steps（処理の流れ）**

1. **Checkout**：`actions/checkout@v4`  
2. **Python セットアップ**：`actions/setup-python@v5`（`python-version: 3.11`）  
3. **依存インストール & ライセンス検査**
   - `pip-licenses` をインストール
   - 共通依存：`pip-common.txt` をインストール
   - ランナーが **ARM64** の場合のみ `pip-raspi.txt` を追加インストール  
   - `.github/ci/check_pip_licenses.sh` を実行（**NG 検出で非 0 終了**）

> 備考：GitHub Hosted の `ubuntu-latest` は通常 **x64**。ARM64 の条件分岐は **セルフホスト**や ARM ランナー利用時に有効。

## **Failure → Fix（よくある失敗と対処）**

- **`pip-licenses: command not found`**  
  → `python -m pip install pip-licenses` の成功を確認。ネットワーク断なら再実行。
- **NG ライセンス検出**  
  → 代替パッケージの検討／バージョン固定／例外方針の見直し（基本は例外最小）。  
    判定は `check_pip_licenses.sh` 側の **許可/禁止リスト**で管理。
- **Unknown / Not specified**  
  → 原則 **失敗扱い**が安全。`pip-licenses --format=json --with-urls --with-authors` などで情報源を増やし、パッケージ側のメタデータを確認。
- **依存解決の差異**  
  → `pip-compile`（`requirements.txt` のロック）運用にすると CI とローカルの乖離を抑制できる。  
    もしくは CI で `pip install --require-hashes -r requirements.lock.txt` に統一。

## **運用ノート / ベストプラクティス**

- **並行実行制御（任意）**

  ```yaml
  concurrency:
    group: py-lic-${{ github.ref }}
    cancel-in-progress: true
  ```

- **レポートの保存**：将来の監査用に `pip-licenses --format=json > licenses.json` をアーティファクト化すると追跡が容易。
- **スコープの明確化**：共通は `pip-common.txt`、デバイス依存は `pip-raspi.txt` / `pip-jetson.txt` 等に分離。
追加する場合は CI でも **条件分岐**を揃える（例：`runner.os` / `runner.arch` / matrix）。
- **判定ポリシーの明文化**：許容（MIT/BSD/Apache-2.0 等）、要審査（LGPL 等）、禁止（GPLv3 など商用非互換）をドキュメントに記載し、`check_pip_licenses.sh` と一致させる。
