# signage-jetson

> ## セットアップスクリプト群

本スクリプト群は、**Raspberry Pi / NVIDIA Jetson** を対象に、端末を **サイネージ専用デバイス**として立ち上げるための一連の手順を自動化します。  
ネットワーク基盤の統一、アプリ導入と常駐化、AP フォールバック、更新基盤、推論ランタイム、キオスク起動、電源・権限周りまでを **冪等（何度でも再実行可）** に整えます。

### 1) 目的

- **即戦力のサイネージ端末化**：起動＝表示・配信可能な状態（Openbox+Chromium キオスク、Node サーバ、Wi-Fi 管理 UI）
- **運用の安定化**：NetworkManager による Wi-Fi 管理と AP フォールバック、経路メトリック固定、ログ永続化、UFW 設定
- **保守性の確保**：`signage-update.service` による更新／復旧、メトリクス送出、パッチ／マイグレーションの適用状態管理

### 2) 設計方針

- **ボード自動判別**（Jetson / Pi）＋**安全スキップ**（対象外処理は実行しない）
- **冪等性**（差分適用・上書き条件判定・再実行耐性）
- **最小権限**（`/etc/signage` は root 管理、実行ユーザに必要最低限のアクセス）
- **IoT 証明書は bundle 方式**：端末側で AWS 資格情報を持たない

### 3) 前提

- OS:
  - **Raspberry Pi：Ubuntu Server 24.04 LTS（preinstalled image, arm64）**
  - **Jetson：L4T / Ubuntu-based image（systemd）**
    - TODO: JetPack/L4T の具体バージョンはイメージ側に依存。根拠: `signage-jetson/README.md` の「Supported platforms」
- 必須変数：`DEVICE_ID`, `BOARD_TYPE`, `IOT_BUNDLE_URL`, `IOT_BUNDLE_SHA256`
- IoT 環境: `/etc/signage/iot.env` に `IOT_ENDPOINT` が必要
- Python：**venv**（既定 `/opt/signage-core/venv`）に集約
- GPIO：Jetson は `Jetson.GPIO`、Pi は **libgpiod**

### 4) 実行ガイド

#### 4-1. 初回の配置（`releases/initial`）

```bash
sudo mkdir -p /opt/signage-core/signage-jetson/releases
sudo chown -R "$USER:$USER" /opt/signage-core
cd /opt/signage-core/signage-jetson/releases

# signage-jetson リポのクローン

git clone https://github.com/tstaisyu/signage-jetson.git initial
cd initial
```

#### 4-2. 一括セットアップの実行（`setup_all.sh`）

`setup_all.sh` は `scripts/setup/nnn_*.sh` を **番号順**に実行します。  
必要な値は **環境変数**で渡します（`SETUP_STAGE=all|rootfs|userdata` で段階実行）。

```bash
sudo env \
  DEVICE_ID="<DEVICE_ID>" \
  BOARD_TYPE="<BOARD_TYPE>" \
  IOT_BUNDLE_URL="<URL>" \
  IOT_BUNDLE_SHA256="<SHA256>" \
  bash setup_all.sh
```

sudo で環境変数が落ちる場合は `--preserve-env` を使います。

```bash
export DEVICE_ID=... BOARD_TYPE=... IOT_BUNDLE_URL=... IOT_BUNDLE_SHA256=...
sudo --preserve-env=DEVICE_ID,BOARD_TYPE,IOT_BUNDLE_URL,IOT_BUNDLE_SHA256 \
  bash setup_all.sh
```

#### 4-3. A/B（/userdata）環境の例

`/userdata` を前提にする場合は **rootfs → userdata** に分けて実行します。

```bash
# Stage 1: rootfs
sudo REQUIRE_USERDATA=1 SETUP_STAGE=rootfs \
  DEVICE_ID=... BOARD_TYPE=... \
  IOT_BUNDLE_URL=... IOT_BUNDLE_SHA256=... \
  bash setup_all.sh

# Stage 2: userdata
sudo REQUIRE_USERDATA=1 SETUP_STAGE=userdata \
  DEVICE_ID=... BOARD_TYPE=... \
  IOT_BUNDLE_URL=... IOT_BUNDLE_SHA256=... \
  bash setup_all.sh
```

