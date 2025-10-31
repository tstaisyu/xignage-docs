# IO Components — `io.md`

デバイスの物理入出力（ボタン・ToF・イベント送信）および常駐アプリの仕様をまとめます。  
本ページは **モジュール別の実装仕様**・**ENV**・**I/O前提**・**運用注意** をひとつに集約します。

- 共通ENV（抜粋）: `/etc/signage/io.env`, `/etc/signage/events.env`
- GPIO番号体系: 既定は **BOARD（物理ピン）**（BCMとは異なるので注意）

## **`app.py` — IO 常駐アプリ（ボタン／ToF／LED／イベント出力）**

- **GPIO（ボタン＋LED）** と **ToF 距離** を監視し、  
  1) **状態スナップショット**を `/run/signage/io_state.json` に原子的書き出し、  
  2) **イベントログ**を `/var/log/signage/io_events.jsonl` に JSON Lines で追記、  
  3) **AWS IoT へイベント送信**（ベストエフォート）を行う常駐プロセス。
- ループ周期は約 **50Hz**（20ms スリープ）。例外時も可能な範囲で処理継続。

### **番号体系と互換**

- **GPIO.setmode(GPIO.BCM)**（BCM基準）。  
- 環境変数は **BCM を優先**、なければ **既存互換の BOARD 変数**を参照（後方互換）。

### **出力**

- **状態スナップショット**：`/run/signage/io_state.json`  
  直近時刻、ボタン押下状態、ToF の距離/在席、LED ON/OFF などを原子的に更新
- **イベントログ**：`/var/log/signage/io_events.jsonl`  
  `{"ts": "...", "type": "button|presence|info|warn|error|debug", "src": "...", ...}`

### **AWS IoT 送信（ベストエフォート）**

- `aws_iot_pub.py` を利用。接続失敗・未設定などの例外は**握りつぶして継続**（ログのみ）。  
- 送信種別：`button` / `presence`（トピックに反映）。QoS/去重は送信側/サーバ側で担保。

### **在席判定と LED 制御（既定ロジック）**

- 在席（`present=True`）判定：`distance_mm < TOF_THRESHOLD_MM`（既定 **1200mm**）。  
- LED は **近接点灯／遅延消灯**：
  近接点灯：`distance_mm < LED_NEAR_ON_MM`（既定 **2000mm**）で即時 ON  
  遅延消灯：離脱後 **LED_EXIT_DELAY_SEC**（既定 **5s**）経過で OFF

> **時系列動作（概要）**

1. **初期化**：BCM モード・警告抑止、ボタン（デバウンス＋LED制御）、ToF（モデル/バックエンド）初期化。初回の状態スナップショットを書き出し。  
2. **ボタン監視**：チャタリング抑止後の**確定変化時のみ**イベント発行（`pressed/released`）、IoT 送信、スナップショット更新。  
3. **ToF 監視**：距離を mm で取得し、**しきい値**で在席を更新。変化時のみ `presence` イベント発行／IoT 送信。近接なら LED ON、離脱後は遅延で OFF。都度スナップショット更新。  
4. **終了処理**：ToF 停止、MQTT 切断、GPIO クリーンアップ、終了ログ。

### **主な環境変数（抜粋）**

| 変数 | 既定 | 説明 |
|---|---|---|
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

### **運用メモ**

- **NTP 同期**で `ts` の信頼性を確保。  
- BCM/BOARD 混在を避けるため、**BCM で統一**（既定）。互換維持が必要な場合のみ BOARD 変数を使用。  
- ToF のバックエンド既定は **`bitbang`**。本番では可能な限り **`hardware`** 推奨。  
- ログは JSON Lines なので、`jq` 等で集計が容易。

---

## **`button.py` — デバウンス付きボタンクラス**

物理プルアップ前提のボタン入力を**ソフトウェアデバウンス**し、**状態変化（立下り/立上り）**を安定検出します。  
任意で **LED駆動**（アクティブLow/High切替、起動時既定ON/OFF）にも対応。

### **前提・電気仕様**

