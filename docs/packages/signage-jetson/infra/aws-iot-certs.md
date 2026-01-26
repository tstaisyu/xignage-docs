# IoT 証明書（bundle 方式）

端末は **AWS 資格情報を保持しない**前提です。  
**Thing + 証明書**は管理側で発行し、**bundle.tgz** として端末に渡します。

---

## **前提**

- `/etc/signage/iot.env` に **`IOT_ENDPOINT`** が記載されていること
- 端末側の導入は **`099_write_iot_env.sh`** が担当

---

## **端末側の導入フロー**

### **方法 A: bundle.tgz を配布して展開**

```bash
# bundle.tgz を端末へ配置した後
sudo rm -rf /tmp/iot-certs
sudo tar -C /tmp -xzf bundle.tgz

# その後
sudo bash scripts/setup/099_write_iot_env.sh
```

### **方法 B: URL を渡して自動取得**

`setup_all.sh` 実行時に `IOT_BUNDLE_URL` / `IOT_BUNDLE_SHA256` を渡すと、
`000_write_env_files.sh` が `/etc/signage/bootstrap.env` に保存し、
`099_write_iot_env.sh` が **自動取得 → 展開 → 設定反映**を行います。

---

## **配置されるファイル**

- 証明書ディレクトリ: `/etc/signage/iot-certs/<DEVICE_ID>/`
  - `cert.pem`
  - `private.key`
  - `AmazonRootCA1.pem`
- 設定ファイル: `/etc/signage/iot.env`

```dotenv
IOT_ENDPOINT=<existing>
IOT_THING_NAME=<DEVICE_ID>
IOT_CERT_PATH=/etc/signage/iot-certs/<DEVICE_ID>/cert.pem
IOT_KEY_PATH=/etc/signage/iot-certs/<DEVICE_ID>/private.key
IOT_CA_PATH=/etc/signage/iot-certs/<DEVICE_ID>/AmazonRootCA1.pem
```

`bootstrap.env` は成功時に削除されます。

---

## **証明書ローテーション**

### **手動ローテーション**

```bash
sudo IOT_BUNDLE_URL=... IOT_BUNDLE_SHA256=... rotate_iot_cert.sh
```

`rotate_iot_cert.sh` は **mTLS で疎通確認**後に切替を行います。

### **自動ローテーション**

- `iot-cert-rotate.timer` が **daily** で起動
- `iot_cert_rotate_if_due` が **ROTATE_AFTER_DAYS（既定 365 日）** を超えた場合に
  `https://device.api.xrobotics.jp/api/iot/bundle` へ mTLS リクエスト

---

## **管理側（bundle 発行）**

管理側で **Thing + 証明書**を作成し、`bundle.tgz` を生成します。  
この手順は本リポジトリ外のため、具体フローは別途運用資料に従ってください。

