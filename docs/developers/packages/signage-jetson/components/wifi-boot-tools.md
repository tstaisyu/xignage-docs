# Wi-Fi ブートツール（ap_start / wifi_or_ap）

これらのスクリプトは、起動後に **既知Wi-Fiへ接続**を試み、失敗時は **APモードへフォールバック**するためのツール群。

## **関連スクリプト**

- `wifi_or_ap` … 接続試行→失敗ならAP起動の判断ロジック
- `ap_start` … AP（hostapd/dnsmasq）起動ヘルパー

### **wifi_or_ap**

このスクリプトは、起動時にシステムサービス `wifi-or-ap.service` （oneshot／タイマーにより起動後30s＋5分間隔）から実行されます。
ブート時に **Wi-Fi(STA)** 接続を試行し、失敗したら **AP モード** を起動します。  
既に疎通（`PING_TARGET` への ping 成功）が確認できる場合は **早期終了**。  
AP モード移行後は **一定時間の再試行抑制**（`/run/ap_hold`）でフラップを防止します。DHCP は **systemd-networkd** に委任。

> **変数**

| 種別 | 変数名                            | 例 / 既定                       | 説明                                    |
| -- | ------------------------------ | ---------------------------- | ------------------------------------- |
| 任意 | `AP_HOLD_DURATION`             | `300`                        | AP 移行後、STA 再試行を抑制する秒数（`/run/ap_hold`） |
| 任意 | `PING_TARGET`                  | `8.8.8.8`                    | 早期疎通確認の宛先（成功なら即終了）                    |

!!! note "STA 設定ファイルの場所"
    `/etc/wpa_supplicant/wpa_supplicant-<iface>.conf` を参照します（例: `wlanUSB`, `wlanINT`）。ファイルが無ければ AP へフォールバック。

> 処理の流れ

1) **早期疎通チェック**：`PING_TARGET` に 1 発 ping→成功なら **即終了**。  

2) **必須変数の検証**：未定義があれば **エラー終了**。  

3) **AP ホールド確認**：`/run/ap_hold` があれば **STA 試行スキップ**。  

4) **ログ開始**：`WIFI_OR_AP_LOG` に開始行を追記。  

5) **STA IF 優先度決定**：`BOARD_TYPE` により `STA_IF_ORDER` 設定（Jetson は `["wlanINT"]`）。  

6) **per-IF conf 存在確認**：`/etc/wpa_supplicant/wpa_supplicant-<iface>.conf` が 1 つも無ければ **AP 起動**→終了。  

7) **物理 IF 出現待ち**：短時間待機して検出できなければ **AP 起動**。  

8) **競合排除**：`pkill wpa_supplicant`、古いソケット削除、`hostapd`/`dnsmasq` 停止。  

9) **IF 準備**：各 STA IF を `ip addr flush` → `ip link set up`。  

10) **wpa_supplicant 起動**：`systemctl start wpa_supplicant@<iface>`（優先度順）→`WIFI_CONNECT_SLEEP` 待機。  

11) **接続完了待ち**：`wpa_cli status` の `wpa_state=COMPLETED` をタイムアウトまでポーリング。未達なら **AP 起動**＋`/run/ap_hold` 設置。  

12) **DHCP は networkd に委任**（処理なし）。  

13) **経路/ゲートウェイ検証**：`ip route get <gw>` と GW への ping を再試行。成功→`hostapd`/`dnsmasq` 停止・`/run/ap_hold` 削除・`networkctl reconfigure/renew`、失敗→ **AP 起動**＋`/run/ap_hold`。

!!! warning "ネットワークマネージャの競合"
    本フローは **systemd-networkd 前提** です。**NetworkManager** 等と併用すると競合します。  
    片方に統一し、重複する DHCP/IF 管理を無効化してください。

!!! note "AP ホールド（/run/ap_hold）"
    AP へフォールバックすると `/run/ap_hold` を作成し、**`AP_HOLD_DURATION` 秒** STA 再試行を抑制します。  
    不安定な電波環境での **状態フラップ防止** に有効です。

!!! tip "IF 優先度（STA_IF_ORDER）の調整"
    既定は `["wlanUSB","wlanINT"]`（Jetson は `["wlanINT"]`）。運用に合わせて **優先インターフェース** を入れ替えてください。

!!! tip "外部疎通チェックは任意"
    `8.8.8.8` への外部 ping はコメントアウト済みです。要件が **LAN 到達性のみ** なら GW の疎通確認だけで十分です。

### **ap_start**

このスクリプトは、`wifi-or-ap` で **APモード** へフォールバック時に呼び出されます。
指定インターフェースに **静的 IP** を割り当て、**dnsmasq(DHCP)** と **hostapd(AP)** を起動してアクセスポイントを立ち上げます。  

> 処理の流れ

1) **IF 出現待ち**：`ip link show "$AP_INTERFACE"` が成功するまで待機。  

2) **IF を up**：`ip link set "$AP_INTERFACE" up`。  

3) **静的 IP 割当**：既存 IP を flush → `ip addr add "$AP_STATIC_IP" dev "$AP_INTERFACE"`。  

4) **dnsmasq 起動**：`systemctl unmask/enable/start "$DNSMASQ_SERVICE"`。  

5) **hostapd 起動**：`systemctl unmask/enable/start "$HOSTAPD_SERVICE"`。  

6) **完了ログ**：起動成功を `"$AP_START_LOG_FILE"` に記録。

!!! warning "規制・レギュレーション（country_code）"
    `hostapd.conf` に **`country_code=JP`（運用国コード）** を必ず設定してください。  
    不適切な国コードは **5 GHz 帯の起動失敗や法令違反**につながります（DFS/チャネル制限にも影響）。

!!! warning "IP 設計の整合性"
    `AP_STATIC_IP` と `dnsmasq` の `dhcp-range` は **同一セグメントで整合**させてください。  
    例：`AP_STATIC_IP=10.0.0.1/24` ↔ `dhcp-range=10.0.0.50,10.0.0.150,255.255.255.0,12h`。  
    かつ、**上流 LAN とサブネットが衝突しない**ように設計してください（NAT する場合は別セグメント推奨）。

!!! note "競合回避"
    他マネージャ（NetworkManager など）や STA 用フローと **同一インターフェースを奪い合わない**ようにしてください。  
    AP 専用 IF（例：`wlanAP`）を用意し、STA 側（`wifi_or_ap`）で同 IF を扱わない構成を推奨します。

## **トラブルシュート**

- APが立たない: `hostapd -dd -f /tmp/hostapd.log` で詳細確認
- DHCP不通: `dnsmasq --test` / `journalctl -u dnsmasq`

## **セキュリティ注意**

- 初期 SSID/PSK はデプロイ後に変更推奨