- 内蔵（回路）**プルアップ**前提：押下＝**LOW**、非押下＝**HIGH**  
- GPIO番号は **BOARD（物理ピン）** を指定  
- LEDは**任意**。アクティブLow/High、起動時の既定ON/OFFを指定可能

### **主な挙動**

- 周期（目安 **10–20ms**）で更新処理を呼び出し、**確定状態が変化した瞬間のみ変化通知**。  
- 現在の確定状態は内部フラグで保持（`True=押下`）。  
- デバウンス時間の既定は **30ms**。  
- LEDは、アクティブLow/Highの切替、起動時の既定ON/OFF、任意のON/OFF制御に対応。

### **代表的なパラメータ**

| パラメータ | 既定値 | 説明 |
|---|---:|---|
| `board_pin` | — | **BOARD**番号のボタン入力ピン（必須） |
| `debounce_ms` | 30 | デバウンス時間（ms） |
| `led_board_pin` | なし | LED（またはドライバ）出力ピン（任意） |
| `led_active_low` | False | `True`=LOW点灯, `False`=HIGH点灯 |
| `led_default_on` | True | 起動時のLED状態（`True`=点灯） |

> **時系列動作（概要）**

1. **初期化**：起動時に原信号を読み取り、現在の確定状態（押下/非押下）を初期化する。  
2. **変化検知**：原信号に変化があれば、その時刻だけ記録し、ただちには確定しない（ノイズ除去）。  
3. **確定更新**：原信号が **`debounce_ms` 以上**連続して同一なら状態を確定し、内部フラグを更新。  
   この確定タイミングでのみ「状態変化あり」として通知される。

### **トラブルシュート**

- **チャタリングが残る**：`debounce_ms` を 30→50ms などへ増加。  
- **LEDの論理が逆**：`led_active_low` の真偽を入れ替える。  
- **ピン番号の勘違い**：BOARD と BCM の取り違いに注意（本実装は **BOARD 前提**）。  
- **プルアップ不一致**：回路側のプルアップ/プルダウン設定と一致しているか確認。

---

## **`tof.py` — ToF 距離センサ（VL53L1X / VL53L0X）ラッパー**

- VL53L1X / VL53L0X を**自動検出**し、**距離（mm）**を取得する薄いラッパー。
- 測定開始/停止の簡素化、**単位の自動正規化（cm→mm）**、例外時の安全終了ログを提供。

### **サポート／自動検出**

- `model="auto"` で **L1X → L0X** の順に初期化を試行（成功した方を採用）。
- `model="vl53l1x" | "vl53l0x"` で機種を固定。
- `model="none"` で **無効化**（ドライバ読み込みや I²C アクセスを行わない）。

### **I²C バックエンド**

- 既定：`hardware`（SCL/SDA をそのまま使用）
- 代替：`bitbang`（BCM ピンを指定してソフト I²C 生成）
- バックエンドは **引数 `backend`** または **環境変数**で選択：

| 設定項目 | 種別 | 既定 | 説明 |
|---|---|---:|---|
| `backend` | 引数 | `hardware` | `hardware` / `bitbang` |
| `TOF_I2C_BACKEND` | ENV | `hardware` | 引数未指定時の上書きに使用 |
| `bb_sda_bcm` / `bb_scl_bcm` | 引数 | なし | `bitbang` 選択時の SDA/SCL（BCM） |
| `TOF_BB_SDA` / `TOF_BB_SCL` | ENV | `17` / `27` | 引数未指定時の `bitbang` ピン |

### **主な引数**

| 引数 | 既定 | 説明 |
|---|---:|---|
| `model` | `"auto"` | `"auto"/"vl53l1x"/"vl53l0x"/"none"` |
| `addr` | `0x29` | I²C アドレス |
| `bus` | `1` | 予備。今後の拡張用 |
| `log(level,msg)` | なし | ログ関数（例：`info`/`warn`/`error`） |
| `backend` | `None` | `hardware`/`bitbang` を明示指定 |
| `bb_sda_bcm` / `bb_scl_bcm` | なし | `bitbang` 用の BCM ピン |

### **測定制御**

