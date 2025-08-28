# サービス - Network / Registration

サーバ登録やネットワーク関連のサービス群。  
対象ファイル：`deviceInfoRegistration.js`, `netManager.js`, `networkRegistration.js`

## **早見表**

| ファイル | 役割（要約） | 主な関数 |
|---|---|---|
| `deviceInfoRegistration.js` | 端末情報の **クラウド登録** | `registerDeviceInfo(deviceId)` |
| `netManager.js` | Wi-Fi 設定の **全削除 + 再起動**（IF 指定） | `clearWifiConfAndReboot()` |
| `networkRegistration.js` | **ローカル IP / MAC** の取得・登録（再試行/差分送信） | `safeRegisterLocalIp(deviceId)`, `registerLocalIp(deviceId)`, `registerMacAddress(deviceId)` 他 |

---

## **deviceInfoRegistration.js**

`deviceInfo.getDeviceInfo()` で収集した端末情報を **`SERVER_URL` 側の API** へ登録します。

- 関数：`registerDeviceInfo(deviceId: string): Promise<void>`
  リクエスト先：`POST ${SERVER_URL}/api/device-info/register`
  ボディ：`{ deviceId, info }`（`info` は `getDeviceInfo()` の結果）
  戻り値：`void`（成功/失敗はログ出力で通知）
  認証：実装側に依存（現コードでは未実装）

> 処理の流れ

1) `getDeviceInfo()` で端末情報を取得・ログ出力  

2) `axios.post(SERVER_URL + '/api/device-info/register', { deviceId, info })`  

3) 成功/失敗をログ

!!! note
    - **到達性/認証**はサーバ側仕様に依存。リトライ/バックオフは未実装（必要に応じ追加）。  
    - エラー時は例外を握りつぶして **ログのみ**（上位での再送制御を検討）。

---

## **netManager.js**

環境変数で指定した Wi-Fi IF 群に対し、`wpa_cli` で **登録ネットワークを全削除**し、`save_config`・`reconfigure` を実行後、**即時再起動**します。

- 定数：`IFACES = (process.env.WIFI_INTERFACES || 'wlanUSB,wlanINT').split(',').map(trim).filter(Boolean)`

- 関数：`clearWifiConfAndReboot(): void`
  引数：なし
  戻り値：`void`（副作用のみ）
  対象設定：`/etc/wpa_supplicant/wpa_supplicant-<iface>.conf`（chmod 600）

> 処理の流れ

1) `IFACES` を順に処理  
   `sudo wpa_cli -i <iface> remove_network all`  
   `sudo wpa_cli -i <iface> save_config`  
   `sudo wpa_cli -i <iface> reconfigure`  
   `sudo chmod 600 /etc/wpa_supplicant/wpa_supplicant-<iface>.conf`  
   （失敗は `warn` ログでスキップ継続）

2) 最後に `sudo reboot` 実行（失敗は `error` ログ）

!!! note
    - **危険操作**：登録ネットワークを**全削除**し、**即時再起動**します。SSH 断に注意。  
    - `wpa_cli` が必要。`wpa_supplicant` の IF ごとの conf 命名（`wpa_supplicant-<iface>.conf`）前提。  
    - `WIFI_INTERFACES` 既定は `wlanUSB,wlanINT`。環境に応じて並び・名称を調整。  
    - `sudo` 権限の事前付与（sudoers）を推奨。

---

## **networkRegistration.js**

ローカル **IPv4 / MAC** を **優先 IF 順**で探索・再試行し、`SERVER_URL` へ登録します。  
IP は **キャッシュ比較**して **変化時のみ**送信します。

- 再試行：`RETRY_INTERVAL_MS = 10000`（10s）, `MAX_RETRIES = 10`（最大 10 回 → 約 100s）

- 優先 IF：`WIFI_PRIORITY_INTERFACES = (process.env.WIFI_PRIORITY_INTERFACES || 'wlP1p1s0,wlanUSB,wlanINT')`

- キャッシュ：`cachedIp`（直近登録 IP）

### **公開関数（入出力）**

- `safeRegisterLocalIp(deviceId: string): Promise<void>`
  `getLocalIpWithRetry()` で取得 → **前回と異なる場合のみ** `registerLocalIp()` を実行・キャッシュ更新
  備考：現実装では `getLocalIpWithRetry()` が最終的に `'127.0.0.1'` を返すため、`throw` は実質発火しません（将来の変更に注意）

- `registerLocalIp(deviceId: string): Promise<void>`
  送信先：`POST ${SERVER_URL}/api/ip/register`  
  ペイロード：`{ deviceId, localIp }`

- `registerMacAddress(deviceId: string): Promise<void>`
  送信先：`POST ${SERVER_URL}/api/mac/register`  
  ペイロード：`{ deviceId, macAddress }`

### **補助関数（概要）**

- `delay(ms)`：`Promise` ベースのスリープ

- `findWirelessIPv4()`：`WIFI_PRIORITY_INTERFACES` の順で **外部 IPv4** を探索（最初の一致を返す）

- `findAnyIPv4()`：全 IF から **外部 IPv4** の最初の一致を返す

- `getLocalIpWithRetry()`：優先 IF → 全 IF の順で MAX_RETRIES 試行。見つからなければ **`'127.0.0.1'` にフォールバック**

- `findWirelessMAC()` / `findAnyMAC()`：上記の MAC 版（外部 IPv4 が付いた項目の `mac` を返す）

- `getMacAddressWithRetry()`：優先 IF → 全 IF の順で MAX_RETRIES 試行。見つからなければ **`'00:00:00:00:00:00'` にフォールバック**

> 処理の流れ（IP 登録）

1) `safeRegisterLocalIp(deviceId)`  

2) `getLocalIpWithRetry()`：優先 IF → 全 IF →（なければ）`127.0.0.1`  

3) `cachedIp` と比較し、変更があれば `registerLocalIp(deviceId)` を `POST`  

4) 成功/失敗をログ。成功時は `cachedIp` 更新

!!! note
    - **フォールバック**：IP は `127.0.0.1`、MAC は `00:00:00:00:00:00` へフォールバックします。サーバ側の受付ポリシーに留意。  
    - **IF 名**：環境に合わせ `WIFI_PRIORITY_INTERFACES` を調整（例：`wlP1p1s0` はドライバに依存）。  
    - **登録トリガ**：IP 変化検知は **プロセス内キャッシュ**基準です（プロセス再起動でリセット）。  
    - **認証/到達性**：サーバ API の認可方式/到達性確認は別途実装が必要。  
    - **ルータ/コンテナ環境**：`os.networkInterfaces()` の見え方は実行環境に依存（NAT/コンテナでは要注意）。
