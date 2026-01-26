# ユーティリティ関数リファレンス – `functions.sh`

サイネージ端末（**Raspberry Pi / NVIDIA Jetson**）向けのセットアップ＆ランタイムスクリプトで共通利用するヘルパー関数群です。  
場所: `scripts/lib/functions.sh`

- **読み込み例**

```bash
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${REPO_ROOT}/scripts/lib/functions.sh"
```

## **1) ログ出力: `log_info` / `log_warn` / `log_error`**

```bash
log_info  "message ..."   # → [info]  message ...
log_warn  "message ..."   # → [warn]  message ...
log_error "message ..."   # → [error] message ...
```

- 出力先: **標準エラー**（常に）＋ **ファイル追記**（`UPDATE_SCRIPT_LOG` が設定されている場合）

## **2) 配置ヘルパー: `install_or_link <src> <dest>`**

指定したソースを **シンボリックリンクで配置**（`ln -sfn`）し、既存の通常ファイルがあれば **タイムスタンプ付き** `.bak` に退避します。  
`/releases/<任意>/` を **`/current/` に置換**するため、安定した固定パス参照が可能です。

```bash
install_or_link "scripts/bin/ap_start" "/usr/local/bin/ap_start"
```

> **挙動**

1. **`src` を正規化**： 絶対パス化し、`/releases/<…>/` を **`/current/` に置換**
2. **存在チェック**： `src` が無ければ **警告してスキップ**
3. **既存退避**： `dest` が通常ファイルなら **`.bak.YYYYmmdd_HHMMSS` に退避**
4. **シンボリックリンク作成**： `ln -sfn "$src" "$dest"`
5. **実体に実行権限付与**： `chmod +x "$src"`

> **注意**

`install_or_link` は **`info` 関数が呼び出し側で定義されている前提**です。  
必要に応じて `info(){ log_info "$@"; }` のように定義してください。

## **3) リトライ付きダウンロード: `download_with_retry <url> <out> [mode] [tries]`**

リリースアセット／JSON API などを **ヘッダ最適化＋指数バックオフ**で取得します。  
DNS 不調時は `systemd-resolved` のキャッシュを一度だけフラッシュし、
接続エラー時は **IPv4** 強制で再試行します。

```bash
# アセット（バイナリ）を最大3回
download_with_retry \
  "https://api.github.com/repos/org/repo/releases/assets/12345" \
  "/tmp/artifact.tgz" asset 3

# JSON API を最大5回
download_with_retry \
  "https://api.github.com/repos/org/repo/releases/latest" \
  "/tmp/latest.json" json 5
```

| 引数 | 必須 | 例 | 説明 |
| --- | :-: | --- | --- |
| `url` | ✅ | `https://…` | 取得元 URL |
| `out` | ✅ | `/tmp/x.tgz` | 保存先パス |
| `mode` | ー | `asset` | `asset`/`json`/`none`（既定: `asset`） |
| `tries` | ー | `3` | 最大試行回数（既定: `3`） |

| モード | 付与する `Accept` ヘッダ | 主な用途 |
| --- | --- | --- |
| asset | `application/octet-stream` | リリースのバイナリアセット等 |
| json | `application/vnd.github+json` | GitHub 等の JSON API |
| none | 付与なし | 任意サイトの汎用ダウンロード |

| 環境変数 | 既定 | 説明 |
| --- | --- | --- |
| `CONNECT_TIMEOUT` | `10` | TCP 接続タイムアウト（秒） |
| `MAX_TIME` | `180` | 1 回の取得に許す最大時間（秒） |
| `DL_VERBOSE` | `1` | `1`で開始/成功ログ出力、`0`で抑制 |

## **4) OTA manifest 取得: `ota_manifest_fetch [path]`**

`/etc/signage/iot.env` の証明書を使用し、
`https://device.api.xrobotics.jp/api/ota/manifest` を **mTLS** で取得します。

- 取得先のパスは引数で指定（既定 `/tmp/ota_manifest.json`）
- `IOT_CERT_PATH` / `IOT_KEY_PATH` が未設定の場合は失敗