- **start(distance_mode=2, timing_budget_ms=50)**  
  **L1X のみ有効**：距離モード（0/1/2=SHORT/MEDIUM/LONG）とタイミングバジェット（約 20–1000ms）を設定して測定開始。  
  **L0X は start 不要**。
- **read_mm() → int\|None**  
  成功時：**mm 単位の整数**を返す。  
  ドライバ実装により **cm(float)** が返る場合は **自動で mm に正規化**。  
  センサ未準備・読み取り失敗時は `None`。
- **stop()**  
  **L1X のみ**停止処理（`stop_ranging`）。L0X は不要。

> **時系列動作（概要）**

1. **初期化**：指定/自動検出に基づき L1X/L0X のドライバ初期化を試行。成功した機種で待機。  
2. **開始**：L1X の場合は距離モード/バジェットを設定して測定開始（L0X は不要）。  
3. **取得**：読み取りごとにドライバ値を確認し、**必要なら cm→mm 正規化**して返却。異常時は `None`。  
4. **停止**：L1X の測定を停止し、後処理を実施。例外はワーニングとして記録。

### **推奨設定の目安**

- **反応速度重視**：`distance_mode=0 (SHORT)`, `timing_budget_ms=20–33`  
- **屋内・標準**：`distance_mode=2 (LONG)`, `timing_budget_ms=50–100`  
- **ノイズが気になる**：ポーリング間隔を適度に延ばし、アプリ側で移動平均/中央値フィルタを併用

### **返却値と正規化**

- L1X：`mm`（`None` あり）  
- L0X：`mm`（整数）  
- 一部ドライバが **`cm` の `float`** を返すケースを考慮し、**`val < 100.0` を cm とみなし `×10` 変換**。  
- 非正値・非数・例外時は **`None`**。

### **エラーハンドリングとロギング**

- 初期化失敗時：試行機種ごとに **`warn` ログ**を出力し、両方失敗なら **無効化**。  
- `start/read/stop` の例外は **`error`/`warn` ログ**で通知し、処理は継続可能な範囲でフェイルセーフ。

### **運用上の注意**

- **I²C 競合**：他デバイスとバス共有時はタイミングバジェット/ポーリング周期を調整。  
- **筐体干渉**：スモークアクリル使用時は透過率で測距が不安定になる場合あり（赤外域透過の材質/厚みを選定）。  
- **環境光**：強い赤外光環境では SHORT/MEDIUM でドロップが出ることがあるため LONG＋広めのバジェットを検討。  
- **bitbang**：CPU 負荷上昇やジッタが起きうるため、本番は可能なら `hardware` を推奨。

### **参考 ENV 一覧**

| ENV | 既定 | 用途 |
|---|---|---|
| `TOF_I2C_BACKEND` | `hardware` | バックエンド選択（`hardware`/`bitbang`） |
| `TOF_BB_SDA` / `TOF_BB_SCL` | `17` / `27` | `bitbang` 用 BCM ピン指定 |

---

## **`aws_iot_pub.py` — AWS IoT へのイベント送信（MQTT/TLS, Paho）**

- 端末から **AWS IoT Core** へ安全に MQTT パブリッシュするパブリッシャ。
- **デバイス既定フィールドの自動付与**（`event`/`deviceId`/`title`/`body`/`event_id`/`ts`）と、
  **Adalo 連携の簡易インライン添付（任意）**に対応。
- ボタン・在席などの**イベント種別**をトピックに分離（例：`button` / `presence`）。

### **必要な環境変数（`/etc/signage/events.env` 由来）**

| ENV | 用途 |
|---|---|
| `AWS_IOT_ENDPOINT` | IoT データエンドポイント（例：`xxxx-ats.iot.ap-northeast-1.amazonaws.com`） |
| `EVENTS_THING_NAME` | 接続時の **client_id** 兼 Thing 名 |
| `EVENTS_CERT_PATH` | デバイス証明書 `cert.pem` |
| `EVENTS_KEY_PATH` | デバイス秘密鍵 `private.key` |
| `EVENTS_CA_PATH` | ルート CA `AmazonRootCA1.pem` |

> いずれか未設定なら起動時にエラーで停止します。

### **通信と接続**

