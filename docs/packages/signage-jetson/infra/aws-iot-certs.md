# AWS IoT デバイス単位のプロビジョニング — `scripts/infra/create_device_thing.sh` + `get_iot_creds.sh`

開発機で **デバイスごとの Thing 作成／証明書発行／ポリシー付与**を行い、生成した  
**`cert.pem` / `private.key` / `AmazonRootCA1.pem`** を **セットアップ前に端末へコピー**するための新フローです。  
**旧 `create_iot.sh` は非推奨（ドキュメント削除対象）**とし、本ページの2スクリプトへ移行します。

!!! tip "出力先と権限"
    本フローでは出力先が **`/tmp/aws-iot-certs`**（ユーザー書き込み可）です。  
    生成された鍵類には自動で **0600** が設定されます。

---

## **前提**

- AWS 資格情報
  - 直接実行（既存プロファイル/環境変数）**または**
  - `get_iot_creds.sh` による **AssumeRole**（一時クレデンシャル）
- 必要 IAM 権限
  - `sts:AssumeRole`（AssumeRole を使う場合）
  - `sts:GetCallerIdentity`
  - `iot:CreateThing`, `iot:CreateKeysAndCertificate`
  - `iot:AttachPolicy`, `iot:AttachThingPrincipal`
  - `iot:DescribeEndpoint`
- 依存コマンド：`aws`, `jq`, `curl`

---

## **スクリプト概要**

### `scripts/infra/get_iot_creds.sh`（任意）

- 役割：`ASSUME_ROLE_ARN` を使って **一時クレデンシャルを export** します。
- 既定リージョン：`ap-northeast-1`
- MFA 対応：`ASSUME_MFA_SERIAL` と `ASSUME_MFA_CODE` を与えると MFA で Assume

**使い方：**

```bash
# 例）AssumeRole +（必要なら MFA）
export ASSUME_ROLE_ARN=arn:aws:iam::123456789012:role/iot-provisioner-role
# export ASSUME_MFA_SERIAL=arn:aws:iam::123456789012:mfa/you
# export ASSUME_MFA_CODE=123456

source scripts/infra/get_iot_creds.sh
aws sts get-caller-identity   # 有効性チェック
```

> `ASSUME_ROLE_ARN` が未設定、または `-` の場合は **何もしません**（外部で設定済みの資格情報を使用）。

---

### `scripts/infra/create_device_thing.sh`

- 役割：**デバイス単位**で Thing を作成し、**鍵/証明書の発行・ポリシー付与・Thing へのアタッチ**を行います。
- 出力：`/tmp/aws-iot-certs/{cert.pem, private.key, AmazonRootCA1.pem}`
- 既定ポリシー名：`xignage-device-events-publish-v1`（第2引数で上書き可）

> **使い方**

```bash
# DEVICE_ID は必須、POLICY_NAME は任意
scripts/infra/create_device_thing.sh <DEVICE_ID> [POLICY_NAME]

# 例
scripts/infra/create_device_thing.sh XIG-R4B-VAH
scripts/infra/create_device_thing.sh XIG-R4B-VAH my-device-policy-v2
```

> **出力例**

```csharp
[create] Thing: XIG-R4B-VAH
[create] Keys & certificate (active)
[attach] Policy: xignage-device-events-publish-v1
[attach] Cert to Thing
[save] Writing certs to /tmp/aws-iot-certs
[info] Endpoint: xxxxxxxx-ats.iot.ap-northeast-1.amazonaws.com
[ok] Done. Files in: /tmp/aws-iot-certs
```

## **処理の流れ**

1) **（任意）AssumeRole 実行**  
   `get_iot_creds.sh` を `source` して一時クレデンシャルを export（`ASSUME_ROLE_ARN` 指定時）。

2) **Thing の作成**  
   `aws iot create-thing --thing-name "<DEVICE_ID>"`  
   既存の場合はスキップ（警告表示のみ）。

3) **鍵/証明書の発行（有効化）**  
   `aws iot create-keys-and-certificate --set-as-active`  
   返却 JSON から **certificateArn / certificatePem / privateKey** を取得。

