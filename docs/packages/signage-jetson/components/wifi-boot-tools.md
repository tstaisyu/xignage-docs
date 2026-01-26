# Wi-Fi ブートツール（ap_start / wifi_or_ap）

起動後に **既知 Wi-Fi へ接続**を試み、失敗時は **AP モードへフォールバック**するためのツール群です。  
Wi-Fi 管理は **NetworkManager** を使用します。

## **wifi_or_ap**

- NetworkManager の接続状態と IP 付与状況を確認
- **オンライン判定**に応じて AP を起動/停止
- 状態を `/run/wifi_or_ap.state` に保存し、
  `OFFLINE_GRACE_SEC` / `ONLINE_STABLE_SEC` / `AP_MIN_UP_SEC` でヒステリシス制御

### **主な変数**

| 種別 | 変数名 | 既定 | 説明 |
| --- | --- | --- | --- |
| 任意 | `OFFLINE_GRACE_SEC` | `60` | オフライン判定の猶予（秒） |
| 任意 | `ONLINE_STABLE_SEC` | `20` | オンライン安定判定（秒） |
| 任意 | `AP_MIN_UP_SEC` | `30` | AP 起動後の最短維持時間（秒） |
| 任意 | `STA_IF_ORDER` | `wlanUSB wlanINT`（Pi）/`wlanINT`（Jetson） | STA 接続確認の順序 |
| 任意 | `NM_HOTSPOT_CONN` | `xignage-hotspot` | NM の AP 接続名 |

### **状態ファイル**

- `/run/wifi_or_ap.state`：最終オンライン/オフライン時刻、AP 起動時刻など
- `/run/wifi_or_ap.lock`：同時実行防止ロック

---

## **ap_start**

- NetworkManager のホットスポットを作成・起動
- SSID / PSK / IP は `config.sh` の設定を使用
- Captive portal 用 DNS リダイレクトを
  `/etc/NetworkManager/dnsmasq-shared.d/captive-portal.conf` に作成

---

## **systemd ユニット**

- `wifi-or-ap.service`：oneshot
- `wifi-or-ap.timer`：**起動 30 秒後** + **非アクティブ後 20 秒**で再実行

