# xignage-infra-aws（AWS CDK / TypeScript）

## **概要**

**xignage-infra-aws** は、サイネージ端末からの IoT イベントを **AWS IoT ルール → Lambda** に中継し、**Adalo へのプッシュ通知**を行う最小構成の CDK パッケージです。  

- **SQS 再試行キュー**（即時送信失敗やファンアウト超過分のバッファ）
- **再試行コンシューマ Lambda**（指数バックオフ＋Jitter、期限切れ破棄）
- **DynamoDB デデュープテーブル**（`event_id` で重複排除）
- **CloudWatch MetricFilter/Alarm**（成功/失敗・期限切れ・DLQ・遅延検知）

> **生成物**  

- Lambda 関数
  `xignage-events-logger`（Node.js 20 / 256MB / 15s / ARM64 / ログ保管2週間 / DLQあり / 再試行2）
  `xignage-push-retry-consumer`（Node.js 20 / 256MB / 15s / ARM64 / ログ保管2週間 / 再試行2 / 予約同時実行=3）
- SQS
  `xignage-push-retry`（可視性 45s / 保存 4日 / KMS マネージド暗号化）
  `xignage-push-retry-dlq`
- DynamoDB
  `xignage-events-dedupe`（PK: `id`, TTL: `ttl`, PAY_PER_REQUEST, RETAIN）
- Secrets Manager 参照
  `xignage/adalo`（読み取り付与 & `ADALO_SECRET_NAME` を環境変数へ）
- IoT Topic Rule
  `SELECT * FROM 'xignage/v1/devices/+/events/#'` → `xignage-events-logger` Invoke
- CloudWatch
  DLQ アラーム：`xignage-events-logger-dlq-not-empty`
  再試行DLQアラーム：`xignage-push-retry-dlq-not-empty`
  再試行キュー遅延アラーム：`xignage-push-retry-oldest-age-ge-120s`
  メトリクス（MetricFilter）：`AdaloSuccess` / `AdaloFailure` / `PushRetryEnqueued` / `StaleDrop` / `ExpireDrop`
- SNS
  `xignage-ops-alerts`（必要に応じて `ALERT_EMAIL` へ Email サブスクリプション）

## **リポジトリ構成（抜粋）**

- `bin/xignage-infra-aws.ts` … CDK App エントリ（スタック起動）
- `lib/xignage-infra-aws-stack.ts` … 主要スタック定義（IoT / Lambda / SQS / DDB / Secrets / CloudWatch / SNS）
- `lambda/events-logger/index.js` … IoT イベント処理（Adalo 送信、デデュープ、解決・再試行キュー投入）
- `lambda/push-retry-consumer/index.js` … 再試行コンシューマ（指数バックオフ・期限判定）
- `cdk.json`, `tsconfig.json`, `package.json` … 実行/ビルド設定

## **クイックスタート**

### **前提**

- Node.js（LTS 推奨）
- AWS CLI（認証済み）
- AWS CDK v2

### **初回セットアップ**

```bash
# 依存のインストール
npm ci

# まだなら CDK ブートストラップ（アカウント/リージョンごとに実行）
npx cdk bootstrap
```

### **基本コマンド**

```bash
# テンプレート生成（ローカル）
npx cdk synth

# 変更差分の確認（デプロイ前に必ず）
npx cdk diff

# デプロイ
npx cdk deploy

# 破棄（検証環境のみ推奨）
npx cdk destroy
```

!!! warning "課金・権限・影響範囲"
    本番アカウントでの`deploy`前に`diff`を必ず確認してください。IoT ルールはサブスクリプション的に動作し、該当トピックに流れる全イベントが対象となります。

## **スタック構成（Stacks & Constructs）**

### **bin/xignage-infra-aws.ts**

- `new XignageInfraAwsStack(app, 'XignageInfraAwsStack', { ... })`
- 既定では**環境非依存**（`env`未指定）。固定化が必要なら `env` を明示設定。

### **lib/xignage-infra-aws-stack.ts**