4) **ポリシー付与 & Thing へアタッチ**  
   - `aws iot attach-policy --policy-name "<POLICY>" --target "<CERT_ARN>"`
   - `aws iot attach-thing-principal --thing-name "<DEVICE_ID>" --principal "<CERT_ARN>"`

5) **ルート CA の取得**  
   `AmazonRootCA1.pem` を amazontrust.com からダウンロード（`curl` 再試行つき）。

6) **証明書/鍵の保存**  
   `/tmp/aws-iot-certs/` に `cert.pem`, `private.key`, `AmazonRootCA1.pem` を保存（**0600**）。

7) **データエンドポイントの取得**  
   `aws iot describe-endpoint --endpoint-type iot:Data-ATS` の結果を表示。

---

## **端末へのコピー例**

A) **scp で一時転送 → 112 で安全配置（推奨）**

```bash
# 開発機 → 端末へ一時コピー
scp /tmp/aws-iot-certs/* ubuntu@DEVICE:/tmp/

# 端末側で安全配置（証明書は 112 が所定パスへ設置・権限設定）
ssh ubuntu@DEVICE 'sudo CREATE_THING=0 bash scripts/setup/112_write_events_iot_env.sh'
```

B) **tar ストリームで転送**

```bash
tar -C /tmp/aws-iot-certs -czf - . \
  | ssh ubuntu@DEVICE 'sudo tar -C /tmp -xzf - && sudo CREATE_THING=0 bash scripts/setup/112_write_events_iot_env.sh'
```

> `112_write_events_iot_env.sh` は `/tmp/aws-iot-certs`（優先）/ `/tmp/events-certs`（フォールバック）を検出し、
`/etc/signage/events-certs/<DEVICE_ID>/` に **差分更新 + 厳格な権限**で配置します。

---

## **運用ノート / 注意点**

- **デバイスごとに一意な Thing 名**  
  `DEVICE_ID` を Thing 名として使用（例：`XIG-<SITE>-<SEQ>`）。命名規則を固定化してください。
- **証明書のライフサイクル**  
  再発行で証明書は増えます。不要なものは `INACTIVE` → `delete-certificate` で整理を。
- **最小権限ポリシー**  
  送信先 Topic に応じてポリシーを見直し、過剰許可を避けてください。
- **権限/所有者**  
  端末側では `/etc/signage/events-certs/<DEVICE_ID>/` に配置し、  
  ディレクトリ `0700`、`cert.pem`/`private.key` `0600`、`AmazonRootCA1.pem` `0644`、所有者 `ubuntu:ubuntu`。
- **リージョン**  
  既定は `ap-northeast-1`。必要に応じて環境変数やプロファイルで変更。

---

## **トラブルシュート**

- `Unable to locate credentials`（資格情報なし）  
  → `aws configure` または `get_iot_creds.sh` で一時クレデンシャルを取得。
- `AccessDeniedException`（権限不足）  
  → 実行ロール/ユーザーに IoT 管理権限（Create/Attach/Describe など）を付与。
- `jq: command not found`  
  → `sudo apt-get install -y jq`
- ルート CA 取得失敗  
  → ネットワーク/Proxy を確認。`curl` のリトライ回数やタイムアウトを調整。
- 既存の Thing/証明書が混在  
  → `aws iot describe-thing` / `list-certificates` / `list-thing-principals` で現況確認し、整理。
- エンドポイント不一致/接続不可  
  → `describe-endpoint --endpoint-type iot:Data-ATS` の値を **端末 `events.env`** に反映できているか確認。

---

## **旧フローからの変更点（まとめ）**

- **単一スクリプト → 2段構え**：AssumeRole（任意）＋**デバイス単位の発行/紐付け**に分離  
- **出力先**：`/etc/aws-iot/certs`（root 想定）→ **`/tmp/aws-iot-certs`**（ユーザー実行可）  
- **端末側配置**：`112_write_events_iot_env.sh` が **優先 `/tmp/aws-iot-certs`** を検出して厳格権限で配置  
- **旧 `create_iot.sh`**：**非推奨**（ドキュメント削除）。スクリプトは当面残置する場合でも「Deprecated」注記を付与
