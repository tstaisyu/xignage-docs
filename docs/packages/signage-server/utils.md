# ユーティリティ

`utils/` 配下のユーティリティ群の仕様をまとめています。各項目は「概要 / 前提・引数・戻り値 / ファイル内の関数について、処理の流れなど / メモや注意」で構成しています。  

> 対象ファイル  

- `jetsonUtils.js` … Jetson 向け `tegrastats` 存在確認／短時間収集
- `raspiUtils.js` … RPi 向け温度・GPU クロック取得（`vcgencmd`）
- `patchManager.js` … 直近適用パッチの 14 桁時刻を抽出
- `migrationManager.js` … 最大適用 ID + 未適用 ID を合成
- `stateAggregator.js` … パッチ状態とマイグ状態の統合表示
- `logger.js` … 共通ロガーのプレースホルダ（現状空）

> 共通実装上の注意点

- **同期実行**：いずれも Node.js の `execSync` 等を使うため**ブロッキング**します。UI スレッドで長時間の呼び出しは避けてください。

- **例外**：外部コマンド未導入や実行失敗時は**例外を投げる**前提です。必ず `try/catch` でラップしてください。

- **権限**：基本は一般ユーザで動作しますが、環境によってはコマンドに追加権限が必要な場合があります。

## **jetsonUtils.js**

Jetson デバイス向けのハードウェアメトリクス取得補助。
`tegrastats` の存在確認と、短時間の `tegrastats` 実行結果（標準出力）を取得します。

### **checkTegrastatsInstalled()**

- 引数: なし  
- 戻り値: `true`（成功時）  
- 例外: `tegrastats` が見つからない場合など  

> 処理の流れ  

1) `which tegrastats` を `execSync` で実行（標準出力は捨てる）  
2) 成功すれば `true` を返す（失敗時は例外）

### **runTegrastats()**

- 引数: なし
- 戻り値: `string`（標準出力）
- 例外: コマンド失敗時

> 処理の流れ

1) `timeout 1s tegrastats --interval 100` を `execSync` で実行（エンコーディング UTF-8）
2) 実行結果の標準出力文字列を返す

!!! note
    - `execSync` はブロッキング。頻回ポーリング時は呼び出し間隔を調整すること。
    - `tegrastats` 未導入環境では必ず例外になるため、上位で try/catch を推奨。

---

## **raspiUtils.js**

Raspberry Pi デバイス向けの計測ユーティリティ。`vcgencmd` により温度と GPU クロック周波数を取得します。

### **checkVcgencmdInstalled()**

- 引数: なし  
- 戻り値: `true`（成功時）  
- 例外: `vcgencmd` が見つからない場合など

> 処理の流れ  

1) `which vcgencmd` を `execSync` で実行（標準出力は捨てる）  
2) 成功すれば `true` を返す（失敗時は例外）

### **measureTemp()**

- 引数: なし  
- 戻り値: `string`（例: `temp=48.8'C`）  
- 例外: コマンド失敗時

> 処理の流れ  

1) `vcgencmd measure_temp` を `execSync` で実行（UTF-8 文字列を返す）

### **measureClockV3d()**

- 引数: なし  
- 戻り値: `string`（例: `frequency(3)=500000000`）  
- 例外: コマンド失敗時

> 処理の流れ  

1) `vcgencmd measure_clock v3d` を `execSync` で実行（UTF-8 文字列を返す）

!!! note
    - `execSync` はブロッキング。監視ループに組み込む際は呼び出し周期やタイムアウトに注意。
    - ディストリビューションにより実行権限（例: `video` グループ所属）が必要な場合あり。

---

## **patchManager.js**

最後に適用されたパッチの「日時識別子（14桁）」を取得します。  
`patches_applied.txt` の**先頭行**にあるファイル名から `YYYYMMDD_hhmmss` を抽出し、`YYYYMMDDhhmmss` を返します。

### **getPatchState(appliedFilePath)**

