# Wi-Fi ブートツール（ap_start / wifi_or_ap）

起動後に **既知 Wi-Fi へ接続**を試み、失敗時は **AP モードへフォールバック**するためのツール群です。

## **wifi_or_ap**

- 早期疎通チェック（`PING_TARGET` への ping が成功すれば終了）
- `wpa_supplicant-<iface>.conf` が無ければ AP へフォールバック
- `wpa_supplicant@<iface>` を起動し、`wpa_state=COMPLETED` まで待機
- 成功時は networkd に DHCP を委任し、`networkctl reconfigure/renew` を実行
- 失敗時は `ap_start` を起動し、`/run/ap_hold` で再試行を抑制

### **主な変数**

| 種別 | 変数名 | 既定 | 説明 |
|---|---|---|---|
| 任意 | `AP_HOLD_DURATION` | `300` | AP 移行後の STA 再試行抑制（秒） |
| 任意 | `PING_TARGET` | `8.8.8.8` | 早期疎通確認の宛先 |

### **STA 設定ファイル**

`/etc/wpa_supplicant/wpa_supplicant-<iface>.conf` を参照します。

---

## **ap_start**

- 指定 IF に静的 IP を付与
- `dnsmasq` と `hostapd` を起動して AP を立ち上げ

---

## **systemd ユニット**

- `wifi-or-ap.service`：oneshot
- `wifi-or-ap.timer`：**起動 30 秒後** + **5 分間隔**
