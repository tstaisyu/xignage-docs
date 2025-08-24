# signage-jetson

> ## **セットアップスクリプト群**

本スクリプト群は、**Raspberry Pi（Ubuntu）/ NVIDIA Jetson（L4T/Ubuntu）** を対象に、端末を **サイネージ専用デバイス**として立ち上げるための一連の手順を自動化します。  
ネットワーク基盤の統一、アプリ導入と常駐化、AP フォールバック、更新基盤、推論ランタイム、キオスク起動、電源・権限周りまでを **冪等（何度でも再実行可）** に整えます。

### **1) 目的**  

- **即戦力のサイネージ端末化**：起動＝表示・配信可能な状態（Openbox+Chromium キオスク、Nginx リバースプロキシ、Node サーバ）
- **運用の安定化**：systemd-networkd への統一、Wi-Fi 命名・経路メトリック固定、AP 自動化、ログ永続化、UFW 設定
- **保守性の確保**：`signage-update.service` による更新／復旧、メトリクス送出、パッチマーカーで適用状態を可視化

### **2) 設計方針**  

- **ボード自動判別**（Jetson / Pi）＋**安全スキップ**（対象外処理は実行しない）
- **冪等性**（差分適用・上書き条件判定・再実行耐性）
- **最小権限**（機密は `/etc/signage/secret.env` 600、sudoers は限定コマンドのみ）
- **分割フェーズ**：詳細は、下部5)に記載  

### **3) 前提**  

- OS: Ubuntu 系（Jetson L4T/Ubuntu、Ubuntu for Raspberry Pi）
- 必須変数：`DEVICE_ID`, `BOARD_TYPE`, `GH_TOKEN`, `AWS_*`（`/etc/signage/*.env` に配置）

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

#### 4-2. **一括セットアップの実行**  

`setup_all.sh` は `scripts/setup/` の `nnn_*.sh` を **番号順**に実行します。**000 のみ** 次の 5 引数（`DEVICE_ID`, `BOARD_TYPE`, `GH_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`）を受け取り、それ以外のスクリプトは **引数なし**で実行されます。  
（`000_*.sh` は `if [ $# -lt 5 ]; then ... exit 1` で引数数を検証）

```bash
sudo bash setup_all.sh \
  <DEVICE_ID> \
  <BOARD_TYPE> \
  <GH_TOKEN> \
  <AWS_ACCESS_KEY_ID> \
  <AWS_SECRET_ACCESS_KEY>

# 例
sudo bash setup_all.sh \
  XIG-JON-000 \
  jetsonorinnano \
  ghp_xxxxxxxxxxxxxxxxxxxxx \
  AKIAxxxxxxxxxxxxxxxx \
  wJalrXUtnFEMI/K7MDENG/bPxRfiCYxxxxxxxx
```  

#### 4-3. **引数の意味**  

| 引数                      | 例                               | 説明                            |
| ----------------------- | ------------------------------- | ----------------------------- |
| `DEVICE_ID`             | `XIG-JON-000`                   | 端末識別子（監視・ログ・ホスト名整合に使用）        |
| `BOARD_TYPE`            | `jetsonorinnano`／`raspberrypi4` | ボード種別（Jetson / Pi の分岐・最適化）    |
| `GH_TOKEN`              | `ghp_xxx...`                    | GitHub PAT（Releases 取得・検証に使用） |
| `AWS_ACCESS_KEY_ID`     | `AKIA...`                       | AWS アクセスキー ID                 |
| `AWS_SECRET_ACCESS_KEY` | `wJalrXUtnF...`                 | AWS シークレットアクセスキー（機密）          |

!!! note "注意"
    - ネットワーク統一／AP 構成の適用中は **SSH が切断**される可能性があります。可能ならローカルコンソールで実行してください。  
    - すべて **冪等（再実行可）** です。失敗時も同じ手順で再実行できます。  
    - `releases/initial` の命名は後続スクリプト（例：`090_symlink_initial.sh`）の前提です。