#### 4-4. 変数の意味

| 変数 | 例 | 説明 |
| --- | --- | --- |
| `DEVICE_ID` | `XIG-JON-000` | 端末識別子（ログ・メトリクス・ホスト名） |
| `BOARD_TYPE` | `jetson-orin` / `raspi-64` | ボード種別（Jetson / Pi 分岐） |
| `IOT_BUNDLE_URL` | `https://.../bundle.tgz` | IoT 証明書 bundle の URL |
| `IOT_BUNDLE_SHA256` | `...` | bundle の SHA256（任意だが推奨） |

#### 4-5. 依存パッケージ（`deps`）

- **APT 依存**は `scripts/lib/config.sh` の `DEPENDENCIES` 配列（ボード別）で管理
- **pip 依存**は venv (`/opt/signage-core/venv`) へ集約
  - 共通：`deps/pip-common.txt`
  - Raspberry Pi：`deps/pip-raspi.txt`
  - Jetson：`deps/pip-jetson.txt`

### 5) 各ユニットドキュメントの詳細

> [**setup(000-099) - 初期セットアップ**](units/setup-000-099.md)

環境ファイル作成、Wi-Fi 名称の安定化（`wlanINT`/`wlanUSB`）、NetworkManager 用の経路メトリック、journald 永続化、Fluent Bit、Python venv 準備、IoT 証明書導入までを **冪等**に実行します。

> [**setup(100-199) - アプリ導入・サービス常駐化**](units/setup-100-199.md)

Node.js の導入、`signage-server` / `xignage-edge-detection` の OTA バンドル導入、`xignage-metrics` / `call-button` の常駐化、IoT 証明書ローテーションのタイマー導入、Chromium の管理ポリシー適用までをカバーします。

> [**setup(200-599) - ネットワーク／AP／ブート最適化**](units/setup-200-599.md)

有線は `systemd-networkd`、Wi-Fi は **NetworkManager** を使う構成へ統一し、AP フォールバックと Wi-Fi 管理 UI を配置します。AP は **NetworkManager ホットスポット**で起動します。

> [**setup(600-899) - 更新基盤・推論ランタイム・公開設定**](units/setup-600-899.md)

`update_runner` / `update_manager` / `healthcheck` の配置と **`signage-update.service`** による更新実行、（Jetson 向け）推論ランタイム、Nginx・UFW・PORT=3001 の調整までをカバーします。

> [**setup(900-999) - ブート見た目／キオスク化／電源・権限**](units/setup-900-999.md)

自動ログイン → Openbox + Chromium の **キオスク起動**、Jetson/Pi の起動設定最適化、HDMI 音声固定、sudoers の最小権限化、パッチ/マイグレーションのマーカー初期化を行います。

---

## Raspberry Pi ベースイメージ

Raspberry Pi 向けの **OSベースイメージ（SDカードイメージ）** と  
対応する `signage-jetson` タグ・S3 パスの一覧は以下にまとめています。

- [Raspberry Pi ベースイメージ管理](infra/raspi-images.md)

---

## IO（ボタン／ToF／イベント）

> [**IO コンポーネント仕様 — `components/io.md`**](components/io.md)

物理ボタンの**デバウンス**と**LED制御**、ToF の **mm 正規化**を含む距離読取、AWS IoT への **MQTT/TLS 送信**、および常駐アプリ（**50Hz ループ／スナップショット** `io_state.json`／**イベントログ JSONL**）の仕様を集約。  
Jetson は `Jetson.GPIO`、それ以外（Pi）は **libgpiod** を使用します（BCM 番号）。

---

## メトリクス送信サービス（metrics）

> [**メトリクス送信 — `metrics/index.js`**](components/metrics-service.md)

端末の温度/電圧/スロットルなどのメトリクスを **30 秒間隔**で **AWS IoT Core (MQTTS)** へ送信するサービス。  
`boards/pi.js` / `boards/jetson.js` / `boards/generic.js` による **ボード別取得**に対応し、`xignage-metrics.service` から実行。