- **MQTT v3.1.1**, **ポート 8883**, **TLS 1.2**, **証明書認証**。
- **client_id = EVENTS_THING_NAME**（Thing 名と一致させる前提）。
- 接続確立を最大 **10 秒**待機。未接続ならタイムアウト。

### **トピック設計**

- 送信先：`xignage/v1/devices/<thing>/events/<kind>`
  `<kind>` は `button` / `presence` などの**イベント種別**。
- QoS 既定：**1**（到達保証・重複可）。必要に応じて変更可能。

### **ペイロード仕様（JSON）**

- **必須**：特になし（クライアント側で不足分を自動補完）
- **自動付与（未指定時に埋める）**  
| フィールド | 説明 |
|---|---|
| `event` | イベント種別（引数 `kind` を反映） |
| `deviceId` | `EVENTS_THING_NAME` |
| `title` / `body` | 既定文言（ENV `ADALO_NOTIFY_TITLE` / `ADALO_NOTIFY_BODY` で上書き可） |
| `event_id` | **UUID v4**（冪等性/重複排除向け） |
| `ts` | 端末時刻の **epoch 秒（int）** |

- **任意（Adalo 連携のインライン設定）**  
  `ADALO_ENABLE_INLINE_ADALO=1` かつ `ADALO_NOTIFY_EMAIL` が設定され、かつペイロードに `adalo` が無い場合、  
    `adalo: { email, title, body }` を**自動付与**。  
  既存のサーバー側（Lambda）連携と競合しないよう、**フラグ無指定時は付与しない**保守的動作。

### **冪等性・再送**

- `event_id` をデフォルト付与（サーバー側での**重複検出**に利用可能）。
- QoS1 によりブローカーへの到達は原則保証されるが、**重複配送**の可能性あり（サーバー側で `event_id` 去重を推奨）。
- パブリッシュは**1 回ごとに完了待ち**（既定 **10 秒**）。未完了でタイムアウト。

### **エラーハンドリング（要点）**

- **起動時**：必須 ENV 欠如 → 例外で停止。接続タイムアウト → 停止。
- **送信時**：完了待ちタイムアウト → 例外。例外時は上位でリトライ戦略を検討。

### **セキュリティ**

- `cert.pem` / `private.key` / `AmazonRootCA1.pem` は **厳格パーミッション**で保管（端末側で `0600`/`0644` 運用）。  
- **Thing 名と証明書の対応**が正しく、ポリシーが最小権限であることを確認。  
- 通信は **TLS 1.2** 強制・**CA 検証有効**。

> **時系列動作（概要）**

1. **起動**：ENV を検証し、証明書付き TLS 設定で MQTT クライアントを構築。  
2. **接続**：ブローカーへ接続し、**最大 10 秒**の接続完了待ち。未達ならエラー終了。  
3. **送信**：イベント種別ごとのトピックへ JSON を QoS1 で publish。完了通知を待機。  
4. **終了**：ループ停止 → 切断。必要に応じて上位で再接続/再試行を実装。

### **運用時の注意**

- **時刻同期**：`ts` の信頼性確保のため、端末の NTP 同期を推奨。  
- **タイトル/本文の既定**：端末側 ENV で上書き可能。運用ポリシーに合わせて管理。  
- **Adalo 併用**：サーバー側でメッセージ整形する場合は `ADALO_ENABLE_INLINE_ADALO` を未設定（既定）にして**二重付与を防止**。  
- **監視**：接続/切断/Publish の基本ログを有効化すると調査が容易（デバッグ時のみ推奨）。

### **代表 ENV（通知テキスト）**

| ENV | 既定 | 説明 |
|---|---|---|
| `ADALO_NOTIFY_TITLE` | `"Xignage button"` | 通知タイトルの既定 |
| `ADALO_NOTIFY_BODY` | `"Button pressed"` | 通知本文の既定 |
| `ADALO_ENABLE_INLINE_ADALO` | 未設定 | `1` で端末側が `adalo` を自動付与 |
| `ADALO_NOTIFY_EMAIL` | 未設定 | 端末側で直接通知先メールを指定（上記フラグが必要） |