### **5) 各ユニットドキュメントの詳細**  

> [**setup(000-099) - 初期セットアップ**](units/setup-000-099.md)

デバイス識別子・資格情報の配置、Wi-Fi 名称の安定化（`wlanINT`/`wlanUSB`）と経路メトリックによる主従切替、journald の永続化、AWS CLI / Fluent Bit の最小構成など、運用前に必要な初期化を **冪等（再実行可）**なスクリプト群として提供します。Jetson / Raspberry Pi を自動判別し、不要処理は安全にスキップします。

> [**setup(100-199) - アプリ導入・サービス常駐化**](units/setup-100-199.md)

Node.js の指定バージョン導入（見つからない場合は 20.x へフォールバック）、`signage-server` / `signage-admin-ui` を GitHub Releases から取得・SHA256 検証・タイムスタンプ展開（`releases/<TIMESTAMP>`）・`current` 切替、（Raspberry Pi 以外での）`xignage-edge-detection` 導入、`xignage-metrics` の配置・依存導入・systemd 常駐化、さらに AWS IoT 証明書の安全配置と `metrics.env` 更新・サービス再起動による反映までを **冪等（再実行可）**なスクリプト群として提供します。ボード種別に応じて不要処理は安全にスキップします。

> [**setup(200-599) - ネットワーク／AP／ブート最適化**](units/setup-200-599.md)

ネットワーク管理を **systemd-networkd に統一**（競合サービス無効化＋`eth0` の netplan 適用）、**AP モード（hostapd/dnsmasq）**の冪等構成、Wi-Fi 接続失敗時の **AP 自動起動（oneshot＋timer）**、ブラウザからの **Wi-Fi 設定 GUI** 配備、そして **起動最適化**（snapd の長期 hold＋ソケット起動化／不要サービスのマスク／`fstrim` タイマー／Raspberry Pi の Bluetooth HCI 無効化）をカバーします。すべて **冪等（再実行可）**で、ボード種別や構成に応じて不要処理は安全にスキップします（ネットワーク切替時の一時断に留意）。

> [**setup(600-899) - 更新基盤・推論ランタイム・公開設定**](units/setup-600-899.md)

`update_runner` / `update_manager` / `healthcheck` の配置と **oneshot ユニット `signage-update.service`** による更新実行、**Jetson 向け TensorRT/PyCUDA/OpenCV 最小ランタイム**導入（Pi は自動スキップ）、コンテンツ格納ディレクトリ整備・**linger 有効化**・**ホスト名設定＋mDNS**・**systemd --user での Node サービス起動**、**PORT=3001** の drop-in 上書き、**Nginx vhost（:3000 → 127.0.0.1:3001／`/admin` 静的配信／`/socket.io` WS／`/api` REST）**、および **UFW 許可ルール**の適用までをカバーします。すべて **冪等（再実行可）**で、ボード種別や構成に応じて不要処理は安全にスキップします。

> [**setup(900-999) - ブート見た目／キオスク化／電源・権限**](units/setup-900-999.md)

Jetson の `extlinux.conf`／Raspberry Pi の `config.txt`・`cmdline.txt` を調整して起動ログ/スプラッシュを抑制し、`tty1` 自動ログイン → Openbox + Chromium の **キオスク起動**（Jetson は Xorg の回転・解像度、Pi は KMS オーバレイ）を設定、GDM を停止します。音声は **HDMI を既定 sink** に固定。Pi 向けに **ブートローダ電源設定（halt で電源断／GPIO wake）** と **GPIO18 の電源断制御**を提供。運用用に **sudoers ドロップイン**（電源・更新・Wi-Fi リセット）を最小権限で追加し、適用済みパッチ識別の **パッチマーカー** も生成します。すべて **冪等（再実行可）**で、ボード判定により不要処理は安全にスキップします（自動ログインのセキュリティに注意）。

---

## **ランタイムツール `（scripts/bin/）` / `update.sh`**

サイネージ稼働中に動く実行バイナリの要点をまとめます。詳細は各ページへ。

