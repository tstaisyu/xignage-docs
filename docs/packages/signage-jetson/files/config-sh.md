# 環境変数リファレンス - `config.sh`

サイネージ端末（**Raspberry Pi / NVIDIA Jetson**）向けの **セットアップ＆ランタイムスクリプト**で参照する環境変数を一元定義します。  
`setup_all.sh` や各 `scripts/setup/*.sh` の **冒頭で `source`** して利用します。

- 役割: 各種ディレクトリ／サービス名／ネットワーク/AP 設定／Nginx／GStreamer／キオスク等の既定値を提供
- 対象: Ubuntu 系（Jetson L4T/Ubuntu, Ubuntu for Raspberry Pi）
- 位置: `scripts/lib/config.sh`

## **読み込み順と優先順位**

1. **`/etc/signage/signage.env`** を先に読み込み（存在時）  
2. 続けて **`config.sh` の既定値** を適用  
3. その後に **シェル上で上書きした環境変数** があれば、それが最終値

!!! note
    `config.sh` は **`/etc/signage/secret.env` を読み込みません**。  
    端末ごとの恒久設定は `/etc/signage/signage.env` に記載するのが推奨です。

## **変数リファレンス（グループ別）**

### **0) ボード判定／既定値**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `BOARD_TYPE` | `pi` | `*jetson*` / `*pi*` / `*rasp*` を含む文字列で分岐 |
| `FALLBACK_USERNAME` / `FALLBACK_HOME` | `xig` / `/home/xig` | 実行ユーザ検出に失敗した際のフォールバック |
| `DEPENDENCIES` | 配列 | APT 依存（Jetson/Pi で内容差あり） |
| `WIFI_INTERFACE` | `wlanINT` | 代表 Wi-Fi IF 名 |
| `WIFI_INTERFACES` | `("wlanUSB" "wlanINT")` | 命名固定対象 IF 群（Jetson は `wlanINT` のみ） |

### **1) ユーザ／ホーム／ログ**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `USERNAME` / `HOME_DIR` | `SUDO_USER` → `USER` → Fallback | 実行ユーザ／ホーム |
| `SIGNAGE_CORE_DIR` | `/opt/signage-core` | ルートディレクトリ |
| `LOG_FILE` | `$SIGNAGE_CORE_DIR/setup_all_idempotent.log` | セットアップ共通ログ |

### **2) サービスログ／フラグ**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `SERVICE_LOG_DIR` | `/var/log/signage-core/service-logs` | サービス系ログ置き場 |
| `UPDATE_RUNNER_LOG` | `$SIGNAGE_CORE_DIR/update_runner.log` | 既定の更新ランナーログ（実行時に `/var/log/update_runner/...` へ上書き） |
| `WIFI_MGR_LOG` | `$SERVICE_LOG_DIR/wifi_manager.log` | Wi-Fi マネージャログ |
| `WIFI_FLAG_DIR` / `WIFI_FLAG_FILE` | `/var/lib/signage-jetson` / `…/wifi-configured` | Wi-Fi 設定済み判定フラグ |

### **3) Node.js／リポジトリ**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `NODE_VERSION` | `22.x` | 既定 Node.js バージョン |
| `NODE_APP_DIR` | `$SIGNAGE_CORE_DIR/signage-server` | Node アプリ設置先 |

### **4) ネットワーク／AP**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `RESOLV_FILE` | `/etc/resolv.conf` | リゾルバ |
| `TARGET_NS` | `nameserver 8.8.8.8` | 既定 NS |
| `NETPLAN_FILE` | `/etc/netplan/50-ap.yaml` | netplan 適用ファイル |
| `AP_IP` / `AP_STATIC_IP` | `192.168.4.1` / `192.168.4.1/24` | AP IP |
| `SSID` / `PASSPHRASE` | `Device-Setup` / `setupwifi` | AP SSID/PSK |
| `HOSTAPD_CONF` / `DNSMASQ_CONF` | `/etc/hostapd/hostapd.conf` / `/etc/dnsmasq.conf` | 旧設定ファイル（cleanup 用） |
| `WIFI_CONNECT_SLEEP` | `1` | 接続待ち秒数 |
| `STA_IF_ORDER` | `wlanUSB wlanINT` | STA 接続確認の優先順 |

### **5) AP／Wi-Fi ヘルパー**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `AP_START_SRC` / `AP_START_DEST` | `scripts/bin/ap_start` / `/usr/local/bin/ap_start` | AP 起動ヘルパー |
| `WIFI_OR_AP_SRC` / `…_DEST` | `scripts/bin/wifi_or_ap` / `/usr/local/bin/wifi_or_ap` | Wi-Fi or AP 切替ヘルパー |
| `WIFI_OR_AP_SERVICE_FILE` / `…_TIMER_FILE` | `/etc/systemd/system/wifi-or-ap.service` / `.timer` | ユニット |
| `WIFI_OR_AP_LOG` | `/var/log/wifi_or_ap.log` | ログ |
| `WIFI_OR_AP_ENV_FILE` | `/etc/signage/wifi-or-ap.env` | しきい値上書き用 |
| `WIFI_OR_AP_STATE_FILE` | `/run/wifi_or_ap.state` | 状態ファイル |
| `WIFI_OR_AP_LOCK_FILE` | `/run/wifi_or_ap.lock` | ロックファイル |
| `AP_START_LOCK_FILE` | `/run/ap_start.lock` | AP 起動ロック |
| `OFFLINE_GRACE_SEC` | `60` | オフライン判定猶予 |
| `ONLINE_STABLE_SEC` | `20` | オンライン安定判定 |
| `AP_MIN_UP_SEC` | `30` | AP 最小維持時間 |