- **トピック**: `xignage/v1/devices/<thing>/metrics/system`
- **必須環境変数**: `IOT_ENDPOINT`, `IOT_CERT_PATH`, `IOT_KEY_PATH`, `IOT_CA_PATH`
- **任意**: `IOT_THING_NAME`（`--device` を上書き）

前提となる証明書の用意は ↓  

### インフラ（IoT 証明書）

> [**IoT 証明書（bundle 方式） — `infra/aws-iot-certs.md`**](infra/aws-iot-certs.md)

---

## ランタイムツール `（scripts/bin/）` / `update.sh`

サイネージ稼働中に動く実行バイナリの要点をまとめます。詳細は各ページへ。

| 区分 | スクリプト | 概要 | 主な連携/ログ |
| --- | --- | --- | --- |
| Wi-Fi/AP | `wifi_or_ap` | NetworkManager の接続状態を見て **Wi-Fi 維持** or **AP 起動**。状態を `/run/wifi_or_ap.state` に保持し、`OFFLINE_GRACE_SEC` などでヒステリシス制御。 | `wifi-or-ap.service/.timer`、`$WIFI_OR_AP_LOG` |
| Wi-Fi/AP | `ap_start` | **NM ホットスポット**を作成・起動（`nmcli`）。AP DNS を captive portal へ誘導。 | `NetworkManager`、`$AP_START_LOG_FILE` |
| 更新 | `update_manager` | `signage-update.service` から起動。GUI停止 → ランナー実行 → `/tmp/update_done` 待機 → **再起動**。 | `/var/log/update_manager/…`（30日ローテ） |
| 更新 | `update_runner` | NTP 同期 → **パッチ ZIP 適用** → **signage-jetson TAR** 展開/マイグレーション → **metrics 同期** → `update.sh` 実行 → `/tmp/update_done`。 | `/var/log/update_runner/update_runner_*.log` |
| 更新 | `update.sh` | `signage-server` 更新（TAR + healthcheck）＋ Jetson では `xignage-edge-detection` 更新。失敗時はロールバック。 | `/var/log/update/update_*.log` / `update_debug_*.log` |
| 更新 | `healthcheck` | 必須ファイル存在と **Bash/Python 構文**をトップレベルで検査。OK で `0`。 | `journalctl`（稼働確認の補助） |

### 起動時 Wi-Fi/AP → [Wi-Fi ブートツール](components/wifi-boot-tools.md)

起動後に **既知 Wi-Fi へ接続を試行し、失敗時は AP へ自動フォールバック**します。

### 更新サブシステム → [アップデートツール](components/update-tools.md)

端末のキオスク動作を止めずに **OTA を段階実行**し、ヘルスチェックとロールバックで可用性を担保します。

### パッチとマイグレーション `（patches / migrations）`

**patches / migrations** 内のスクリプトは、`update_runner` 内での更新処理の中で順に実行されます。  
各ディレクトリのパスや管理ファイルの場所（例：`PATCH_DIR`, `PATCH_MARK` など）は `scripts/lib/config.sh` で設定されます。

> patches：時系列パッチ（**厳格な順次実行 & 途中停止**）

- **目的**：OS/ランタイム/依存ツールの導入・設定など、**一度きり**実行すべき更新を順序どおり適用。
- **命名規則**：`yyyymmdd_hhmmss_<内容>.sh`
- **実行順**：ファイル名の **日時で昇順** に必ず順に実行。
- **状態管理**：**成功した最後のファイル名**を `PATCH_MARK` に記録。次回は **記録より新しいものだけ** 実行。
- **失敗時挙動**：**エラー発生時点で停止**（それ以前の適用結果は有効）。以降のパッチは実行しない。

> migrations：番号付き移行（**番号順に続行 & 成功を .done で記録**）

- **目的**：更新バンドル内の構造変更・移行処理を段階適用。
- **実行順**：`migrations/*.sh` の **ファイル名順**。
- **状態管理**：`/opt/signage-core/signage-migrations/*.done` を記録。
- **スキップ**：`exit 11` は「要件未達」で **次回再試行**。