| 区分     | スクリプト            | 概要                                         | 主な連携/ログ                          |
|---|---|---|---|
| Wi-Fi/AP | `wifi_or_ap` | STA 接続試行 → 失敗で AP へフォールバック。優先 IF の順序付け・疎通/ゲートウェイ検証・`/run/ap_hold` 管理を実施。 | `wifi-or-ap.service/.timer`、`$WIFI_OR_AP_LOG` |
| Wi-Fi/AP | `ap_start`   | 指定 IF に静的 IP を設定し、`dnsmasq` と `hostapd` を起動して AP を立ち上げ。 | `dnsmasq` / `hostapd`、`$AP_START_LOG_FILE` |
| 更新 | `update_manager` | `signage-update.service` から起動。GUI停止 → ランナー実行 → `/tmp/update_done` 待機 → **再起動**。 | `/var/log/update_manager/…`（30日ローテ） |
| 更新 | `update_runner` | NTP同期確認 → パッチ適用 → `signage-jetson` TAR ステージング・切替・世代保持 → 完了シグナル。 | `$UPDATE_RUNNER_LOG`（例：`/var/log/update_runner/update_runner_*.log`） |
| 更新 | `update.sh` | アプリ単体更新（`signage-server` / `signage-admin-ui` / Jetson では `xignage-edge-detection`）。**staging → current** 切替、失敗時**即ロールバック**。 | `$UPDATE_SCRIPT_LOG`、`download_with_retry`、`health`(200) |
| 更新 | `healthcheck` | 必須ファイル存在と **Bash/Python 構文**をトップレベルで検査。OK で `0`。 | `journalctl`（各サービスの稼働確認の補助） |

### **起動時 Wi-Fi/AP** → [Wi-Fi ブートツール](components/wifi-boot-tools.md)  

起動後に **既知 Wi-Fi へ接続を試行し、失敗時は AP へ自動フォールバック**します。  

> 実行フロー（安定接続のための自動切替）

1) 起動後 30s（以降 5分間隔）で `wifi-or-ap.service` が実行  

2) 既知 SSID へ **STA 接続**を試行（IF 準備 → wpa_supplicant 起動）  

3) ルート/GW/疎通（任意で `PING_TARGET`）が OK なら **運用続行**  

4) 失敗時は **AP 起動**（静的 IP 付与 → dnsmasq/hostapd 起動）  

5) `/run/ap_hold` により **再試行を一定時間抑制**（フラップ防止）

### **更新サブシステム** → [アップデートツール](components/update-tools.md)  

端末のキオスク動作を止めずに **OTA を段階実行**し、ヘルスチェックとロールバックで可用性を担保します。  

> 実行フロー（安全な段階更新）

1) GUI停止 & `/tmp/UPDATING` 設置  

2) `update_runner` 起動（NTP確認 → パッチ適用 → TAR展開）  

3) ヘルスチェック OK なら `current` 切替（NG はロールバック）  

4) `/tmp/update_done` で完了通知 → 再起動

---

## **共通ライブラリ（config.sh / functions.sh）**

> [**環境変数リファレンス — `config.sh`**](files/config-sh.md)

すべてのセットアップ／ランタイムスクリプトで共有する **既定値と環境変数**を一元管理。ボード種別、ディレクトリ、ネットワーク/AP、Nginx、GStreamer、キオスク設定などの基準値を提供します。

> [**ユーティリティ関数リファレンス — `functions.sh`**](files/functions-sh.md)  

スクリプト共通の **ヘルパー関数**群。`log_info/warn/error`（ログ）、`install_or_link`（シンボリックリンク配置・退避）、`download_with_retry`（リトライ付き取得）などを収録。

<!--
## 目的

## 概要

## ファイル構成

## セットアップと要件

## 設定（Environment Variables）

## 使い方（Quickstart）

## インターフェース

### 入力

### 出力

## 運用（Runbook）

## 依存関係

## バージョン互換性

## セキュリティ

## 既知の課題

## 変更履歴（参照）
-->