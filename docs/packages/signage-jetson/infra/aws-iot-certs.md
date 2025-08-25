# AWS IoT 証明書作成ツール — `scripts/infra/create_iot.sh`

開発機で **AWS IoT の Thing / Policy / 証明書一式**を作成し、生成した **`cert.pem` / `public.key` / `private.key` / `AmazonRootCA1.pem`** を **セットアップ前に端末へコピー**するためのスクリプトです。

!!! tip "権限エラーになる場合"
    出力先が `/etc/aws-iot/certs` 固定のため、**root 権限で実行**してください。
    あるいはスクリプト内の `CERT_DIR` を一時的に `./out/certs` など**ユーザー書込可能なパス**に変更して実行→後で端末へコピーする運用も可。

## **前提**

- AWS 資格情報（`aws configure` でセット済み、もしくは環境変数）
- 必要 IAM 権限
  `sts:GetCallerIdentity`
  `iot:CreateThing`, `iot:CreatePolicy`, `iot:CreateKeysAndCertificate`
  `iot:AttachPolicy`, `iot:AttachThingPrincipal`
  `iot:DescribeEndpoint`

## **固定値（スクリプト内）**

- `THING_NAME="xignage-metrics"`
- `POLICY_NAME="${THING_NAME}-policy"`
- `REGION="ap-northeast-1"`
- `CERT_DIR="/etc/aws-iot/certs"`

> ※ 運用に合わせて Thing 名の命名規則（例：シリアル/UUID）を設ける場合は、実行前に上記を編集してください。

## **処理の流れ**

1) **前提コマンド確認**
   - `aws` が無ければ **AWS CLI v2** を自動導入（`aarch64`/`x86_64` をアーキ判定）
   - `jq` が無ければエラー終了（導入案内を表示）

2) **アカウント情報取得**
   - `aws sts get-caller-identity` で **Account ID** を取得
   - リージョンは **`ap-northeast-1`** を使用

3) **Thing 作成**
   - `aws iot create-thing --thing-name "$THING_NAME"`（存在時はスキップ）

4) **ポリシー作成**
   - 次の内容で `policy.json` を動的生成

   ```bash
   {
       "Version": "2012-10-17",
       "Statement": [
           { "Effect": "Allow", "Action": ["iot:Connect"], "Resource": "*" },
           {
           "Effect": "Allow",
           "Action": ["iot:Publish","iot:Subscribe","iot:Receive"],
           "Resource": "arn:aws:iot:REGION:ACCOUNT_ID:topic/xignage/metrics/*"
           }
       ]
   }
   ```

   - `aws iot create-policy --policy-name "$POLICY_NAME"`（**既存でもOK**：stderr 抑止・`|| true`）

5) **証明書・鍵の発行**
   - `aws iot create-keys-and-certificate --set-as-active`
   - `cert.pem` / `public.key` / `private.key` を **`$CERT_DIR`** に保存
   - 返却 JSON から **証明書 ARN** を取得

6) **関連付け**
   - `attach-policy`（Policy → Certificate）
   - `attach-thing-principal`（Thing ↔ Certificate）

7) **データエンドポイント取得**
   - `aws iot describe-endpoint --endpoint-type iot:Data-ATS` を実行し、**ATS エンドポイント**を取得

8) **ルート CA 取得 / 後片付け**
   - `AmazonRootCA1.pem` をダウンロードして保存
   - 一時ファイル（`cert.json`, `policy.json`）を削除
   - 完了メッセージを出力

!!! warning "セキュリティ（鍵の取り扱い）"
    `private.key` は **厳格なパーミッション（600）** を設定し、**必要最小限の権限**で保管してください。  
    端末へ配布後は、開発機側の秘密鍵を**消去**する運用を推奨します。
    ```bash
    sudo chown root:root /etc/aws-iot/certs/private.key /etc/aws-iot/certs/cert.pem
    sudo chmod 600        /etc/aws-iot/certs/private.key
    ```

## **端末へのコピー例**

A) 直接 scp（権限付き）

```bash
# 端末側：事前に作成
ssh ubuntu@DEVICE 'sudo mkdir -p /etc/aws-iot/certs && sudo chown root:root /etc/aws-iot/certs'

# 開発機 → 端末へコピー
sudo scp /etc/aws-iot/certs/* ubuntu@DEVICE:/tmp/

# 端末側へ配置・権限設定
ssh ubuntu@DEVICE 'sudo mv /tmp/* /etc/aws-iot/certs/ && sudo chmod 600 /etc/aws-iot/certs/private.key'
```

B) 権限を保ったまま tar ストリームで転送

```bash
sudo tar -C /etc/aws-iot/certs -czf - . \
  | ssh ubuntu@DEVICE 'sudo tar -C /etc/aws-iot/certs -xzf - && sudo chmod 600 /etc/aws-iot/certs/private.key'
```

## **運用ノート / 注意点**

- **再実行で証明書が増える**  
  本スクリプトは**毎回新規の証明書**を発行します。不要になった証明書は  
  `update-certificate --new-status INACTIVE` → `delete-certificate` で**整理**してください。
- **Topic の最小権限**  
  現行ポリシーは `xignage/metrics/*` のみを許可。要件に応じて **Topic 名** を見直し、**過剰許可を避ける**。
- **複数端末スケール**  
  量産時は **Thing 名を端末ごとに一意**にし、共通ポリシーをアタッチする設計が一般的。命名規則を事前に決める。
- **出力先パス**  
  既定は `/etc/aws-iot/certs`。sudo 実行が前提。ユーザー領域に一時作成→端末へ転送→**端末側で権限設定**の流れでも可。
- **資格情報/IAM**  
  実行環境の AWS 資格情報と **IoT 管理権限**（Create/Attach/Describe 系）が必要。

## **トラブルシュート**

- `Unable to locate credentials`（資格情報なし）  
  → `aws configure` で設定、または環境変数（`AWS_ACCESS_KEY_ID` 等）を確認。
- `AccessDeniedException`（権限不足）  
  → 実行ユーザー/ロールの **IoT 権限**（CreateThing/Attach*/CreateKeysAndCertificate 等）を付与。
- `jq: command not found`  
  → `sudo apt-get install -y jq`
- `/etc/aws-iot/certs` で **Permission denied**  
  → `sudo` で実行、または一時的に出力先をユーザー領域へ変更してから移送。
- 証明書が多すぎる/どれが現用か不明  
  → `aws iot list-certificates` で確認。不要なものは INACTIVE → 削除。
- エンドポイント不一致/接続不可  
  → `aws iot describe-endpoint --endpoint-type iot:Data-ATS` の値を **端末の設定に反映**しているか確認。
