# xignage-infra-aws（AWS CDK / TypeScript）

## **概要**

**xignage-infra-aws** は、サイネージ端末からの IoT イベントを **AWS IoT ルール → Lambda** に中継し、必要に応じて **Adalo（推奨）／OneSignal（任意）** にプッシュ通知する最小構成の CDK パッケージです。

- **生成物（本ページのコードから確定しているもの）**
  - Lambda 関数：`xignage-events-logger`（Node.js 20 / 128MB / 10s / 1週間ログ保持）
  - AWS Secrets Manager のシークレット参照（読み取り付与）  
    - `xignage/onesignal` → `ONESIGNAL_SECRET_NAME`  
    - `xignage/adalo` → `ADALO_SECRET_NAME`
  - AWS IoT Topic Rule：`SELECT * FROM 'xignage/v1/devices/+/events/#'`  
    → Lambda Invoke（`lambda:InvokeFunction` を IoT に許可）
  - 出力（CloudFormation Output）：`EventsLoggerLambdaName`

!!! note "目的外（現時点）"
    ネットワーク／VPC、API Gateway、DynamoDB 等の追加リソースは本スタックには含みません。必要になった段階で別途コンストラクトを追加してください。

## **リポジトリ構成（抜粋）**

- `bin/xignage-infra-aws.ts` … CDK App エントリ（スタック起動）
- `lib/xignage-infra-aws-stack.ts` … 主要スタック定義（Lambda / Secrets / IoT ルール / 権限 / 出力）
- `lambda/events-logger/index.js` … IoT イベントを受けて Adalo/OneSignal に通知
- `test/*.ts` … Jest（将来の拡張用）
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
- 既定では**環境非依存**（`env`未指定）。必要に応じて以下のいずれかを有効化できます：

```ts
// CDK の現在の CLI 設定に従う
// env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

// アカウント/リージョンを固定
// env: { account: '123456789012', region: 'us-east-1' },
```

### **lib/xignage-infra-aws-stack.ts**

- **Lambda: `xignage-events-logger`**
  - ランタイム：Node.js 20（`lambda.Runtime.NODEJS_20_X`）
  - メモリ：128 MB
  - タイムアウト：10 秒
  - コード配置：`lambda/events-logger`
  - ログ保持：1 週間（`logs.RetentionDays.ONE_WEEK`）
- **Secrets Manager（参照のみ）**
  - `xignage/onesignal` → Lambda に `grantRead` & 環境変数 `ONESIGNAL_SECRET_NAME` を設定
  - `xignage/adalo` → Lambda に `grantRead` & 環境変数 `ADALO_SECRET_NAME` を設定
- **IoT Topic Rule**
  - SQL：`SELECT * FROM 'xignage/v1/devices/+/events/#'`
  - アクション：Lambda Invoke（`functionArn: eventsLogger.functionArn`）
  - `ruleDisabled: false`
- **IoT → Lambda Invoke 権限**
  - `lambda:CfnPermission` で `principal: iot.amazonaws.com`
  - `sourceArn` に **当該 Topic Rule の ARN** を指定（ルール起因に限定）
- **出力**
  - `CfnOutput('EventsLoggerLambdaName')`：関数名をスタック出力

## **Lambda: events-logger（通知ハンドラ）**

### **役割**

- IoT ルール経由で渡ってきたイベントを受け取り、**Adalo**（推奨）または **OneSignal**（任意）に通知を転送します。

### **Secrets と環境変数**

- Secrets Manager（**名前固定**）
  - `xignage/adalo` → `{ "appId": "...", "apiKey": "..." }`
  - `xignage/onesignal` → `{ "appId": "...", "restApiKey": "..." }`
- Lambda 環境変数（**スタック側で設定済み**）
  - `ADALO_SECRET_NAME = "xignage/adalo"`
  - `ONESIGNAL_SECRET_NAME = "xignage/onesignal"`

!!! note "シークレットの軽量キャッシュ"
    プロセス内オブジェクトで Secrets の取得結果を保持し、**コールドスタート後の 2 回目以降**の呼び出しでは Secrets API 呼び出しを省略します。

