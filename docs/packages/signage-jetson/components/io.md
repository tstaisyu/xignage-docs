# IO Components — `io.md`

デバイスの物理入出力（ボタン・ToF・イベント送信）および常駐アプリの仕様をまとめます。  
本ページは **モジュール別の実装仕様**・**ENV**・**I/O 前提**・**運用注意** をひとつに集約します。

- 共通 ENV: `/etc/signage/io.env`, `/etc/signage/iot.env`
- GPIO 番号体系: **BCM を既定**（互換のため BOARD 変数も受理）
- GPIO バックエンド:
  - Jetson: `Jetson.GPIO` が利用可能なら使用
  - それ以外: **libgpiod**（`/dev/gpiochip0`）

---

## **`app.py` — IO 常駐アプリ（ボタン／ToF／LED／イベント出力）**

- **GPIO（ボタン＋LED）** と **ToF 距離** を監視し、
  1) **状態スナップショット**を `/run/signage/io_state.json` に原子的書き出し、
  2) **イベントログ**を `/var/log/signage/io_events.jsonl` に JSON Lines で追記、
  3) **AWS IoT へイベント送信**（ベストエフォート）を行う常駐プロセス。
- ループ周期は約 **50Hz**（20ms スリープ）。例外時も可能な範囲で処理継続。
- `io_events.jsonl` は `/etc/logrotate.d/xignage-io` で日次ローテーション。

### **GPIO バックエンド**

- Jetson: `Jetson.GPIO` を利用（`GPIO.setmode(GPIO.BCM)`）
- Pi: `libgpiod` を利用（`/dev/gpiochip0` の line offset = BCM 番号）

### **主な環境変数（抜粋）**

| 変数 | 既定 | 説明 |
| --- | --- | --- |
| `BUTTON_BCM_PIN` / `BUTTON_BOARD_PIN` | `5`（BCM 優先） | ボタン入力ピン |
| `BUTTON_DEBOUNCE_MS` | `30` | デバウンス時間 |
| `BUTTON_LED_BCM_PIN` / `BUTTON_LED_BOARD_PIN` | `13` | LED 出力ピン |
| `BUTTON_LED_ACTIVE_LOW` | `0` | `1` でアクティブ Low |
| `STATE_PATH` | `/run/signage/io_state.json` | スナップショット出力パス |
| `EVENTS_PATH` | `/var/log/signage/io_events.jsonl` | イベントログ出力パス |
| `TOF_ENABLE` | `1` | `0/false` で無効化 |
| `TOF_MODEL` | `auto` | `auto/vl53l0x/vl53l1x/none` |
| `TOF_ADDR` / `TOF_BUS` | `0x29` / `1` | I²C アドレス/バス |
| `TOF_THRESHOLD_MM` | `1200` | 在席しきい値（mm） |
| `TOF_DISTANCE_MODE` | `2` | 0/1/2 = SHORT/MEDIUM/LONG |
| `TOF_TIMING_BUDGET_MS` | `50` | 測定タイミングバジェット |
| `TOF_I2C_BACKEND` | `bitbang` | `hardware` / `bitbang` |
| `TOF_BB_SDA` / `TOF_BB_SCL` | `17` / `27` | bit-bang 用 BCM ピン |
| `LED_NEAR_ON_MM` | `2000` | 近接点灯しきい値 |
| `LED_EXIT_DELAY_SEC` | `5` | 遅延消灯時間（秒） |

---

## **`button.py` — デバウンス付きボタンクラス**

- Jetson: `Jetson.GPIO` の `GPIO.input()` を利用
- Pi: `libgpiod` で **プルアップ**・**両エッジ**を監視
- GPIO には **BCM 番号**を指定（BOARD 互換は app 側で吸収）

---

## **`tof.py` — ToF 距離センサ（VL53L1X / VL53L0X）ラッパー**

- `model="auto"` で **L1X → L0X** の順に初期化を試行
- `bitbang`/`hardware` の I²C バックエンドを切替可能

---

## **`aws_iot_pub.py` — AWS IoT へのイベント送信（MQTT/TLS, Paho）**

- 端末から **AWS IoT Core** へ安全に MQTT パブリッシュ
- **client_id は Thing 名**（`IOT_THING_NAME`）
- 送信先トピック：`xignage/v1/devices/<thing>/events/<kind>`
- `IOT_*` が不足している場合は **起動時に例外**になりますが、
  `app.py` 側で **警告ログを出してスキップ**します（ベストエフォート）。

### **必要な環境変数（`/etc/signage/iot.env` 由来）**

| ENV | 用途 |
| --- | --- |
| `IOT_ENDPOINT` | IoT データエンドポイント |
| `IOT_THING_NAME` | 接続時の **client_id** 兼 Thing 名 |
| `IOT_CERT_PATH` | デバイス証明書 `cert.pem` |
| `IOT_KEY_PATH` | デバイス秘密鍵 `private.key` |
| `IOT_CA_PATH` | ルート CA `AmazonRootCA1.pem` |

---

## **運用時の注意**

- **時刻同期**：`ts` の信頼性確保のため NTP 同期を推奨
- **証明書権限**：`private.key` は **0600**、CA は **0644** を維持
- **libgpiod**：Pi では `/dev/gpiochip0` と line offset（BCM）を使用

