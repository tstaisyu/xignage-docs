# メトリクス送信サービス — `metrics/index.js`

## **概要**

`xignage-metrics.service` から実行される **Node.js パッケージ**。  
ハードウェア依存のボード別モジュール（`boards/*.js`）で取得した温度/電圧/スロットル等のメトリクスを、**AWS IoT Core (MQTTS)** に **30 秒間隔**で Publish します。

- **トピック**：`xignage/metrics/<device>`（`--device` 引数で指定）
- **ボード検出**：`BOARD_TYPE`（環境変数）があれば優先、なければ **Pi → Jetson → generic** の順で自動判定
- **TLS**：デバイス証明書 / 秘密鍵 / ルート CA 必須（`IOT_*` 環境変数）

## **送信ペイロード（スキーマ）**

```bash
{
  "ts":        1730000000000,      // epoch ms
  "temp_c":    42.3,               // ℃（なければ省略）
  "power_mw":  5100,               // mW（任意, あれば）
  "volts_v":   5.02,               // V（なければ省略）
  "throttled": "0x0",              // 文字列（なければ省略）
  "boot_count": 3,                 // ブート回数（/var/lib/xignage-metrics/boot_state.json）
  "boot_ts":   1729999000000,      // 起動推定時刻（ms）
  "uptime_s":  120,                // OS稼働秒
  "board":     "jetson"            // "pi" | "jetson" | "generic"
}
```

- **publish**：`mqtts://IOT_ENDPOINT` / QoS=0 / `rejectUnauthorized: true`

## **内部処理の流れ**

1) **IOT_* の検証**  
   `IOT_ENDPOINT / IOT_CERT_PATH / IOT_KEY_PATH / IOT_CA_PATH` が未設定なら即時終了（非 0）。

2) **ボード決定**  
   `BOARD_TYPE`（環境変数）を正規化して優先使用。未設定時は `detectBoard()` により **Pi → Jetson → generic** の順で自動判定。

3) **ボードモジュール読込**  
   `boards/<board>.js` を `require()`。失敗時は `boards/generic.js` へフォールバック。

4) **ブート回数の記録**  
   `/proc/sys/kernel/random/boot_id` と `/var/lib/xignage-metrics/boot_state.json` を用いて  
   `boot_count` を更新・保存（ディレクトリは必要に応じて自動作成）。

5) **MQTTS 接続**  
   `mqtts://IOT_ENDPOINT` にクライアント証明書・秘密鍵・CA を指定して接続（`rejectUnauthorized: true`）。

6) **30 秒ごとの Publish**  
   `boards/*` で取得した `temp / power / volts / throttle` を収集。  
   取得できた項目のみを含む JSON（`ts, boot_count, boot_ts, uptime_s, board` など）を  
   `xignage/metrics/<device>` へ QoS 0 で Publish。

## **ボード別モジュール（boards/*.js）**

> 各ボードモジュールは次の関数を **同期関数** としてエクスポートします。取得不能時は **`null`** を返してください。

```js
readTemp()     // => ℃ number | null
readVoltage()  // => Volt number | null
readPower()    // => mW number | null   ※任意（generic/pi は未実装なら null）
readThrottle() // => string | null      例: "0x0" / "under-voltage"
```

### **実装一覧と取得元**

| ファイル         | temp(℃)                                        | volts(V)                                     | power(mW)                                            | throttle                    | 備考                                   |
| ------------ | ---------------------------------------------- | -------------------------------------------- | ---------------------------------------------------- | --------------------------- | ------------------------------------ |
| `generic.js` | 常に `null`                                      | 常に `null`                                    | 常に `null`                                            | 常に `null`                   | 自動検出失敗時のフォールバック                      |
| `pi.js`      | `vcgencmd measure_temp` → `/temp=([\d.]+)/`    | `vcgencmd measure_volts` → `/volt=([\d.]+)/` | （未実装: `null`）                                        | `vcgencmd get_throttled` の値 | `libraspberrypi-bin` に `vcgencmd`    |
| `jetson.js`  | `/sys/class/thermal/thermal_zone0/temp`（/1000） | （未実装: `null`）                                | `/usr/bin/tegrastats` 1行目の `VDD_IN` を `grep -oP` で抽出 | （未実装: `null`）               | JetPack 6.x 想定。`spawnSync` 2s タイムアウト |

!!! note "パフォーマンスと負荷"
    - **呼び出し間隔**：`index.js` は既定で **30 秒周期**。各 `boards/*.js` の処理は **≤ 1–2 秒** を目安に抑える。
    - **Jetson**：`tegrastats` は **1行だけ取得**（`head -n 1`）し、`spawnSync` に **2s タイムアウト**を設定してハング回避。
    - **Pi**：`vcgencmd` 系は高負荷時に遅くなることがある。取得失敗は **`null` を返す**方針で上位が吸収。
    - **sysfs 優先**：可能な項目は `/sys` から直接読む（低オーバーヘッド）。外部コマンドの多重実行は避ける。
    - **最小ペイロード**：取得できない値は送らない（`null` はフィルタされる）ことで帯域と処理量を最小化。