### **6) Web UI（Wi-Fi 管理）**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `WEB_ROOT` / `WEB_TEMPLATES_DIR` | `/var/www/html` / `…/templates` | ルート／テンプレート |
| `WIFI_MANAGER_FILE` | `web/wifi_manager.py` | Flask アプリ相対パス |
| `INDEX_HTML_FILE` | `static/index.html` | 初期 HTML |
| `WIFI_MANAGER_APP` | `$WEB_ROOT/$WIFI_MANAGER_FILE` | 配置先 |
| `WIFI_MANAGER_SERVICE_FILE` | `/etc/systemd/system/wifi-manager.service` | ユニット |

### **7) 更新基盤（Signage Jetson）**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `SIGNAGE_JETSON_DIR` | `$SIGNAGE_CORE_DIR/signage-jetson` | ルート |
| `UPDATE_RUNNER_SRC/DEST` / `UPDATE_MANAGER_SRC/DEST` | `scripts/bin/*` / `/usr/local/bin/*` | バイナリ |
| `HEALTHCHECK_SRC/DEST` | 同上 | ヘルスチェック |
| `USER_SYSTEMD_DIR` | `$HOME_DIR/.config/systemd/user` | user ユニット |
| `SIGNAGE_UPDATE_SERVICE_FILE/PATH` | `signage-update.service` | system ユニット |
| `NTP_MAX_WAIT` / `NTP_WAIT_INTERVAL` | `60` / `2` | NTP 同期待ち |

### **8) サーバ／Nginx**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `SIGNAGE_SERVER_SERVICE_FILE/PATH` | `signage-server.service` / `$USER_SYSTEMD_DIR/...` | user ユニット |
| `SIGNAGE_SERVER_DROPIN_DIR/FILE` | `$HOME/.config/systemd/user/signage-server.service.d/override.conf` | drop-in |
| `DEFAULT_SITE` | `/etc/nginx/sites-enabled/default` | 既定サイト |
| `SITE_NAME` / `NGINX_AVAILABLE` / `NGINX_ENABLED` | `signage-device` / sites-* | vhost |

### **9) Firewall（UFW）**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `FIREWALL_PORTS` | `22/tcp`, `3000/tcp`, `3001/tcp`, `443/tcp` | グローバル許可 |
| `FIREWALL_AP_IF_ALLOW_PORTS` | `53`, `67/udp` | AP IF で許可 |
| `FIREWALL_AP_ALLOW_PORTS` | `5000/tcp`, `80/tcp` | AP サブネットで許可 |
| `FIREWALL_AP_DENY_PORTS` | `22/tcp`, `3000/tcp`, `3001/tcp`, `443/tcp` | AP サブネットで拒否 |

### **10) EXTLINUX**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `EXT_LINUX_CONF_FILE` | `/boot/extlinux/extlinux.conf` | Jetson 起動設定 |

### **11) GStreamer／update.sh**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `GST_DEVICE` / `GST_WIDTH` / `GST_HEIGHT` | `/dev/fb0` / `1080` / `1920` | フレームバッファ出力 |
| `GST_REFRESH_COLOR_PATTERN` | `white` | 画面更新色 |
| `GST_NUM_BUFFERS` | `1` | バッファ個数 |
| `DISPLAY_NUMBER` | `:0` | X DISPLAY |
| `APP_UID` | `id -u "$USERNAME"` | 実ユーザ UID |
| `UPDATE_SCRIPT_LOG` | `/var/log/update.log` | 更新ログ |

### **12) getty（自動ログイン）**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `GETTY_OVERRIDE_DIR` / `GETTY_OVERRIDE_FILE` | `/etc/systemd/system/getty@tty1.service.d/override.conf` | 画面ログイン制御 |

### **13) カーソル／Xinit**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `CURSORS_DIR` | `$HOME/.config/blank_cursors` | 透明カーソル |
| `XINITRC_FILE` | `$HOME/.xinitrc` | キオスク起動定義 |

### **14) KMS Overlay（Pi）**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `FIRMWARE_CONFIG_FILE` | `/boot/firmware/config.txt` | Pi 設定 |
| `KMS_OVERLAY` | `dtoverlay=vc4-kms-v3d-pi4` | KMS ドライバ |
| `FB_LINE` | `max_framebuffers=2` | FB 設定 |

### **15) Xorg（Jetson）**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `XORG_CONF_DIR` / `XORG_CONF_FILE` | `/etc/X11/xorg.conf.d/10-nvidia-rotate.conf` | Xorg 設定 |
| `DISPLAY_OUTPUT` / `DISPLAY_RESOLUTION` / `DISPLAY_ROTATION` | `DFP-0` / `1920x1080` / `right` | 出力/解像度/回転 |

### **16) PulseAudio**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `PULSE_DIR` / `PULSE_CONF_FILE` | `/etc/pulse/default.pa` | 設定先 |
| `HDMI_SINK` | `alsa_output.platform-3510000.hda.hdmi-stereo` | 既定 HDMI sink |

### **17) Metrics Service**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `METRICS_SRC` | `/opt/signage-core/signage-jetson/current/scripts/metrics/` | ソース |
| `METRICS_DST` | `/opt/xignage-metrics` | 配置先 |

### **18) パッチ管理**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `PATCH_DIR` | `$SIGNAGE_CORE_DIR/signage-jetson/current/patches` | パッチ群 |
| `PATCH_MARK` | `$SIGNAGE_CORE_DIR/patches_applied.txt` | 最終適用マーカー |

### **末尾) CONFIG_SH**

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `CONFIG_SH` | `$SIGNAGE_CORE_DIR/signage-jetson/current/scripts/lib/config.sh` | 本ファイルの絶対パス |
