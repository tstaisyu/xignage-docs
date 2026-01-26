# Relay EC2 / Content 基盤

## 役割

`RelayEc2Stack` は **Adalo 連携やコンテンツ管理の補助基盤**として EC2 + RDS + S3 を構築します。（根拠: `xignage-infra-aws/lib/relay-ec2-stack.ts`）

## EC2

- VPC: Default VPC を参照
- Subnet: Public
- Instance: `t2.micro` / Ubuntu 22.04
- Volume: 8GiB（gp2）
- SG: Ingress 22 / 80 / 443
- IAM Role: `AmazonSSMManagedInstanceCore`, `CloudWatchAgentServerPolicy`
- Secrets 読み取り: `xignage/daily`, `xignage/openai`, `xignage/adalo`
- EIP: 固定 IP を付与
- OTA バケット（`xignage-ota-bundles-<env>-<account>`）の `ota/*` を Read

## RDS（Content DB）

- Engine: PostgreSQL 16.10
- Instance: `t4g.micro`
- Subnet: Public Subnet（`publiclyAccessible: false`）
- Storage: 20GiB / 暗号化あり
- Secret: `ContentDbSecret`（Secrets Manager に自動生成）
- SG: EC2 からの 5432 のみ許可
- `prod` 環境では deletion protection が有効

### 接続経路

- EC2（RelayInstance）→ RDS（ContentDbInstance）: SG 許可あり
- 外部からの直接接続は想定されていません（`publiclyAccessible: false`）

## S3 + Media サムネイル

- Content バケット（BlockPublicAccess + SSE, CORS 設定あり）
- S3 `ObjectCreated:Put`（`prefix: customer/`）を SNS トピックへ通知
- SNS から 2 つの Lambda へ Fan-out
  - `MediaThumbnailFn`（Node.js 22, `sharp`）
  - `MediaVideoThumbnailFn`（DockerImageFunction）

`MediaThumbnailFn` / `MediaVideoThumbnailFn` の環境変数:

- `MEDIA_BUCKET`
- `INTERNAL_API_BASE_URL`
- `INTERNAL_API_TOKEN`

## IoT バンドル / デバイス台帳 / preissue

- IoT 証明書バンドル用 S3 バケット（7 日で自動削除）
- DynamoDB デバイス台帳（`xignage-device-ledger` / `xignage-device-ledger-<env>`）
- GitHub Actions 用 `GitHubIotPreissueRole`（IoT 事前発行）
- SNS: `IotPreissueAlertsTopic`（preissue 通知）

## Outputs

- `RelayInstanceId`
- `RelayPublicIp`
- `ContentDbEndpoint`
- `ContentDbSecretArn`
- `ContentBucketName`
- `IotBundleBucketName`
- `DeviceLedgerTableName`
- `GitHubIotPreissueRoleArn`
- `IotPreissueAlertsTopicArn`