### **入力イベント（契約の目安）**

```json
{
  "adalo": {
    "email": "user@example.com",
    "userId": "123",
    "title": "Xignage",
    "body": "Event received"
  },
  "push": {
    "title": "Optional via OneSignal",
    "message": "Hello",
    "playerId": "xxxxx",
    "externalId": "user-123"
  }
}
```

- **Adalo 通知（推奨ルート）**
  - `adalo.email` **または** `adalo.userId` のいずれか必須（どちらも無い場合は送信しない）
  - タイトル/本文が無い場合は既定値を使用
- **OneSignal 通知（必要な場合のみ）**
  - `push.playerId` **または** `push.externalId` が存在する場合のみ送信

!!! tip "失敗時の挙動（グレースフルデグレード）"
    シークレット未設定や **audience 不足** の場合は、Lambda は 200 で復帰しつつ **ログに理由を出力**します（致命的エラーで停止しない）。

## **IoT ルール**

- SQL：`SELECT * FROM 'xignage/v1/devices/+/events/#'`
- ワイルドカード：`+`（1 階層），`#`（以降すべて）
- 無効化：`ruleDisabled: false`（常時有効）

!!! warning "トピック設計の注意"
    端末側の Publish トピックがこのルールにマッチしている必要があります。命名規則がズレると Lambda が起動しません。

## **パラメータ & 環境**

- **CDK の環境（env）**
  - 既定：未指定（環境非依存テンプレートを生成）
  - 固定が必要なら `bin/` 側で `env` を明示設定
- **Secrets**
  - 名前は **`xignage/onesignal`**, **`xignage/adalo`**（変更したい場合はスタック/コードの両方を更新）
- **Lambda 環境変数**
  - `ONESIGNAL_SECRET_NAME`, `ADALO_SECRET_NAME`（スタックで自動付与）

## **運用（Operations）**

### **定常フロー**

```bash
npx cdk synth
npx cdk diff
npx cdk deploy
```

- 反映後、CloudFormation Output の EventsLoggerLambdaName で関数名を確認できます。

### **ロールバック/削除**

```bash
# 変更が不適切な場合の再デプロイや、検証環境の破棄
npx cdk deploy
npx cdk destroy
```

!!! warning "本番の破棄禁止"
    `cdk destroy` は基本的に **検証環境限定**。本番では段階的ロールバックを検討してください。

## **可観測性（Observability）**

- **ログ**
  - CloudWatch Logs：保持期間 **1 週間**
  - Adalo/OneSignal の API レスポンス（HTTP ステータス・JSON）を **構造化で記録**
- **推奨**
  - 送信成功/失敗件数のメトリクス化、アラート（SNS/ChatOps）連携

## **トラブルシューティング**

- **`AccessDenied`（Secrets 読取）**  
  Lambda に `grantRead` があるか、対象アカウント/リージョンのシークレット名が一致しているか確認。
- **`AccessDenied`（IoT → Lambda Invoke）**  
  `lambda:CfnPermission` の `sourceArn` が **該当 Topic Rule の ARN** になっているか確認。
- **通知が届かない**  
  - 入力イベントの **audience** が不足（Adalo: `email` or `userId`、OneSignal: `playerId` or `externalId`）
  - シークレット未設定（ログに `[adalo] secret missing` などが出力）
- **Lambda が起動しない**  
  端末の Publish トピックが `xignage/v1/devices/+/events/#` に一致しているか確認。

## **FAQ**

- **環境（dev/stg/prod）をどう分ける？**  
  `bin/` 側で `env` を明示、もしくは `context`/タグでリージョン・アカウントを切り替えます。
- **OneSignal を無効化したい**  
  端末イベントから `push` セクションを送らない／Lambda コードの該当ブロックを除去。スタックから `xignage/onesignal` 参照も削除可能です。
- **Secrets 名を変えたい**  
  スタック（`fromSecretNameV2` / `addEnvironment`）と Lambda コード（環境変数参照）を同時に更新します。
