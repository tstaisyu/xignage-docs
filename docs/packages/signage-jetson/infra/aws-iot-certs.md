# AWS IoT デバイス単位のプロビジョニング — `scripts/infra/create_device_thing.sh` + `get_iot_creds.sh`

開発機で **デバイスごとの Thing 作成／証明書発行／ポリシー付与**を行い、生成した  
**`cert.pem` / `private.key` / `AmazonRootCA1.pem`** を **端末側へ配布**します。  
端末側は **`/etc/signage/iot.env` + `/etc/signage/iot-certs`** に統一して格納します。

---

## **前提**

- AWS 資格情報
  - 直接実行（既存プロファイル/環境変数）**または**
  - `get_iot_creds.sh` による **AssumeRole**（一時クレデンシャル）
- 依存コマンド：`aws`, `jq`, `curl`

---

## **スクリプト概要**

### `scripts/infra/get_iot_creds.sh`（任意）

- `ASSUME_ROLE_ARN` を使って **一時クレデンシャルを export** します
- MFA 対応：`ASSUME_MFA_SERIAL` + `ASSUME_MFA_CODE`

```bash
export ASSUME_ROLE_ARN=arn:aws:iam::123456789012:role/iot-provisioner-role
# export ASSUME_MFA_SERIAL=arn:aws:iam::123456789012:mfa/you
# export ASSUME_MFA_CODE=123456

source scripts/infra/get_iot_creds.sh
aws sts get-caller-identity
```

> `ASSUME_ROLE_ARN` が未設定、または `-` の場合は **何もしません**。

---

### `scripts/infra/create_device_thing.sh`

- **Thing 作成 → 証明書発行 → ポリシー付与 → Thing へアタッチ**
- **Thing Group（`xignage-devices`）へ追加**
- Thing 属性 `monitor=true` を **冪等で設定**
- 出力先：`/tmp/aws-iot-certs/{cert.pem, private.key, AmazonRootCA1.pem}`

```bash
scripts/infra/create_device_thing.sh <DEVICE_ID> [POLICY_NAME]
```

---

## **端末側での配置（112_write_iot_env.sh）**

端末側では `scripts/setup/112_write_iot_env.sh` を実行します。

- `/etc/signage/iot.env` に **IOT_ENDPOINT** が必要
  - 例：`iot.env.sample` から作成（`105_install_metrics_service.sh` が自動配置）
- `/tmp/aws-iot-certs` から証明書を取り込み
- `/etc/signage/iot-certs/<DEVICE_ID>/` に安全配置
- `/etc/signage/iot.env` を更新（`IOT_*`）

```bash
# 端末側
sudo CREATE_THING=0 bash scripts/setup/112_write_iot_env.sh
```

---

## **証明書ローテーション**

`112_write_iot_env.sh` は **既存 Thing がある場合も証明書ローテーション**を行います。  
`ROTATE_CERT_ON_EXISTING=0` を指定するとスキップ可能です。

---

## **トラブルシュート**

- `Unable to locate credentials`：`aws configure` または `get_iot_creds.sh` を使用
- `AccessDeniedException`：`iot:*` / `sts:AssumeRole` 権限を確認
- エンドポイント不一致：`aws iot describe-endpoint --endpoint-type iot:Data-ATS` を確認し `/etc/signage/iot.env` に反映