- **SQS（再試行系）**  
  `xignage-push-retry`：可視性45s、保存4日、KMSマネージド暗号化、DLQ=`xignage-push-retry-dlq`（MaxReceive=5）  
  アラーム：`xignage-push-retry-dlq-not-empty`、`xignage-push-retry-oldest-age-ge-120s`

- **DynamoDB（デデュープ）**  
  `xignage-events-dedupe`：PK=`id`、TTL=`ttl`、課金=従量、削除ポリシー=RETAIN

- **Lambda**  
  `xignage-events-logger`：Node.js 20 / 256MB / 15s / ARM64 / ログ2週間 / DLQ / 再試行2  
  `xignage-push-retry-consumer`：SQS イベントソース（バッチ5）／予約同時実行3

- **Secrets Manager（参照）**  
  `xignage/adalo` を両 Lambda に付与、`ADALO_SECRET_NAME` を環境変数設定

- **IoT Topic Rule**  
  SQL：`SELECT * FROM 'xignage/v1/devices/+/events/#'` → `xignage-events-logger` Invoke（`CfnPermission` で IoT 限定）

- **CloudWatch Metrics（MetricFilter）**  
  `AdaloSuccess`（成功時1）/ `AdaloFailure`（失敗時1）  
  `PushRetryEnqueued`（再試行投入時1）  
  `StaleDrop`（鮮度落ちで破棄時1）  
  `ExpireDrop`（再試行側で期限切れ破棄時1）

- **SNS（通知）**  
  `xignage-ops-alerts` トピック（`ALERT_EMAIL` があれば Email 購読を自動追加）  
  上記アラームの通知先として連携

## **Lambda: events-logger（IoTイベント → Adalo送信・再試行投入）**

### **役割**

1. 入力バリデーション（`deviceId` または `adalo.email|userId` 必須）
2. 鮮度判定（`MAX_AGE_SEC` 超過は破棄＝`StaleDrop`）
3. 重複排除（`event_id` があれば DynamoDB 条件付き Put でクレーム）
4. 宛先解決（`deviceId` のみの場合、Adalo Collections から Users の Email を解決）
5. Adalo 送信（成功/失敗ログ、失敗・超過分は SQS へ再試行投入）

### **環境変数（主要）**

- ログ・挙動：`LOG_LEVEL`（既定 `info`）、`HTTP_TIMEOUT_MS`（既定 `3000`）、`MAX_AGE_SEC`（既定 `30`）
- 宛先解決（Adalo Collections）：`ADALO_DEVICES_COLLECTION_ID`、`ADALO_USERS_COLLECTION_ID`、`ADALO_DEVICE_ID_FIELD`（既定 `deviceId`）、`ADALO_DEVICES_REL_FIELD`（例 `User`）、`ADALO_USERS_EMAIL_FIELD`（既定 `email`）
- Secrets：`ADALO_SECRET_NAME`（`xignage/adalo`：`{ appId, apiKey }`）
- 冪等化・再試行：`DEDUPE_TABLE`（例 `xignage-events-dedupe`）、`DEDUPE_TTL_SECONDS`（例 `45`）、`PUSH_MAX_FANOUT`（既定 `50`）、`PUSH_RETRY_QUEUE_URL`（`xignage-push-retry`）

### **入力イベント（契約の目安）**

```json
{
  "event_id": "optional-unique-id",
  "ts": 1730340000,
  "deviceId": "XIG-XXXX-YYYY",
  "title": "Xignage",
  "body": "Event received",
  "adalo": {
    "email": "user@example.com",
    "userId": "123"
  }
}
```

### **実装ポイント**

- Adalo コレクション解決は API 制約回避のため「全件取得 → ローカルフィルタ」で実施
- 送信結果は `[adalo:resp]` で `ok/ng`、HTTP ステータス、レスポンス JSON を記録
- 失敗（429/5xx など）やファンアウト超過分は `PushRetryEnqueued` を計測しつつ SQS へ投入

## **Lambda: push-retry-consumer（SQS 再試行）**

### **役割**

