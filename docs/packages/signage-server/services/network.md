# サービス - Network / Registration

サーバ登録やネットワーク関連のサービス群。  
対象ファイル：`deviceInfoRegistration.js`, `netManager.js`, `networkRegistration.js`

## **早見表**

| ファイル | 役割（要約） | 主な関数 |
| --- | --- | --- |
| `deviceInfoRegistration.js` | 端末情報の **クラウド登録** | `registerDeviceInfo(deviceId)` |
| `netManager.js` | Wi-Fi 設定の **全削除 + 再起動**（IF 指定） | `clearWifiConfAndReboot()` |
| `networkRegistration.js` | **ローカル IP / MAC** の取得・登録（再試行/差分送信） | `safeRegisterLocalIp()`, `registerLocalIp()`, `registerMacAddress()`, `startNetworkReporter()` |

---

## **deviceInfoRegistration.js**

`deviceInfo.getDeviceInfo()` で収集した端末情報を **`SERVER_URL` 側の API** へ登録します。

- 関数：`registerDeviceInfo(deviceId: string): Promise<void>`
  - 送信先：`POST ${SERVER_URL}/api/device-info/register`
  - ボディ：`{ deviceId, info }`
  - 失敗時はログのみ（例外は上位に投げない）

---

## **netManager.js**

環境変数で指定した Wi-Fi IF 群に対し、`wpa_cli` で **登録ネットワークを全削除**し、`save_config`・`reconfigure` を実行後、**即時再起動**します。

- 定数：`IFACES = (process.env.WIFI_INTERFACES || 'wlanUSB,wlanINT')`
- 関数：`clearWifiConfAndReboot(): void`
  - 実行: `remove_network all` → `save_config` → `reconfigure` → `chmod 600` → `sudo reboot`

---

## **networkRegistration.js**

ローカル **IPv4 / MAC** を **優先 IF 順**で探索・再試行し、`SERVER_URL` へ登録します。  
IP は **キャッシュ比較**して **変化時のみ**送信します。

### **主要設定**

- **再試行**：`RETRY_INTERVAL_MS = 10000`（10s）、`MAX_RETRIES = 10`
- **優先 IF**：`WIFI_PRIORITY_INTERFACES`（既定 `wlP1p1s0,wlanUSB,wlanINT`）
- **無視 IF**：`lo`, `docker*`, `veth*`, `br-*`, `tun*`, `tap*`, `wg*`, `tailscale*`, `zt*`
- **ポーリング**：`NETREG_POLL_MS`（既定 30000ms）で `startNetworkReporter()` が動作

### **公開関数**

- `getNetworkSnapshot(): Promise<{ byInterface, primary, ts }>`
  - `collectInterfaces()` → `pickPrimary()` で **優先 IF の IP/MAC** を決定  
  - 取得できない場合は再試行し、最終的に `127.0.0.1` / `00:00:00:00:00:00` にフォールバック

- `safeRegisterLocalIp(deviceId: string): Promise<void>`
  - 直近の IP と比較し、変化時のみ `registerLocalIp()` を実行

- `registerLocalIp(deviceId: string, snapOpt?): Promise<void>`
  - 送信先：`POST ${SERVER_URL}/api/ip/register`  
  - ボディ：`{ deviceId, localIp, iface }`

- `registerMacAddress(deviceId: string): Promise<void>`
  - 送信先：`POST ${SERVER_URL}/api/mac/register`  
  - ボディ：`{ deviceId, macAddress, iface }`

- `startNetworkReporter(deviceId: string, opts?): void`
  - `NETREG_POLL_MS` 間隔で `safeRegisterLocalIp()` を実行

!!! note
    - **フォールバック**：IP は `127.0.0.1`、MAC は `00:00:00:00:00:00` へフォールバックします。  
    - **IF 名**：環境に合わせ `WIFI_PRIORITY_INTERFACES` を調整（例：`wlP1p1s0` はドライバに依存）。  
    - **登録トリガ**：IP 変化検知は **プロセス内キャッシュ**基準です（プロセス再起動でリセット）。  
    - **認証/到達性**：サーバ API の認可方式/到達性確認は別途実装が必要。  
    - **ルータ/コンテナ環境**：`os.networkInterfaces()` の見え方は実行環境に依存します。