### **拡張（新規ボード追加手順）**

1) **モジュール作成**  
   `metrics/boards/<name>.js` を追加し、同期関数 `readTemp` / `readVoltage` / `readPower`（任意）/ `readThrottle`（任意）を実装。取得不能時は **null** を返す方針で統一。

2) **取得元ポリシー**  
   可能な限り **sysfs（/sys）優先**。やむを得ず外部コマンドを使う場合は実行時間を抑え、出力は堅牢にパース（数値化不能は null）。

3) **実行時間と安定性**  
   1 回の取得は **1–2 秒以内** を目安。ハングの恐れがある処理にはタイムアウトを付与。重いパイプラインや多重実行は避ける。

4) **検出ロジックの拡張**  
   `BOARD_TYPE` の正規化に `<name>` を追加し、必要に応じて自動検出（`detectBoard`）へ識別ロジックを追加。誤検出時は **generic** へフォールバック可能であることを確認。

5) **ロギング/エラーハンドリング**  
   取得失敗は警告レベルで最小限のログに留め、上位での再試行を阻害しない。恒常的に取得できない場合でもサービスは継続（null を返す）。

6) **ドキュメント更新**  
   メトリクス項目（取得可否・出典・制約）を **ボード別表** に追記。運用上の注意（権限・パス・依存パッケージ）も併記。

### **トラブルシュート（boards）**

- **Pi で値が取れない**  
  `vcgencmd` が未導入/パス外の可能性。必要パッケージ導入と PATH を確認。取得に失敗しても null を返し続行できることを確認。

- **Jetson で電力が取得できない**  
  `tegrastats` が未導入/パス不一致/権限不足。JetPack 標準パスの確認、実行に時間がかかる場合はタイムアウト設定を見直す。

- **sysfs 読み取りが Permission denied**  
  実行ユーザーの権限、コンテナ隔離、セキュリティ設定を確認。権限変更が難しい場合は該当項目は null 運用に切り替える。

- **数値パースの失敗（NaN になる）**  
  出力フォーマット変更・ロケール影響の可能性。パース条件を緩和し、ロケール非依存の解析に見直す。解析不能は null で処理。

- **取得が重く、Publish が詰まる**  
  外部コマンドの回数削減、最小行のみの抽出、間隔（30 秒）の緩和を検討。処理時間の上限を超える場合は値をスキップして継続。

- **ボード誤検出**  
  `BOARD_TYPE` を明示設定して挙動を固定。自動検出ロジックの条件を見直し、generic フォールバックが機能しているか確認。

- **値は出ているが可観測側で反映されない**  
  トピック名のミスマッチ、ポリシーの権限不足、または上位で null 項目がフィルタされている可能性。観測側の購読トピックと権限を再確認。

## **注意・セキュリティ**

!!! warning "証明書・鍵のパーミッション"
    `private.key` は **600**（所有者のみ読み書き）を厳守。  
    サービス実行ユーザーが **読み取り可能**、第三者が **不可** であることを確認してください。  
    `cert.pem` / `AmazonRootCA1.pem` も最小権限で運用してください。

!!! note "状態ファイルの書き込み権限"
    `boot_state.json` を格納する **`/var/lib/xignage-metrics/`** は、  
    サービス実行ユーザーが書き込み可能である必要があります。例：
    ```bash
    sudo install -d -o ubuntu -g ubuntu /var/lib/xignage-metrics
    ```

## **トラブルシュート**

- **`ERROR: IOT_* Missing environment variables`**  
  → `EnvironmentFile=/etc/signage/secret.env` などで `IOT_*` が設定されているか確認。

- **`MQTT error ... self signed certificate` / `unable to verify the first certificate`**  
  → `IOT_CA_PATH` が誤り/未配置。**AmazonRootCA1.pem** を正しいパスで指定する。

- **`EACCES: permission denied, open '/var/lib/xignage-metrics/boot_state.json'`**  
  → ディレクトリ権限不足。上記の `install -d ...` で所有者/権限を調整。

- **ボード検出が想定と異なる**  
  → `BOARD_TYPE=jetson` あるいは `BOARD_TYPE=pi` を明示。起動ログの  
  `[metrics] BOARD_TYPE env='…' → boardName='…'` を確認。

- **Publish は成功しているが受信できない**  
  → サブスクライブトピックが `xignage/metrics/<device>` と一致しているか、  
  IoT ポリシーが当該トピックの Publish/Subscribe を許可しているか確認。

- **`ENOTFOUND` / `ECONNREFUSED`（接続不可）**  
  → `IOT_ENDPOINT` が誤り/名前解決不可/ポート閉塞。  
  `aws iot describe-endpoint --endpoint-type iot:Data-ATS` で値を再取得し、  
  `openssl s_client -connect "${IOT_ENDPOINT}:8883" -CAfile "$IOT_CA_PATH"` で疎通確認。
