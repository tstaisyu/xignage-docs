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

- 出力先: **標準エラー**（常に）＋ **ファイル追記**（`UPDATE_SCRIPT_LOG`）
- 形式: 接頭辞 [`info`] / [`warn`] / [`error`] を付与

## **2) 配置ヘルパー: `install_or_link <src> <dest>`**

指定したソースを **シンボリックリンクで配置**（`ln -sfn`）し、既存の通常ファイルがあれば **タイムスタンプ付き** `.bak` に退避します。
`/releases/<任意>/` を **自動で** `/current/` に読み替えるため、安定した固定パス参照が可能です。

```bash
install_or_link "scripts/bin/ap_start" "/usr/local/bin/ap_start"
```

> **挙動**

1. **`src` を正規化**： 絶対パス化し、`/releases/<…>/` を **`/current/` に置換**。
2. **存在チェック**： `src` が無ければ **警告してスキップ**（ノーチェンジ）。
3. **既存退避**： `dest` が通常ファイルなら **`.bak.YYYYmmdd_HHMMSS` に退避**。
4. **シンボリックリンク作成**： `ln -sfn "$src" "$dest"`（**冪等**で既存を置換）。
5. **実体に実行権限付与**： `chmod +x "$src"`（リンク先の実体に付与）。
6. **ログ出力**： 処理結果を情報ログに記録。

| 引数 | 必須 | 説明 |
| --- | :-: | --- |
| `src` | ✅ | 実体ファイルへのパス（相対/絶対） |
| `dest` | ✅ | 配置先の絶対パス |

| 戻り値 | 説明 |
| ---: | --- |
| 0 | 正常（`src` 不在スキップも 0 扱い） |
| 0 以外 | 予期せぬエラー（通常は発生しない） |

## **3) リトライ付きダウンロード: `download_with_retry <url> <out> [mode] [tries]`**

GitHub Releases／API 等を **ヘッダ最適化＋指数バックオフ**で取得。DNS 不調時は `systemd-resolved` のキャッシュを 一度だけフラッシュ、接続エラー時は **IPv4** 強制で再試行します。

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

> **動作仕様**

- `curl -sS -L --fail` を使用（`--connect-timeout` と `--max-time` 付与）。
- **DNS エラー**(rc=6) 時、`resolvectl flush-caches` を **一度だけ** 実行（存在時）。
- **DNS/接続エラー**(rc=6/7) の次回以降は **`--ipv4` 強制**で再試行。
- **指数バックオフ**: 2s → 4s → 8s …。
- **成功**時は試行回数とファイルサイズをログ出力、**失敗**時はエラーログ後に `1` を返す。

| 環境変数 | 既定 | 説明 |
| --- | --- | --- |
| `CONNECT_TIMEOUT` | `10` | TCP 接続タイムアウト（秒） |
| `MAX_TIME` | `180` | 1 回の取得に許す最大時間（秒） |
| `DL_VERBOSE` | `1` | `1`で開始/成功ログ出力、`0`で抑制 |
| `GH_TOKEN` | なし | 設定時、`Authorization: token …` を自動付与（GitHub、他サイトは無害） |

| 戻り値 | 説明 |
| ---: | --- |
| 0 | 成功 |
| 1 | 失敗 |

!!! note "安全性・冪等性"
    失敗しても out の中身は中途半端に残さない設計（curl --fail）です。再試行は同一パスを上書きします。

> **スニペット集**

- **GitHub Release の取得＋SHA256 検証**

```bash
ASSET_URL="https://api.github.com/repos/org/repo/releases/assets/12345"
TMP="/tmp/app.tgz"
SUM="/tmp/app.tgz.sha256"

download_with_retry "$ASSET_URL" "$TMP" asset 5
download_with_retry "${ASSET_URL}.sha256" "$SUM" asset 5
sha256sum -c "$SUM"      # "OK" なら展開へ
```

- **JSON API から情報抽出**

```bash
download_with_retry \
  "https://api.github.com/repos/org/repo/releases/latest" \
  "/tmp/latest.json" json 3

tag="$(jq -r '.tag_name' /tmp/latest.json)"
```

- `current` **へ解決してリンク配置**

```bash
install_or_link "scripts/bin/wifi_or_ap" "/usr/local/bin/wifi_or_ap"
```

> **依存コマンド**

| コマンド | 用途 | 備考 |
| --- | --- | --- |
| `curl` | HTTP ダウンロード | `--ipv4` でIPv4固定 |
| `sed` | 文字列置換 | `/releases/.../`→`/current/` |
| `ln` / `mv` / `chmod` | ファイル操作 | 退避・リンク・権限付与 |
| `stat` | ファイルサイズ取得 | 成功ログ用 |
| `resolvectl` | DNS キャッシュ操作 | あれば使用（任意） |
| `seq` / `sleep` | リトライループ | 指数バックオフ |

> **運用ヒント**

- **ログ二重化**  
  `UPDATE_SCRIPT_LOG=/var/log/update_runner.log` を指定すると、標準エラー＋ファイルに記録できます。
- **GitHub レート制限回避**  
  `GH_TOKEN` を設定すると未認証より緩いレート制限で API/アセット取得が安定します。
- **IPv4 固定の検討**  
  環境によっては初回から IPv4 に固定する方が安定します（ラッパーで `--ipv4` 常用など）。
- **`info` エイリアスの用意**  
  `info(){ log_info "$@"; }` をプロジェクト共通で定義しておくと互換性が上がります。
