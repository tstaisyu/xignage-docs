# signage-jetson

> ## **セットアップスクリプト群**

本スクリプト群は、**Raspberry Pi / NVIDIA Jetson** を対象に、端末を **サイネージ専用デバイス**として立ち上げるための一連の手順を自動化します。  
ネットワーク基盤の統一、アプリ導入と常駐化、AP フォールバック、更新基盤、推論ランタイム、キオスク起動、電源・権限周りまでを **冪等（何度でも再実行可）** に整えます。

### **1) 目的**

- **即戦力のサイネージ端末化**：起動＝表示・配信可能な状態（Openbox+Chromium キオスク、Node サーバ、Wi-Fi 管理 UI）
- **運用の安定化**：systemd-networkd への統一、Wi-Fi 命名・経路メトリック固定、AP 自動化、ログ永続化、UFW 設定
- **保守性の確保**：`signage-update.service` による更新／復旧、メトリクス送出、パッチ／マイグレーションの適用状態管理

### **2) 設計方針**

- **ボード自動判別**（Jetson / Pi）＋**安全スキップ**（対象外処理は実行しない）
- **冪等性**（差分適用・上書き条件判定・再実行耐性）
- **最小権限**（機密は `/etc/signage/secret.env` 600、sudoers は限定コマンドのみ）
- **クラウド正本型への移行**：端末内の Admin UI（`/admin` 配信）を廃止し、セットアップ/更新フローからも排除

### **3) 前提**

- OS:
  - **Raspberry Pi：Ubuntu Server 24.04 LTS（arm64）**
  - Jetson：TODO（Jetson の OS/JetPack 版はイメージ側に依存。根拠：`signage-jetson/README.md`）
- 必須変数：`DEVICE_ID`, `BOARD_TYPE`, `GH_TOKEN`, `AWS_*`（`/etc/signage/*.env` に配置）
- Python：**venv**（既定 `/opt/signage-core/venv`）に集約
- GPIO：Jetson は `Jetson.GPIO`、Pi は **libgpiod**

### **4) 実行ガイド**

#### 4-1. **初回の配置（`releases/initial`）**

```bash
sudo mkdir -p /opt/signage-core/signage-jetson/releases
sudo chown -R "$USER:$USER" /opt/signage-core
cd /opt/signage-core/signage-jetson/releases

# signage-jetsonリポのクローン
git clone https://github.com/<your-org-or-user>/signage-jetson.git initial
cd initial
```

#### 4-2. **一括セットアップの実行（`setup_all.sh`）**

`setup_all.sh` は `scripts/setup/` の `nnn_*.sh` を **番号順**に実行します。**000 のみ** 次の **5 必須引数**（`DEVICE_ID`, `BOARD_TYPE`, `GH_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`）と、**6つ目の任意引数** **`[ASSUME_ROLE_ARN]`** を受け取ります。
（`000_*.sh` は `if [ $# -lt 5 ]; then ... exit 1` で必須引数数を検証。`ASSUME_ROLE_ARN` は **引数 > 環境変数 > sample > 既定値** の優先度で解決されます）

- 事前検証：5 つの必須引数（下記）を**起動直後に検証**（未設定で即エラー）

```bash
sudo bash setup_all.sh \
  <DEVICE_ID> \
  <BOARD_TYPE> \
  <GH_TOKEN> \
  <AWS_ACCESS_KEY_ID> \
  <AWS_SECRET_ACCESS_KEY> \
  [ASSUME_ROLE_ARN]

# 例（任意引数なし：自動解決）
sudo bash setup_all.sh \
  XIG-JON-000 \
  jetsonorinnano \
  ghp_xxxxxxxxxxxxxxxxxxxxx \
  AKIAxxxxxxxxxxxxxxxx \
  wJalrXUtnFEMI/K7MDENG/bPxRfiCYxxxxxxxx

# 例（任意引数あり：明示指定）
sudo bash setup_all.sh \
  XIG-JON-000 \
  jetsonorinnano \
  ghp_xxxxxxxxxxxxxxxxxxxxx \
  AKIAxxxxxxxxxxxxxxxx \
  wJalrXUtnFEMI/K7MDENG/bPxRfiCYxxxxxxxx \
  arn:aws:iam::123456789012:role/iot-provisioner-role
```

