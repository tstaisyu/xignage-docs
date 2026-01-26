# スタック構成

## XignageInfraAwsStack

中核スタック。IoT イベント処理、メトリクス、WebRTC、通知、監視をまとめて構築します。（根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`）

### XignageInfraAwsStack の主なリソース

- **SNS**: `xignage-ops-alerts`（運用アラート通知）
- **SQS**
  - `xignage-events-logger-dlq`（イベントロガー DLQ）
  - `xignage-push-retry` / `xignage-push-retry-dlq`（再試行用）
- **Lambda（Node.js 22）**
  - `xignage-events-logger`
  - `xignage-push-retry-consumer`
  - `xignage-doorbell-timeout-worker`
  - `xignage-metrics-ingestor`
  - WebRTC Join Lambda（`lambda/webrtc-create-join`、関数名は CDK 自動命名）
- **DynamoDB**: `xignage-events-dedupe`（TTL あり）
- **Secrets Manager（参照）**: `xignage/adalo`（events-logger / push-retry-consumer / doorbell-timeout-worker）
- **IoT ルール**
  - イベント: `xignage_events_to_lambda`
  - メトリクス: `xignage_metrics_to_cw`
- **Cognito**: UserPool / UserPoolClient（WebRTC 認証）
- **API Gateway**: `/webrtc/create-join`（Cognito Authorizer）
- **CloudWatch**
  - MetricFilter（Adalo 成否・再試行・期限切れ・鮮度落ち）
  - Alarm（DLQ/失敗率/リトライ遅延/メトリクスエラー等）
  - Dashboard（Device/KPI）
- **EventBridge（Scheduler）**
  - 1 分間隔で `xignage-doorbell-timeout-worker` を実行
- **S3（OTA）**
  - `xignage-ota-bundles-<env>-<account>`（`ota/` 配下の成果物を保存）
- **IAM（OTA アップロード）**
  - `xignage-ota-upload-role-<env>-<account>`（GitHub Actions OIDC で Assume）

`xignage-ota-upload-role-<env>-<account>` は、GitHub Actions の OIDC を使って **タグリリース（`refs/tags/v*`）** のみを許可し、対象は `tstaisyu/signage-jetson` / `tstaisyu/signage-server` / `tstaisyu/xignage-edge-detection` に限定されています。OIDC Provider ARN は `ghOidcArn` / `GH_OIDC_ARN` で上書き可能です。（根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`）

### 採用（既存リソース取り込み）

- `xignage-events-logger` と `xignage-push-retry-consumer` の LogGroup は **既存 LogGroup を import** します。
- `xignage-metrics-ingestor` の LogGroup も既存の `/aws/lambda/xignage-metrics-ingestor` を adopt します。

### XignageInfraAwsStack の Outputs

- `DevicesSsmParam`
- `ResolvedDevicesCount`
- `DefaultDeviceId`
- `HeartbeatMissSsmParam`
- `OpsAlertsTopicArn`
- `EventsLoggerLambdaName`
- `OtaBundleBucketName`
- `OtaUploadRoleArn`
- `UserPoolId`
- `UserPoolClientId`
- `WebrtcCreateJoinEndpoint`

## CiAccessStack

GitHub Actions OIDC 用の CDK デプロイロールを作成します。（根拠: `xignage-infra-aws/lib/ci-access.ts`）

### CiAccessStack の主なリソース

- **OIDC Provider**: `token.actions.githubusercontent.com`
- **IAM Role**: `cdk-deploy-role`
  - CloudFormation / S3（CDK assets）/ Lambda / Logs / CloudWatch / IoT / SNS / SQS / IAM / SSM
  - `xignage-ops-alerts` への操作権限
  - `/xignage/devices`、`/xignage/prod/heartbeat/miss_minutes` への Read/Write
  - `/xignage/*` への Read（devices.json 生成用途）
  - CloudWatch のメトリクス参照（コスト集計スクリプト向け）
  - `ssmBase` 指定時は `/<ssmBase>/*` への Read/Write

### Inputs（Context / Env）

- `ghOwner` / `GH_OWNER`（必須）
- `ghRepo` / `GH_REPO`（必須）
- `ghBranch`（既定: `main`）
- `ghOidcArn` / `GH_OIDC_ARN`（省略時は既定 OIDC）

### CiAccessStack の Outputs

- `RoleArn`

## RelayEc2Stack

Relay EC2 と Content 管理の基盤（RDS + S3 + Media Lambda）を構築します。（根拠: `xignage-infra-aws/lib/relay-ec2-stack.ts`）

### RelayEc2Stack の主なリソース

- **EC2**
  - Ubuntu 22.04 / `t2.micro` / Public subnet / EIP 付与
  - KeyPair: `relay-ec2-key-tokyo`
  - SG: 22/80/443 を Ingress 許可
  - IAM Role: SSM + CloudWatch Agent + Secrets read
- **Secrets**
  - 参照: `xignage/daily`, `xignage/openai`, `xignage/adalo`
- **RDS（PostgreSQL 16.10）**
  - `t4g.micro`、`storageEncrypted: true`、`publiclyAccessible: false`
  - 接続は EC2 SG からの 5432 のみ許可
  - Secrets Manager に DB 認証情報を自動生成
- **S3**
  - Content 用バケット（BlockPublicAccess + SSE）
  - CORS: `https://api.xrobotics.jp` / `http://localhost:5173`
- **S3（IoT バンドル）**
  - IoT 証明書バンドル用バケット（7 日で自動削除）
- **DynamoDB**
  - デバイス/証明書台帳（`xignage-device-ledger` または `xignage-device-ledger-<env>`）
- **IAM（GitHub Actions IoT preissue）**
  - `GitHubIotPreissueRole`（IoT 証明書の事前発行ワークフロー用）
  - `IotPreissueAlertsTopic`（SNS 通知）
- **SNS + Lambda（メディアサムネイル）**
  - S3 ObjectCreated を SNS トピックへ
  - `MediaThumbnailFn`（Node.js 22, `sharp`）
  - `MediaVideoThumbnailFn`（DockerImageFunction）

### RelayEc2Stack の Outputs

- `RelayInstanceId`
- `RelayPublicIp`
- `ContentDbEndpoint`
- `ContentDbSecretArn`
- `ContentBucketName`
- `IotBundleBucketName`
- `DeviceLedgerTableName`
- `GitHubIotPreissueRoleArn`
- `IotPreissueAlertsTopicArn`

## IamGuardrailsStack

特定 IAM ユーザーに対する **IoT プロビジョニング操作** と **デバイス台帳の書き込み** を明示的に拒否します。（根拠: `xignage-infra-aws/lib/iam-guardrails-stack.ts`）

### IamGuardrailsStack の主なリソース

- **IAM User Inline Policy**: `deny-xignage-device-provisioning`
  - 対象ユーザー: `TAISYU_SHIBATA`, `xignage-log-uploader`
  - IoT（`XIG-*` / `xignage-*` / `xignage-*` ポリシー/証明書）への Create/Update/Delete を拒否
  - DynamoDB `xignage-device-ledger*` への Write を拒否
