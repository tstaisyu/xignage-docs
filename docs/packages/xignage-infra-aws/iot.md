# IoT ルール / ポリシー

## イベント通知ルール

- ルール名: `xignage_events_to_lambda`
- SQL: `SELECT * FROM 'xignage/v1/devices/+/events/#'`
- アクション: `xignage-events-logger` を Invoke
- IoT から Lambda への Invoke 権限を付与

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`, `xignage-infra-aws/lib/events.ts`

## メトリクスルール

- ルール名: `xignage_metrics_to_cw`
- SQL: `SELECT topic(4) AS deviceId, * FROM 'xignage/v1/devices/+/metrics/+'`
- アクション: `xignage-metrics-ingestor` を Invoke
- errorAction: SQS DLQ（CDK が自動生成するキュー、明示名は未指定）

根拠: `xignage-infra-aws/lib/metrics/metrics-rule.ts`, `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`

## DLQ テストルール（任意）

- `enableDlqTest` が有効な場合、テスト用ルールを作成
- ルール名: `xignage_metrics_to_cw_test`（既定）
- SQL: `SELECT topic(3) AS deviceId, * FROM 'xignage/test-metrics/+'`

根拠: `xignage-infra-aws/lib/metrics/metrics-domain.ts`, `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`

## IoT Thing 管理権限（CiAccess Construct）

`iot-provisioner-role` に対し以下の権限を追加します。

- `iot:DescribeThing`, `iot:UpdateThing`
- `iot:CreateThingGroup`, `iot:DescribeThingGroup`, `iot:AddThingToThingGroup`
- ThingGroup: `xignage-devices`

根拠: `xignage-infra-aws/lib/ci-access.ts`

## IoT デバイスポリシー

`buildDevicePolicyDocument()` が存在しますが、**デバイスポリシーの作成はコメントアウト**されており、現状は自動作成されません。

根拠: `xignage-infra-aws/lib/iot-device-policy.ts`, `xignage-infra-aws/lib/events.ts`