- `xignage-push-retry` からメッセージを受け取り、指数バックオフ＋Jitter で再送
- 期限管理（`expiresAt` 超過は破棄して `ExpireDrop` を記録）
- 4xx（429 以外）は恒久エラーとして破棄、429 は `Retry-After` を考慮

### **メッセージ形式（例）**

```json
{
  "type": "adalo_push_retry",
  "at": "2025-10-31T12:00:00.000Z",
  "item": {
    "email": "user@example.com",
    "title": "Xignage",
    "body": "Event received",
    "deviceId": "XIG-XXXX-YYYY",
    "ts": 1730340000,
    "expiresAt": 1730340030
  }
}
```

### **実装ポイント**

- Backoff は 5s, 10s, 20s… 最大 900s（SQS `DelaySeconds` 上限）＋小さな Jitter
- バッチ内の部分失敗は `batchItemFailures` で返却（再配信を促す）
- 大量メールはチャンク分割し段階的に再投入

## **IoT ルール**

- SQL：`SELECT * FROM 'xignage/v1/devices/+/events/#'`
- ワイルドカード：`+`（1 階層），`#`（以降すべて）
- 無効化：`ruleDisabled: false`（常時有効）

!!! warning "トピック設計の注意"
    端末側の Publish トピックがこのルールにマッチしている必要があります。命名規則がズレると Lambda が起動しません。

## **パラメータ & 環境**

- CDK の環境（env）：既定は未指定（環境非依存テンプレート）。必要に応じて `bin/` で明示
- Secrets：`xignage/adalo`（両 Lambda に `grantRead` 済／環境変数 `ADALO_SECRET_NAME` を付与）
- SNS 通知先：`ALERT_EMAIL` を与えると `xignage-ops-alerts` に Email 購読を自動追加

## **運用（Operations）**

### **定常フロー**

```bash
npx cdk synth
npx cdk diff
npx cdk deploy
```

- 反映後、CloudFormation Output の EventsLoggerLambdaName で関数名を確認できます。
- アラームは `xignage-ops-alerts` に通知されます（Email 購読を設定した場合）。

### **ロールバック/削除**

```bash
# 変更が不適切な場合の再デプロイや、検証環境の破棄
npx cdk deploy
npx cdk destroy
```

!!! warning "本番の破棄禁止"
    `cdk destroy` は基本的に **検証環境限定**。本番では段階的ロールバックを検討してください。

## **可観測性（Observability）**

- ログ：両 Lambda とも保管 2 週間。代表ログは `[iot-event]`、`[adalo:resp]`、`[push-retry] enqueued`、`[stale] drop`、`[retry-consumer][expire] drop`
- メトリクス（MetricFilter）：`Xignage/Push/AdaloSuccess`、`AdaloFailure`、`PushRetryEnqueued`、`StaleDrop`、`ExpireDrop`
- アラーム：`xignage-events-logger-dlq-not-empty`、`xignage-push-retry-dlq-not-empty`、`xignage-push-retry-oldest-age-ge-120s`

## **トラブルシューティング**

- `AccessDenied（Secrets 読取）`：両 Lambda に `grantRead(xignage/adalo)` が付与され、`ADALO_SECRET_NAME` が一致しているか
- `AccessDenied（IoT → Lambda Invoke）`：`CfnPermission` の `sourceArn` が該当 Topic Rule の ARN か
- Adalo へ届かない：`adalo.email|userId` 不足／`deviceId` からの解決 0 件／429・5xx は再試行へ、429 以外の 4xx は恒久エラー
- 再試行が詰まる：遅延アラームや DLQ の増加を確認（キュー権限やネットワークを点検）
- 重複通知：`event_id` の付与と `DEDUPE_TTL_SECONDS` の妥当性を確認

## **FAQ**

- 環境（dev/stg/prod）の分離：`bin/` で `env` を明示、または `context`/タグ運用で切替
- メール宛先の自動解決を無効化：イベントに `adalo.email` または `adalo.userId` を直接含める
- 再試行の上限・間隔：キュー可視性、コンシューマのバッチサイズ、指数バックオフ関数、`MAX_AGE_SEC` を調整
