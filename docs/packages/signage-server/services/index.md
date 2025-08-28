# サービス

> ## [**System / Platform**](./system.md)

端末情報・OS/時刻/NTP・GPU統計・画面回転・電源/再起動・更新トリガ・ローカル設定など、**端末内の制御/取得**をまとめています。

- 主な機能
  - 端末情報の統合取得（`deviceInfo.js`：モデル/OS/カーネル/JetPack/Python/Node/GPU/タイムゾーン/NTP）
  - OS/時刻/NTP 取得（`systemInfo.js`：`/etc/os-release`、`timedatectl` など）
  - GPU統計（`gpuStats.js`：Jetson=`tegrastats`+sysfs、Raspberry Pi=`vcgencmd`、その他は`N/A`）
  - 電源断・再起動（`systemManager.js`：`sudo poweroff/reboot`）
  - 更新トリガ（`updateManager.js`：`systemctl start signage-update.service`）
  - 画面回転/タッチ行列適用（`rotationManager.js`：Jetson=Xorg設定、その他=xrandr/xinput）
  - ローカル設定の読み書き（`localSettingsService.js`：`/var/lib/signage_local/localSettings.json`）

---

> ## [**Network / Registration**](./network.md)

**外部連携/登録・ネットワーク状態**に関わるサービスをまとめています。優先IFの順で IP/MAC を検出し、**変化時のみ**登録します。

- 主な機能
  - 端末情報のクラウド登録（`deviceInfoRegistration.js`：`POST ${SERVER_URL}/api/device-info/register`）
  - IP/MAC 検出と登録（`networkRegistration.js`）
    - 優先IF順：`WIFI_PRIORITY_INTERFACES`（例：`wlP1p1s0,wlanUSB,wlanINT`）
    - 再試行：`MAX_RETRIES=10`、`RETRY_INTERVAL_MS=10000`（10秒）
    - フォールバック：IP=`127.0.0.1`、MAC=`00:00:00:00:00:00`
    - API：`/api/ip/register`・`/api/mac/register`
  - Wi-Fi設定の全削除＆再起動（`netManager.js`：`clearWifiConfAndReboot()`）
    - 対象IF：`WIFI_INTERFACES`（例：`wlanUSB,wlanINT`）
    - `wpa_cli remove_network all → save_config → reconfigure`、最後に `sudo reboot`

---

> ## [**Media / Content**](./media.md)

プレイリスト管理、サムネイル生成（画像/動画）、アップロードを扱う **コンテンツ層サービス**のまとまりです。

- 主な機能
  - プレイリストのロード/保存/並び替え/サムネイルURL付与（`playlistManager.js`）
  - 画像サムネイル生成（`imageService.js`：240×240・白背景・EXIF回転考慮）
  - 動画サムネイル生成（`videoService.js`：ffmpegで1秒目フレームを240×240にパディング）
  - Multer受領ファイルの保存とカテゴリ解決（`uploadService.js`）
