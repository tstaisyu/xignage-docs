# 監視 / ダッシュボード

## CloudWatch Logs

- すべての Lambda に **LogRetention 2 週間** を適用（`LambdaLogRetentionAspect`）
- `legacyLogGroups` が指定されている場合は、指定 LogGroup にも LogRetention を適用

根拠: `xignage-infra-aws/lib/log-retention-aspect.ts`, `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`, `xignage-infra-aws/lib/ci-access.ts`, `xignage-infra-aws/lib/relay-ec2-stack.ts`

## MetricFilters（Xignage/Push）

`xignage-events-logger` のログからメトリクスを生成します。

- `AdaloSuccess`
- `AdaloFailure`
- `PushRetryEnqueued`
- `StaleDrop`

`xignage-push-retry-consumer` からは `ExpireDrop` を生成します。

根拠: `xignage-infra-aws/lib/events.ts`, `xignage-infra-aws/lib/push-retry.ts`

## Alarms

- **イベント DLQ**: `xignage-events-logger-dlq-not-empty`
- **Adalo 失敗**: `xignage-adalo-failure-sum-ge-3-5m`
- **PushRetry DLQ**: `xignage-push-retry-dlq-not-empty`
- **PushRetry 最古 Age**: `xignage-push-retry-oldest-age-ge-120s`
- **Metrics Ingestor Error**: `xignage-metrics-ingestor-errors`
- **Metrics Rule DLQ**: DLQ 可視メッセージ > 0

根拠: `xignage-infra-aws/lib/events.ts`, `xignage-infra-aws/lib/push-retry.ts`, `xignage-infra-aws/lib/metrics/metrics-domain.ts`, `xignage-infra-aws/lib/metrics/metrics-alarms.ts`

## Heartbeat アラーム

- `Xignage/Device` の `uptime_s` を使い、デバイスごとの **無通信アラーム** を作成
- アラームアクション（SNS 通知）は現状コメントアウトのため **通知は行われない**

根拠: `xignage-infra-aws/lib/heartbeat-domain.ts`, `xignage-infra-aws/lib/metrics/metrics-alarms.ts`

## Dashboard

- Device Metrics Dashboard（`deviceId` 単位）
- KPI Dashboard（グローバル）

根拠: `xignage-infra-aws/lib/metrics/metrics-domain.ts`, `xignage-infra-aws/lib/metrics/metrics-dashboard.ts`, `xignage-infra-aws/lib/metrics/metrics-kpi-dashboard.ts`
