# デプロイ

## 前提

- AWS CDK v2
- AWS CLI 認証済み
- Node.js（CDK 実行環境）
- RelayEc2Stack を使う場合は **EC2 KeyPair** が必要（`relay-ec2-key-tokyo`）

根拠: `xignage-infra-aws/bin/xignage-infra-aws.ts`, `xignage-infra-aws/lib/relay-ec2-stack.ts`

## リージョン

- `XignageInfraAwsStack`: `CDK_DEFAULT_REGION`（未指定時 `ap-northeast-1`）
- `CiAccessStack`: `ap-northeast-1` 固定
- `RelayEc2Stack`: `ap-northeast-1` 固定

根拠: `xignage-infra-aws/bin/xignage-infra-aws.ts`

## 基本コマンド

```bash
npm ci
npx cdk synth
npx cdk diff
npx cdk deploy
```

## スタック別デプロイ例

```bash
# 中核スタック
npx cdk deploy XignageInfraAwsStack \
  -c deviceId=<DEVICE_ID> \
  -c devicesSsmParam=/xignage/devices \
  -c ssmBase=/xignage/prod

# CI ロール
npx cdk deploy CiAccessStack \
  -c ghOwner=<ORG_OR_USER> \
  -c ghRepo=<REPO>

# Relay EC2
npx cdk deploy RelayEc2Stack
```

## SSM 参照について

`devicesSsmParam` や `ssmBase` は **SSM Parameter Store を synth 時に参照**します。
SSM を参照する場合は deploy 実行環境に `ssm:GetParameter` 権限が必要です。

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`, `xignage-infra-aws/lib/ssm-resolver.ts`

## RelayEc2Stack の注意点

- `relay-ec2-key-tokyo` という **KeyPair 名** を参照するため、事前作成が必須
- `MediaVideoThumbnailFn` は Docker イメージビルドを行う

根拠: `xignage-infra-aws/lib/relay-ec2-stack.ts`
