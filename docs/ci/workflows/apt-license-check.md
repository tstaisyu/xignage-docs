# APT License Check — `apt-license-check.yaml`

**What**：APT パッケージのライセンスを検査し、**NG ライセンスや未判別**がある場合に PR / push をブロックする品質ゲート。

## **導入パッケージ**

- `signage-jetson`

## **When（トリガ / 対象）**

- `on: [push, pull_request]`（全ブランチ対象）

## **Permissions / Secrets**

- 追加の Secrets なし  
- 既定権限（`contents: read`）で可

## **Inputs / Outputs**

- **入力**：リポジトリ一式（`deps/apt-packages.txt` など、スクリプトが参照するリストがある場合）  
- **出力**：GitHub Actions ログ（必要に応じてレポートファイルをアーティファクト化する実装も可）

## **Steps（処理の流れ）**

1. **Checkout**：`actions/checkout@v4`  
2. **APT 更新**：`sudo apt-get update -qq`（メタデータ取得）  
3. **検査実行**：`.github/ci/check_apt_licenses.sh` を実行  
   - スクリプトは **違反検出で非 0 終了**すること  
   - 対象パッケージの由来（例：`deps/apt-packages.txt`）や判定方法はスクリプト側で定義

## **Failure → Fix（よくある失敗と対処）**

- **スクリプトが見つからない / 実行権限なし**  
  → パスと権限を確認：`chmod +x .github/ci/check_apt_licenses.sh`
- **APT 404 / 署名エラー**  
  → ランナーの一時的障害やソースリスト不整合。`apt-get update` を再実行、古い PPA を無効化
- **NG ライセンス検出**  
  → スクリプトの **許可リスト/禁止リスト**に従い、代替パッケージへ置換 or 例外の是非をレビュー
- **未判別（Unknown）扱い**  
  → 情報ソース（`apt-cache show` など）と解析ロジックを見直し。判別不能は原則 **NG と同等**の運用が安全

## **運用ノート / ベストプラクティス**

- **並行実行の制御（任意）**

  ```yaml
  concurrency:
    group: apt-license-${{ github.ref }}
    cancel-in-progress: true
  ```

- **スクリプト側の方針**
  取得源：`apt-cache show`, `apt show` 等から License フィールドを解析
  **許容ライセンスの明示**（例：Apache-2.0 / BSD / MIT など）
  **未判別＝失敗** とする（サプライチェーン・リスク低減）
  レポートを **人間可読（一覧）** と **機械可読（CSV/JSON）** の両方で出力すると運用が楽
- 依存リスト連携
  `deps/apt-packages.txt` を参照する場合は、**1 行 1 パッケージ**・コメント # で統一
