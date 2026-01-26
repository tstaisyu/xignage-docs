# 設定値（Context / Env / SSM）

## 共通タグ

- `env`（context）または `ENV`（env）で `Tags: Env` を決定（未指定は `prod`）
- `GH_OWNER` / `GH_REPO` があれば `Tags: Repo` に反映

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`

## 環境タグ（env/ENV）の影響

`env` / `ENV` は以下にも影響します。

- OTA バケット名: `xignage-ota-bundles-<env>-<account>`
- OTA アップロードロール名: `xignage-ota-upload-role-<env>-<account>`
- デバイス台帳テーブル名: `xignage-device-ledger` または `xignage-device-ledger-<env>`
- Content DB の deletion protection（`prod` のみ有効）

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`, `xignage-infra-aws/lib/relay-ec2-stack.ts`

## デバイス一覧（devices）

`XignageInfraAwsStack` は監視対象デバイスの配列を次の順で解決します。

1. **Context / Env**
   - `-c devices='["XIG-...","XIG-..."]'`
   - `DEVICES='["XIG-...","XIG-..."]'`
   - JSON 配列が基本、CSV もフォールバックで許容
2. **SSM Parameter**
   - `-c devicesSsmParam` → `DEVICES_SSM_PARAM` → 既定 `/xignage/devices`
   - JSON 配列 / CSV のどちらでも可
3. **ローカルフォールバック**
   - `xignage-infra-aws/devices.json`

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`

## デフォルト deviceId

`deviceId` の解決順は以下です。未解決の場合は **スタック作成時にエラー** となります。

1. `-c deviceId=<ID>`
2. `DEVICE_ID`
3. `devices` の先頭要素

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`

## Heartbeat 閾値（miss minutes）

`HeartbeatDomain` の `missMinutes` は次の順で解決されます。

1. `-c hbMissMin`
2. `HB_MISS_MIN`
3. SSM Parameter（`ssmBase` がある場合は `/<ssmBase>/heartbeat/miss_minutes`、無い場合は `/xignage/heartbeat/miss_minutes`）
4. 既定値 `3`

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`, `xignage-infra-aws/lib/ssm-resolver.ts`

## アラーム閾値（SSM）

- Adalo 失敗閾値: `alarms/adalo_failure_threshold`（`ssmBase` 下）
- PushRetry の最古メッセージ閾値: `alarms/push_retry_oldest_age_seconds`（`ssmBase` 下）

根拠: `xignage-infra-aws/lib/events.ts`, `xignage-infra-aws/lib/push-retry.ts`

## その他の Context / Env

- `ssmBase` / `SSM_BASE`: SSM 参照のベースパス
- `enableDlqTest`（context）: `true|1` のときメトリクス DLQ テストルールを作成
- `ALERT_EMAIL`: `xignage-ops-alerts` に Email サブスク追加
- `ghOidcArn` / `GH_OIDC_ARN`: GitHub OIDC Provider ARN（`CiAccessStack` と OTA アップロードロールで参照）
- `legacyLogGroups`: 既存 LogGroup 名の配列（LogRetention を 2 週間で適用）

根拠: `xignage-infra-aws/lib/xignage-infra-aws-stack.ts`, `xignage-infra-aws/lib/ci-access.ts`, `xignage-infra-aws/lib/relay-ec2-stack.ts`, `xignage-infra-aws/lib/log-retention-aspect.ts`
