# CI / Automation 概要

このページは、本ドキュメントで管理している **各リポジトリの GitHub Actions ワークフロー** の意図・運用方針をひと目で把握できる **ハブ**です。  
YAML の細かな手順は各ページ（リンク）に委ね、ここでは **何を・いつ・どう保証するか** をまとめます。

## **ポリシー（共通運用）**

- **最小権限**：`permissions` は原則 `contents: read`。Release 操作時のみ `contents: write`。Gist 更新は **PAT(gist)** を使用。
- **並行実行制御**：必要に応じて `concurrency` を設定し、同ブランチの古い実行を **cancel-in-progress**。
- **再現性/失敗早期化**：シェルは `set -euxo pipefail`、依存は `npm ci` / 明示的バージョン固定を推奨。
- **PR ゲート**：リポごとに必須チェックを定義。少なくとも静的検査／ライセンス検査系は **Required** 推奨。
- **Secrets 管理**：`GITHUB_TOKEN` を基本とし、外部 API（Gist 等）にだけ限定スコープの **PAT** を使用・定期ローテ。
- **命名・タグ**：リリースは `vMAJOR.MINOR.PATCH`。`-rc` 等の **プレリリースは既定で除外**（必要なら手動/条件変更）。

## **ワークフロー カタログ（一覧）**

> ### **signage-jetson**

| Workflow | YAML | 役割 / 保証 | 主トリガ | 生成物 / 副作用 | Secrets / 権限 |
|---|---|---|---|---|---|
| **Setup CI（Shell/Python）** | `ci/workflows/signage-jetson/setup-ci.md` | ShellCheck と Python 構文チェックで PR 品質を担保 | push / PR（main） | なし（ログのみ） | 既定権限 |
| **Release TAR / Patches** | `ci/workflows/signage-jetson/release-tar.md` | 配布物 `signage-scripts.tar.gz/.sha256` と `patches_all.zip` を **同タグの Release に添付** | tag `v*.*.*`, 手動 | Release Assets 追加/更新 | `contents: write` / `GH_PAT_RELEASE`（or `GITHUB_TOKEN`） |
| **Build Patches to Release** | `ci/workflows/signage-jetson/build-patches.md` | `patches_all.zip` を作り **直近タグ Release に再添付**（置換） | push(main), tag `v*`, create tag | Release Asset 置換 | `GITHUB_TOKEN`（contents: write） |
| **Metrics CI** | `ci/workflows/signage-jetson/metrics-ci.md` | `scripts/metrics/` の Lint / Format / Test | push / PR（パス限定） | なし | 既定権限 |
| **APT License Check** | `ci/workflows/signage-jetson/apt-license-check.md` | APT 依存のライセンス検査で **NG/不明をブロック** | push / PR | なし | 既定権限 |
| **Python License Check** | `ci/workflows/signage-jetson/python-license-check.md` | pip 依存のライセンス検査で **NG/不明をブロック** | push / PR | なし | 既定権限 |
| **Update Release Badge** | `ci/workflows/signage-jetson/update-release-badge.md` | 新規リリース時に **Gist の `release.json` を更新**（Shields endpoint） | release（正式版） | Gist 更新（バッジ反映） | `GH_PAT(gist)` |

- スクリプト補助：`.github/ci/check_apt_licenses.sh` / `.github/ci/check_pip_licenses.sh`（ライセンス判定ロジック）

> ### **signage-server**

| Workflow | YAML | 役割 / 保証 | 主トリガ | 生成物 / 副作用 | Secrets / 権限 |
|---|---|---|---|---|---|
| **Server CI** | `ci/workflows/signage-server/server-ci.md` | Lint / Format / Test（Node 22） | push / PR（main） | なし（ログのみ） | 既定権限 |
| **License Check** | `ci/workflows/signage-server/license-check.md` | npm 依存のライセンス検査 | push / PR | なし（ログのみ） | 既定権限 |
| **Release TAR (server)** | `ci/workflows/signage-server/release-tar.md` | `signage-server.tar.gz` と `.sha256` を Release に添付（タグ同期） | tag `v*.*.*`, 手動 | Release Assets 追加 | `contents: write` / `GH_PAT_RELEASE` |
| **Update Release Badge (server)** | `ci/workflows/signage-server/update-release-badge.md` | 安定版リリースで Gist の `release.json` を更新 | release（created/published） | Gist 更新（バッジ反映） | `GH_PAT(gist)` |

## **運用ルール（最低限）**

- **ブランチ保護**：各リポの `main` に Required Checks を設定（例：jetson → Setup/License/Metrics、server → Server CI / License Check）。  
- **リリース手順**：タグ push → 「Release TAR」実行 → 必要なら補助ワークフロー実行 → 「Update Release Badge」でバッジ更新。  
- **配布契約**：（jetson）`signage-scripts.tar.gz` / `patches_all.zip`、（server）`signage-server.tar.gz`。ダウンストリームも同契約で取得。  
- **例外管理**：ライセンス検査での一時許容は **期限付きチケット**で管理し、ポリシー表に追記。  
- **Secrets の責任**：所有者とローテーションサイクルを index に明記（PAT は gist / release で分離）。

## **失敗時の一次対応（共通）**

- **Release 添付失敗（403/404）**：`contents: write` とトークン（PAT or `GITHUB_TOKEN`）を確認。タグ/Release の整合性をチェック。  
- **Gist 更新失敗（401/403/404）**：`GH_PAT(gist)` の有効性・スコープ・`GIST_ID` を確認。  
- **License チェック失敗**：該当パッケージの代替・バージョン固定・判定ルールの更新を検討（Unknown は原則 NG）。  
- **Lint/Test 失敗**：ローカルで再現（`npm ci && npm test` / `shellcheck` / `python -m py_compile`）→修正→再 push。  
- **グロブ未一致**：`nullglob` を使うか存在チェックを入れて安全化。

## **ローカル再現のミニ手順**

- **Shell**：`shellcheck migrations/*.sh scripts/**/*.sh setup_all.sh update.sh`  
- **Python 構文**：`PYTHONPYCACHEPREFIX=/tmp/pycache python -B -m py_compile web/*.py $(find scripts -name '*.py')`  
- **Metrics**：`(cd scripts/metrics && npm ci && npm run lint && npm run test && npm run format)`  
- **pip-licenses**：`pip install pip-licenses && pip-licenses --format=json > licenses.json`

## **将来の拡張**

- **Matrix テスト**（Node 20/22、OS バリアント）  
- **Artifacts の保存**（ライセンスレポート, Lint レポート）  
- **OIDC to Cloud**（クラウド連携が必要になれば `id-token: write` を付与）  
- **共通アクション化**（繰り返しの手順は composite action へ抽出）

## **参照**

**signage-jetson**  

- Setup CI … `ci/workflows/signage-jetson/setup-ci.md`  
- Release TAR / Patches … `ci/workflows/signage-jetson/release-tar.md`  
- Build Patches … `ci/workflows/signage-jetson/build-patches.md`  
- Metrics CI … `ci/workflows/signage-jetson/metrics-ci.md`  
- APT License Check … `ci/workflows/signage-jetson/apt-license-check.md`  
- Python License Check … `ci/workflows/signage-jetson/python-license-check.md`  
- Update Release Badge … `ci/workflows/signage-jetson/update-release-badge.md`

**signage-server**  

- Server CI … `ci/workflows/signage-server/server-ci.md`  
- License Check … `ci/workflows/signage-server/license-check.md`  
- Release TAR (server) … `ci/workflows/signage-server/release-tar.md`  
- Update Release Badge (server) … `ci/workflows/signage-server/update-release-badge.md`
