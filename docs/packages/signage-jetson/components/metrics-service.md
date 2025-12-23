# メトリクス送信サービス — `metrics/index.js`

## **概要**

`xignage-metrics.service` から実行される **Node.js パッケージ**。  
ボード別モジュール（`boards/*.js`）で取得した温度/電圧/スロットル等のメトリクスを、**AWS IoT Core (MQTTS)** に **30 秒間隔**で Publish します。

- **トピック**：`xignage/v1/devices/<thing>/metrics/system`
- **Thing 名**：`IOT_THING_NAME` があれば優先、なければ `--device` 引数
- **TLS**：デバイス証明書 / 秘密鍵 / ルート CA 必須（`IOT_*`）

## **必要な環境変数（/etc/signage/iot.env）**

| ENV | 用途 |
|---|---|
| `IOT_ENDPOINT` | IoT データエンドポイント |
| `IOT_THING_NAME` | Thing 名（`--device` を上書き） |
| `IOT_CERT_PATH` | デバイス証明書 `cert.pem` |
| `IOT_KEY_PATH` | デバイス秘密鍵 `private.key` |
| `IOT_CA_PATH` | ルート CA `AmazonRootCA1.pem` |

## **送信ペイロード（スキーマ）**

```json
{
  "ts": 1730000000000,
  "temp_c": 42.3,
  "power_mw": 5100,
  "volts_v": 5.02,
  "throttled": "0x0",
  "boot_count": 3,
  "boot_ts": 1729999000000,
  "uptime_s": 120,
  "board": "jetson"
}
```

## **ボード検出**

- `BOARD_TYPE` 環境変数があれば優先
- 未設定時は **Pi → Jetson → generic** の順で自動判定

## **注意・セキュリティ**

- `private.key` は **600**、CA は **0644** を維持
- `boot_state.json` は `/var/lib/xignage-metrics/boot_state.json` に保存
