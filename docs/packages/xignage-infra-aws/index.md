# xignage-infra-aws（AWS CDK / TypeScript）

## 概要

**xignage-infra-aws** は、Xignage の IoT イベント処理・通知・メトリクス可視化・WebRTC・リレー基盤を AWS CDK で構築するリポジトリです。現行実装では 4 つのスタックをデプロイします。

- **XignageInfraAwsStack**: IoT ルール、Lambda、SQS、DynamoDB、SNS、CloudWatch、Cognito、API Gateway、OTA 用 S3 + OIDC ロールなどの中核スタック
- **CiAccessStack**: GitHub Actions OIDC 用の CDK デプロイロール
- **RelayEc2Stack**: Relay EC2 + Content RDS + S3 + メディアサムネイル生成 + IoT バンドル/デバイス台帳
- **IamGuardrailsStack**: IAM ユーザー向けの IoT/DynamoDB 変更を抑止するガードレール

このドキュメントは **現行実装（`xignage-infra-aws/**`）に一致する構成** を記載しています。

## 全体像（簡略）

```text
IoT Events            IoT Metrics                   WebRTC
  |                     |                             |
  v                     v                             v
IoT Rule          IoT Rule (DLQ)                API Gateway
  |                     |                             |
  v                     v                             v
Lambda               Lambda                    Cognito UserPool
(events-logger)   (metrics-ingestor)               (Auth)
  |                     |                             |
  v                     v                             v
Adalo Push       CloudWatch Metrics             Lambda (create-join)
  |
  v
SQS retry -> Lambda (retry-consumer)
```

## ドキュメント構成

- **スタック/構成**: `stacks.md`
- **デプロイ/運用**: `deploy.md`
- **設定値（Context/Env/SSM）**: `config.md`
- **Relay EC2 + RDS + S3**: `relay-ec2.md`
- **監視/ダッシュボード**: `observability.md`
- **IoT ルール/ポリシー**: `iot.md`

## 配布物（Artifacts）

- Lambda ソース: `xignage-infra-aws/lambda/**`
- Docker イメージビルド: `xignage-infra-aws/lambda/media-video-thumbnail`（`DockerImageFunction`）
- CDK エントリ: `xignage-infra-aws/bin/xignage-infra-aws.ts`

詳細は各ページを参照してください。
