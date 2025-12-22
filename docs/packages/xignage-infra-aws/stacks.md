# スタック構成

## XignageInfraAwsStack

中核スタック。IoT イベント処理、メトリクス、WebRTC、通知、監視をまとめて構築します。（根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`）

### 主なリソース

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

### 採用（既存リソース取り込み）

- `xignage-events-logger` と `xignage-push-retry-consumer` の LogGroup は **既存 LogGroup を import** します。
- `xignage-metrics-ingestor` の LogGroup も既存の `/aws/lambda/xignage-metrics-ingestor` を adopt します。

### Outputs

- `DevicesSsmParam`
- `ResolvedDevicesCount`
- `DefaultDeviceId`
- `HeartbeatMissSsmParam`
- `OpsAlertsTopicArn`
- `EventsLoggerLambdaName`
- `UserPoolId`
- `UserPoolClientId`
- `WebrtcCreateJoinEndpoint`

## CiAccessStack

GitHub Actions OIDC 用の CDK デプロイロールを作成します。（根拠: `xignage-infra-aws/lib/ci-access.ts`）

### 主なリソース

- **OIDC Provider**: `token.actions.githubusercontent.com`
- **IAM Role**: `cdk-deploy-role`
  - CloudFormation / S3（CDK assets）/ Lambda / Logs / CloudWatch / IoT / SNS / SQS / IAM / SSM
  - `xignage-ops-alerts` への操作権限
  - `/xignage/devices`、`/xignage/prod/heartbeat/miss_minutes` への Read/Write
  - `ssmBase` 指定時は `/<ssmBase>/*` への Read/Write

### Inputs（Context / Env）

- `ghOwner` / `GH_OWNER`（必須）
- `ghRepo` / `GH_REPO`（必須）
- `ghBranch`（既定: `main`）
- `ghOidcArn` / `GH_OIDC_ARN`（省略時は既定 OIDC）

### Outputs

- `RoleArn`

## RelayEc2Stack

Relay EC2 と Content 管理の基盤（RDS + S3 + Media Lambda）を構築します。（根拠: `xignage-infra-aws/lib/relay-ec2-stack.ts`）

### 主なリソース

- **EC2**
  - Ubuntu 22.04 / `t2.micro` / Public subnet / EIP 付与
  - KeyPair: `relay-ec2-key-tokyo`
  - SG: 22/80/443 を Ingress 許可
  - IAM Role: SSM + CloudWatch Agent + Secrets read
- **Secrets**
  - 参照: `xignage/daily`, `xignage/openai`
- **RDS（PostgreSQL 16.10）**
  - `t4g.micro`、`storageEncrypted: true`、`publiclyAccessible: false`
  - 接続は EC2 SG からの 5432 のみ許可
  - Secrets Manager に DB 認証情報を自動生成
- **S3**
  - Content 用バケット（BlockPublicAccess + SSE）
  - CORS: `https://api.xrobotics.jp` / `http://localhost:5173`
- **SNS + Lambda（メディアサムネイル）**
  - S3 ObjectCreated を SNS トピックへ
  - `MediaThumbnailFn`（Node.js 20, `sharp`）
  - `MediaVideoThumbnailFn`（DockerImageFunction）

### Outputs

- `RelayInstanceId`
- `RelayPublicIp`
- `ContentDbEndpoint`
- `ContentDbSecretArn`
- `ContentBucketName`
