# サービス - Network / Registration

サーバ登録やネットワーク関連のサービス群。  
対象ファイル：`deviceInfoRegistration.js`, `networkRegistration.js`, `mtlsClient.js`

## **早見表**

| ファイル | 役割（要約） | 主な関数 |
| --- | --- | --- |
| `deviceInfoRegistration.js` | 端末情報の **クラウド登録** | `registerDeviceInfo(deviceId)` |
| `networkRegistration.js` | **ローカル IP / MAC** の取得・登録（再試行/差分送信） | `safeRegisterLocalIp()`, `registerLocalIp()`, `registerMacAddress()`, `startNetworkReporter()` |
| `mtlsClient.js` | mTLS 証明書の読込とクライアント設定 | `getAxiosRequestConfig()`, `getSocketIoClientOptions()`, `getFetchDispatcher()` |

---

## **deviceInfoRegistration.js**

`deviceInfo.getDeviceInfo()` で収集した端末情報を **`SERVER_URL` 側の API** へ登録します。

- 関数：`registerDeviceInfo(deviceId: string): Promise<void>`
  - 送信先：`POST ${SERVER_URL}/api/device-info/register`
  - ボディ：`{ deviceId, info }`
  - 失敗時はログのみ（例外は上位に投げない）

---

## **networkRegistration.js**

ローカル **IPv4 / MAC** を **優先 IF 順**で探索・再試行し、`SERVER_URL` へ登録します。  
IP は **キャッシュ比較**して **変化時のみ**送信します。

### **主要設定**

- **再試行**：`RETRY_INTERVAL_MS = 10000`（10s）、`MAX_RETRIES = 10`
- **優先 IF**：`WIFI_PRIORITY_INTERFACES`（既定 `wlanUSB,wlanINT,eth0`）
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
    - **IF 名**：環境に合わせ `WIFI_PRIORITY_INTERFACES` を調整。  
    - **登録トリガ**：IP 変化検知は **プロセス内キャッシュ**基準です（プロセス再起動でリセット）。  
    - **認証/到達性**：サーバ API の認可方式/到達性確認は別途実装が必要。  
    - **ルータ/コンテナ環境**：`os.networkInterfaces()` の見え方は実行環境に依存します。

---

## **mtlsClient.js**

対象ホストが mTLS 対象の場合に、**axios / socket.io / fetch** 用の TLS オプションを生成します。  
`SERVER_URL` だけでなく、任意の URL を渡して判定できます。

### **判定ロジック**

- 既定の mTLS 対象ホスト: `device.api.xrobotics.jp`
- `MTLS_HOSTS` が指定されている場合は、**その一覧のみ**を mTLS 対象とする

### **公開関数**

- `getAxiosRequestConfig(baseUrlOrUrl)` → axios の `httpsAgent` を返す
- `getSocketIoClientOptions(baseUrlOrUrl)` → socket.io-client の TLS オプションを返す
- `getFetchDispatcher(baseUrlOrUrl)` → undici の `dispatcher` を返す

### **関連環境変数**

| Key | Required | Default | Note |
| --- | --- | --- | --- |
| `MTLS_HOSTS` | no | — | `,` 区切りのホスト一覧（指定時はこの一覧のみ mTLS 対象） |
| `MTLS_CERT_PATH` | no | `/etc/signage/iot-certs/<DEVICE_ID>/cert.pem` | クライアント証明書 |
| `MTLS_KEY_PATH` | no | `/etc/signage/iot-certs/<DEVICE_ID>/private.key` | 秘密鍵 |
| `MTLS_CA_PATH` | no | — | CA 証明書（任意） |