- 引数: `string`（適用済み記録ファイルのパス）  
- 戻り値: `string`（例: `20250801192830`）／パターン不一致・ファイル無の場合は空文字 `''`  
- 例外: 読み取り不可など `fs.readFileSync` 由来の例外

> 処理の流れ  

1) `fs.existsSync(appliedFilePath)` が偽なら `''` を返す  
2) 先頭行を `trim()` し、正規表現 `/^(\d{8})_(\d{6})/` にマッチ  
3) マッチしたら `YYYYMMDD + hhmmss` を連結して返す  
4) マッチしなければ `''` を返す

!!! note
    - ファイル命名の**先頭**を `YYYYMMDD_hhmmss_...` とすること（抽出は先頭 14 桁を前提）。
    - 行末空白等の影響を避けるため `trim()` 前提の実装。

---

## **migrationManager.js**

マイグレーションの合成状態文字列を生成します。  
`migrations/*.sh`（全候補）と `*.done`（適用済）を突き合わせ、**最大適用 ID（3桁）** と **未適用 ID（昇順）** をハイフン結合で返します（例: `030-020-040`）。

### **getMigrationState(migrationDir, doneDir)**

- 引数:  
  `migrationDir: string`（例: `/opt/signage-core/migrations`）  
  `doneDir: string`（例: `/var/lib/signage-migrations`）  
- 戻り値: `string`（例: `030-020-040`。適用が無ければ未適用のみ）  
- 例外: ディレクトリ不存在・読み取り不可など `fs.readdirSync` 由来の例外

> 処理の流れ  

1) `migrationDir` から `.sh` を列挙し、ファイル名の先頭トークン `split('_')[0]` を 3桁 ID として `allIds` に格納  
2) `doneDir` から `.done` を列挙し、同様に 3桁 ID を `appliedIds` に格納  
3) `appliedIds` が非空なら数値比較で最大値を取り `maxApplied` に設定（空なら `''`）  
4) `missing = allIds` から `appliedIds` を除外し、数値昇順でソート  
5) `parts = []` に `maxApplied`（存在時）→ `missing` の順で詰め、`parts.join('-')` を返す

!!! note
    - ID は**3桁ゼロ埋め**（`001, 002, ... 010, 020`）を前提に数値比較・ソート。
    - `split('_')[0]` 依存のためファイル命名は `NNN_name.ext` 形式に統一すること。

---

## **stateAggregator.js**

**パッチ状態**（14桁時刻）と **マイグレーション状態**（最大適用 + 未適用リスト）を結合し、統合状態文字列を返します。  
空要素のハイフン重複が発生しないように連結します。

### **getCombinedState({ patchFile, migrationDir, doneDir } = {})**

- 引数:  
  `patchFile?: string` — `patchManager.getPatchState` に渡すファイルパス  
  `migrationDir?: string` — マイグレーション `.sh` のディレクトリ  
  `doneDir?: string` — `.done` マーカーのディレクトリ  
- 戻り値:  
  両方非空: `"<patchState>-<migrationState>"`  
  一方のみ非空: 非空側のみ  
  両方空: `''` の可能性  
- 例外: 参照先ユーティリティが投げる例外の波及

> 処理の流れ

1) `patchFile` があれば `path.resolve` して `getPatchState()` を呼び、`patchState` を取得  
2) `migrationDir` と `doneDir` があれば `path.resolve` の上 `getMigrationState()` を呼び、`migrationState` を取得  
3) 空判定に応じて  
   - `patchState` のみ → それを返す  
   - `migrationState` のみ → それを返す  
   - 両方あり → `\`${patchState}-${migrationState}\`` を返す

!!! note
    - 状態表記は **「最新パッチ」→「未適用マイグ（昇順）」** の順で視認性を重視。

---

## **logger.js**

共通ロガー実装の**プレースホルダ**（現在は空ファイル）。

### **備考**

- 将来的にアプリ全体のログ形式を統一する際、本ファイルへ薄いラッパを実装して段階的に置換する方針を推奨。