!!! note "注意"
    - ネットワーク統一／AP 構成の適用中は **SSH が切断**される可能性があります。可能ならローカルコンソールで実行してください。  
    - すべて **冪等（再実行可）** です。失敗時も同じ手順で再実行できます。  
    - `releases/initial` の命名は後続スクリプト（例：`090_symlink_initial.sh`）の前提です。

#### 4-3. **引数の意味**

| 引数                      | 例                                                     | 説明                                                                                                               |
| ----------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DEVICE_ID`             | `XIG-JON-000`                                         | 端末識別子（監視・ログ・ホスト名整合に使用）                                                                                           |
| `BOARD_TYPE`            | `jetsonorinnano`／`raspberrypi4`                       | ボード種別（Jetson / Pi の分岐・最適化）                                                                                       |
| `GH_TOKEN`              | `ghp_xxx...`                                          | GitHub PAT（Releases 取得・検証に使用）                                                                                    |
| `AWS_ACCESS_KEY_ID`     | `AKIA...`                                             | AWS アクセスキー ID                                                                                                    |
| `AWS_SECRET_ACCESS_KEY` | `wJalrXUtnF...`                                       | AWS シークレットアクセスキー（機密）                                                                                             |
| `ASSUME_ROLE_ARN`（任意）   | `arn:aws:iam::123456789012:role/iot-provisioner-role` | **任意引数**。未指定時は **引数 > 環境変数 > `signage.env.sample` > 既定値** の順で解決し、`/etc/signage/signage.env` に出力（STEP 000 / 111）。 |

#### 4-4. **依存パッケージ（ `deps` ）**

- **APT 依存**は `scripts/lib/config.sh` の `DEPENDENCIES` 配列（ボード別）で管理
- **pip 依存**は venv (`/opt/signage-core/venv`) へ集約
  - 共通：`deps/pip-common.txt`
  - Raspberry Pi：`deps/pip-raspi.txt`
  - Jetson：`deps/pip-jetson.txt`（`081_install_jetson_deps.sh` で任意）

### **5) 各ユニットドキュメントの詳細**

> [**setup(000-099) - 初期セットアップ**](units/setup-000-099.md)

APT ブートストラップ、Wi-Fi 名称の安定化（`wlanINT`/`wlanUSB`）と経路メトリックによる主従切替、journald 永続化、AWS CLI v2 / Fluent Bit の導入、Python venv 準備など、運用前に必要な初期化を **冪等（再実行可）**なスクリプト群として提供します。Jetson / Raspberry Pi を自動判別し、不要処理は安全にスキップします。

> [**setup(100-199) - アプリ導入・サービス常駐化**](units/setup-100-199.md)

Node.js の指定バージョン導入、`signage-server` の GitHub Releases 配布・展開・`current` 切替、（Jetson のみ）`xignage-edge-detection` 導入、`xignage-metrics` の配置・依存導入・systemd 常駐化、`call-button.service`（IO 常駐）、IoT 証明書の安全配置と `/etc/signage/iot.env` 更新、Chromium 管理ポリシー導入までをカバーします。**端末内 Admin UI の配信は行いません。**

> [**setup(200-599) - ネットワーク／AP／ブート最適化**](units/setup-200-599.md)

ネットワーク管理を **systemd-networkd に統一**（競合サービス無効化＋`eth0` netplan 適用）、**AP モード（hostapd/dnsmasq）**の冪等構成、Wi-Fi 接続失敗時の **AP 自動起動（oneshot＋timer）**、ブラウザからの **Wi-Fi 設定 GUI** 配備、そして **起動最適化**（snapd の hold／不要サービスのマスク等）をカバーします。すべて **冪等（再実行可）**で、ボード種別や構成に応じて不要処理は安全にスキップします。

> [**setup(600-899) - 更新基盤・推論ランタイム・公開設定**](units/setup-600-899.md)

`update_runner` / `update_manager` / `healthcheck` の配置と **oneshot ユニット `signage-update.service`** による更新実行、**Jetson 向け TensorRT/PyCUDA/OpenCV 最小ランタイム**導入（Pi は自動スキップ）、コンテンツ格納ディレクトリ整備・**linger 有効化**・**ホスト名設定＋mDNS**・**systemd --user での Node サービス起動**、**PORT=3001** の drop-in 上書き、**Nginx リバースプロキシ（:3000 → 127.0.0.1:3001）**、および **UFW 許可ルール**の適用までをカバーします。**/admin の静的配信は行いません。**

> [**setup(900-999) - ブート見た目／キオスク化／電源・権限**](units/setup-900-999.md)

Jetson の `extlinux.conf`／Raspberry Pi の `config.txt`・`cmdline.txt` を調整して起動ログ/スプラッシュを抑制し、`tty1` 自動ログイン → Openbox + Chromium の **キオスク起動**を設定、GDM を停止します。音声は **HDMI を既定 sink** に固定。Pi 向けに **ブートローダ電源設定（halt で電源断／GPIO wake）** と **GPIO シャットダウン**を提供。運用用に **sudoers ドロップイン**（電源・更新・Wi-Fi リセット）を最小権限で追加し、適用済みパッチ識別の **パッチマーカー**（`999_patch_mig_marker.sh`）も生成します。

---

## **Raspberry Pi ベースイメージ**

Raspberry Pi 向けの **OSベースイメージ（SDカードイメージ）** と  
対応する `signage-jetson` タグ・S3 パスの一覧は以下にまとめています。

- [Raspberry Pi ベースイメージ管理](infra/raspi-images.md)

---

## **IO（ボタン／ToF／イベント）**

> [**IO コンポーネント仕様 — `components/io.md`**](components/io.md)

物理ボタンの**デバウンス**と**LED制御**、ToF の **mm 正規化**を含む距離読取、AWS IoT への **MQTT/TLS 送信**、および常駐アプリ（**50Hz ループ／スナップショット** `io_state.json`／**イベントログ JSONL**）の仕様を集約。  
Jetson は `Jetson.GPIO`、それ以外（Pi）は **libgpiod** を使用します（BCM 番号）。

---

## **メトリクス送信サービス（metrics）**

> [**メトリクス送信 — `metrics/index.js`**](components/metrics-service.md)

端末の温度/電圧/スロットルなどのメトリクスを **30 秒間隔**で **AWS IoT Core (MQTTS)** へ送信するサービス。  
`boards/pi.js` / `boards/jetson.js` / `boards/generic.js` による **ボード別取得**に対応し、`xignage-metrics.service` から実行。

- **トピック**: `xignage/v1/devices/<thing>/metrics/system`
- **必須環境変数**: `IOT_ENDPOINT`, `IOT_CERT_PATH`, `IOT_KEY_PATH`, `IOT_CA_PATH`
- **任意**: `IOT_THING_NAME`（`--device` を上書き）

前提となる証明書の用意は ↓  

### **インフラ（AWS IoT 証明書）**

> [**AWS IoT デバイス単位のプロビジョニング — `create_device_thing.sh` + `get_iot_creds.sh`**](infra/aws-iot-certs.md)

開発機で **Thing/証明書/ポリシー付与**をデバイス単位で行い、`/tmp/aws-iot-certs` に出力 → 端末側の **`112_write_iot_env.sh`** が安全配置します。

---

## **ランタイムツール `（scripts/bin/）` / `update.sh`**

サイネージ稼働中に動く実行バイナリの要点をまとめます。詳細は各ページへ。

| 区分     | スクリプト            | 概要                                         | 主な連携/ログ                          |
|---|---|---|---|
| Wi-Fi/AP | `wifi_or_ap` | STA 接続試行 → 失敗で AP へフォールバック。優先 IF の順序付け・疎通/ゲートウェイ検証・`/run/ap_hold` 管理を実施。 | `wifi-or-ap.service/.timer`、`$WIFI_OR_AP_LOG` |
| Wi-Fi/AP | `ap_start`   | 指定 IF に静的 IP を設定し、`dnsmasq` と `hostapd` を起動して AP を立ち上げ。 | `dnsmasq` / `hostapd`、`$AP_START_LOG_FILE` |
| 更新 | `update_manager` | `signage-update.service` から起動。GUI停止 → ランナー実行 → `/tmp/update_done` 待機 → **再起動**。 | `/var/log/update_manager/…`（30日ローテ） |
| 更新 | `update_runner` | NTP同期確認 → パッチ適用 → `signage-jetson` TAR ステージング・切替・世代保持 → **metrics 同期** → `update.sh` 実行 → `/tmp/update_done`。 | `/var/log/update_runner/update_runner_*.log` |
| 更新 | `update.sh` | アプリ単体更新（`signage-server` / Jetson では `xignage-edge-detection`）。**staging → current** 切替、失敗時**即ロールバック**。 | `/var/log/update/update_*.log` / `update_debug_*.log` |
| 更新 | `healthcheck` | 必須ファイル存在と **Bash/Python 構文**をトップレベルで検査。OK で `0`。 | `journalctl`（各サービスの稼働確認の補助） |

### **起動時 Wi-Fi/AP** → [Wi-Fi ブートツール](components/wifi-boot-tools.md)

起動後に **既知 Wi-Fi へ接続を試行し、失敗時は AP へ自動フォールバック**します。

### **更新サブシステム** → [アップデートツール](components/update-tools.md)

端末のキオスク動作を止めずに **OTA を段階実行**し、ヘルスチェックとロールバックで可用性を担保します。

### **パッチとマイグレーション `（patches / migrations）`**

**patches / migrations** 内のスクリプトは、`update_runner` 内での更新処理の中で順に実行されます。  
各ディレクトリのパスや管理ファイルの場所（例：`PATCH_DIR`, `PATCH_MARK` など）は `scripts/lib/config.sh` で設定されます。

> patches：時系列パッチ（**厳格な順次実行 & 途中停止**）

- **目的**：OS/ランタイム/依存ツールの導入・設定など、**一度きり**実行すべき更新を順序どおり適用。
- **命名規則**：`yyyymmdd_hhmmss_<内容>.sh`
- **実行順**：ファイル名の **日時で昇順** に必ず順に実行。
- **状態管理**：**成功した最後のファイル名**を `PATCH_MARK` に記録。次回は **記録より新しいものだけ** 実行。
- **失敗時挙動**：**エラー発生時点で停止**（それ以前の適用結果は有効）。以降のパッチは実行しない。

> migrations：番号付き移行（**番号順に続行 & 成功を .done で記録**）

- **目的**：アプリのデータ移行・設定生成など、**何度でも呼べるが成功は一度でよい**処理を番号順に適用。
- **命名規則**：`<num/3桁>_<内容>.sh`
- **実行順**：**3桁番号の昇順**で実行。
- **状態管理**：**成功したスクリプト**と同名で **`.done` フラグファイル**を `/opt/signage-core/signage-migrations/` に生成。
- **戻り値の扱い**：`0=OK`, `11=skip` は成功扱い・`.done` 作成（`11` は `.done` を作成しない実装）。  
  **それ以外の非 0 は失敗**としてログ記録し、更新処理は中断。

---

## **共通ライブラリ（config.sh / functions.sh）**

- [環境変数リファレンス - config.sh](files/config-sh.md)
- [ユーティリティ関数リファレンス - functions.sh](files/functions-sh.md)
