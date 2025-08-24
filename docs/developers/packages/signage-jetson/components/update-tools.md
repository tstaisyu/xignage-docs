# アップデートツール ( update_manager / update_runner / update.sh / healthcheck )

これらのスクリプトは、端末のキオスク動作を安全に保ちながら **OTA 更新を段階実行**するツール群。  
サービス停止 → 更新実行 → 検証 → 切替 → 復帰を一連で行い、**ヘルスチェックとロールバック**で可用性を担保。Jetson では **edge-detection** 配布にも対応。

## **関連スクリプト**

- `update_manager` … `signage-update.service` から起動。GUI停止→`/tmp/UPDATING`→`update_runner` 実行→`/tmp/update_done` 待機→**再起動**。ログは `/var/log/update_manager/`（30日ローテート）。
- `update_runner` … **NTP 同期確認**→パッチ適用→`signage-jetson` TAR 展開・マイグレーション・ヘルスチェック→世代保持→`/tmp/update_done` シグナル、必要ファイルの配備まで実施。
- `update.sh` … アプリ単体のアップデータ。`signage-server`/`signage-admin-ui` を Releases から取得し **staging→current 切替**、ヘルスチェック失敗時は**即ロールバック**。Jetson では `xignage-edge-detection` も更新。
- `healthcheck` … リポジトリ自己点検。必須ファイル有無と **トップレベルの bash/python 構文チェック**（`PYTHONPYCACHEPREFIX=/tmp/pycache` で `__pycache__` 汚染防止）。OK で 0 返却。

### **update_manager**

このスクリプトは、システムサービス `signage-update.service` から実行されます。
端末のキオスク（`openbox`/`chromium`）を停止し、**更新本体**である `update_runner` を実行。  
実行中は `/tmp/UPDATING` フラグで GUI の再起動を抑止し、`/tmp/update_done` の出現を待ってから **再起動**します。  
実行ログは `/var/log/update_manager/` に保存し、**30 日以上前のログは自動削除**します。

> 処理の流れ

1) **ログ準備**：`/var/log/update_manager` 作成、**30 日超ログを削除**（バックグラウンド）。  

2) **出力二重化**：`exec > >(tee -a "$LOGFILE") 2>&1` で **ログ＋コンソール**へ出力。  

3) **キオスク停止**：`killall chrome` / `killall openbox`（存在しなければ無視）。  

4) **更新フラグ**：`/tmp/UPDATING` を作成（GUI 再起動抑止）。  

5) **古い完了フラグ掃除**：`/tmp/update_done` を削除。  

6) **ランナー実行**：`bash "$UPDATE_RUNNER_DEST"` を起動し **終了コード取得**。  

7) **完了待ち**：最大 `UPDATE_MAX_WAIT` 秒、`/tmp/update_done` の生成を待機。  

8) **結果判定**：存在→**completed**、無→**incompleted** をログ記録。  

9) **後片付け**：`/tmp/UPDATING` を削除。  

10) **再起動**：2 秒待機後に `sudo reboot`。

!!! warning "再起動に注意"
    本スクリプト末尾で **必ず再起動** します。リモート作業中は接続断に留意してください。  
    検証時は一時的に `sudo reboot` をコメントアウトして動作確認するのが安全です。

!!! tip "GUI 側とのハンドシェイク"
    `.xinitrc` は `/tmp/UPDATING` の存在中 **Chromium を起動しません**。  
    これにより更新中の UI 介入やファイル使用中エラーを防ぎます。

!!! note "プロセス名の差異"
    Chromium のプロセス名は環境で `chrome` / `chromium` / `chromium-browser` などと異なります。  
    必要に応じて `killall` の対象を **追加**してください（`|| true` で未存在時は無視）。

---

### **update_runner**

このスクリプトは、`update_manager` から呼ばれる **更新本体**です。  

1) **NTP 同期**が取れていない場合は更新を **スキップ**、2) 先行して **パッチ群（zip）** を適用、3) `signage-jetson` の **TAR リリース**をステージング→ヘルスチェック→**current 切替**→後処理、という流れで実行します。  
ログは `/var/log/update_runner/update_runner_*.log` に出力し、**30 日超**のログは自動削除します。

> 処理の流れ

1) **ログ初期化**：`LOGDIR` 作成（0755）→ 30 日超の `update_runner*.log` を削除 → 以降の出力を `UPDATE_RUNNER_LOG` に追記。  

2) **ヘルパー読込**：実行パスを解決し、`scripts/lib/functions.sh`（見つからなければ `/opt/.../scripts/lib/functions.sh`）を `source`。  

3) **Wi-Fi 設定確認**：`FLAG_FILE` が無ければ **更新スキップで終了**。  

4) **NTP 同期待機**：`timedatectl set-ntp true`、`NTPSynchronized=yes` まで待機（10 秒ごとに `systemd-timesyncd` を再起動キック）。未同期なら **スキップで終了**。  

5) **パッチ適用**：GitHub Releases の `patches_all.zip` を取得→展開し、`PATCH_MARK` より新しい `*.sh` を昇順実行（成功ごとに `PATCH_MARK` 更新）。  

6) **TAR OTA**：  
   - 最新リリースの TAR/SHA を取得→**SHA256 検証**→`releases/<timestamp>` に展開→所有者調整。  
   - **マイグレーション**実行（`*.sh`；`0=OK`, `11=skip`, それ以外は失敗）。  
   - （任意）**事前ヘルスチェック**→`current` を **新ステージングへ切替**。  
   - **xignage-metrics 同期**（`rsync`＋`npm ci`、稼働中なら再起動）。  
   - **事後ヘルスチェック**。失敗時は **ロールバック**（`current` を旧に戻し、ステージング破棄）。  
   - 古いリリースを **保持数超過分のみ削除**。  

7) **`update.sh` 実行**：新 `current/update.sh` があれば実行（無ければスキップ）。  

8) **Web 配置**：`static/index.html` を `WEB_TEMPLATES_DIR` へ、`web/wifi_manager.py` を `WEB_ROOT/web` へコピー。  

9) **完了シグナル**：`/tmp/update_done` を `touch`（`update_manager` が検出して再起動へ）。

!!! warning "NTP 未同期時はスキップ"
    時刻ずれは **TLS/検証失敗や署名チェック不一致**の原因になるため、  
    **NTP 同期が取れない場合は更新を実行せずスキップ**します（`exit 0`）。

!!! note "ログの出力先"
    `update_manager` と異なり、本スクリプトは **ログファイルのみ** に出力します（`tee` は未使用）。  
    進捗は `/var/log/update_runner/update_runner_*.log` を参照してください。

---

### **update.sh**

このスクリプトは、キオスク端末の**アプリ（signage-server）本体**と**管理UI（signage-admin-ui）**、および **xignage-edge-detection（Jetson のみ）** を GitHub Releases から取得し、**段階的に展開・検証・切替**するアップデータ。`functions.sh` の `download_with_retry` を用いて API/asset ダウンロードを堅牢化し、**タイムスタンプごとの staging ディレクトリ**を作成 → **シンボリックリンク切替** → **ヘルスチェック** → 必要に応じて**ロールバック**を行う。

> 処理の流れ

1) **ロギング初期化**  
   `LOGDIR` 作成（0755）、`update_debug_*.log` / `update_*.log` 生成。`find` で **30日超ログ自動削除**。以降の出力は DEBUG_LOG へ、要点は UPDATE_SCRIPT_LOG にも追記。

2) **ヘルパ読込**  
   `functions.sh` を既定→フォールバック順で探索・`source`（未発見なら即エラー）。

3) **機密読込**  
   `/etc/signage/secret.env` を `source`（**GH_TOKEN 必須**）。無ければ終了。

4) **設定読込**  
   `scripts/lib/config.sh` を `source`。ディレクトリ、URL、サービス名などを取得。

5) **Jetson 判定**  
   `BOARD_TYPE` に *jetson* を含むか判定し、edge-detection 更新を **有効/無効** 切替。

6) **必須変数検証**  
   `UPDATE_SCRIPT_LOG`, `NODE_APP_DIR` 未定義ならエラー終了。

7) **signage-server 更新（TAR + healthcheck）**  
   Releases から `signage-server.tar.gz`/`.sha256` を取得→**SHA256 検証**→`NODE_APP_DIR/releases/<TS>/` に展開→所有権調整→`npm ci --omit=dev --ignore-scripts`→`current` を staging に**切替**→`http://127.0.0.1:3000/health` を **最大20秒/2秒間隔** で確認し **200** で成功。失敗時は `OLD_DIR` に **即ロールバック**。古いリリースは `KEEP_RELEASES` 超過分を削除。

8) **signage-admin-ui 更新（バックアップあり）**  
   `admin-ui.tar.gz`/`.sha256` を取得・検証→既存 `ADMIN_UI_DIR` を `ADMIN_UI_BACKUP_DIR` に退避→新 UI 展開→所有権調整。失敗時は **即ロールバック**。

9) **xignage-edge-detection 更新（Jetson のみ）**  
   `xignage-edge-detection.tar.gz`/`.sha256` を取得・検証→`SIGNAGE_CORE_DIR/xignage-edge-detection/releases/<TS>/` に展開→`current` を**切替**→旧世代整理→必要に応じて `rsync -a --delete "$METRICS_SRC/" "$METRICS_DST/"` と `npm ci --omit=dev --prefix "$METRICS_DST"` を実行→関連 unit の停止/再起動（構成に合わせて調整）。

10) **終了ログ**  
    `"Update finished successfully."` を記録して終了。

!!! warning "edge-detection セクションはメトリクス混在あり"
    `update_edge_detection()` 内で **`xignage-metrics.service` の停止** や  
    **`METRICS_SRC` → `METRICS_DST` の rsync**、`npm ci` を実行します。  
    実運用に合わせて **unit 名・パス** を必ず見直してください。不要な場合は該当行を**コメントアウト**してください。

!!! tip "ロールバック戦略"
    - **server**：healthcheck 失敗時は `current` を **即座に `OLD_DIR` へ戻す**（切替前に必ず旧パス保持）。  
    - **admin-ui**：**バックアップ → 新展開 → 成功でバックアップ削除**。展開失敗時は **即バックアップへ復帰**。  
    - **edge**：`releases/` を世代管理し `current` を切替。問題発生時は **`current` を旧世代に戻すだけ**で復旧可能。

---

### **healthcheck**

このスクリプトは、リポジトリの**自己点検**を行う。必要ファイル・ディレクトリの存在検証、トップレベルの **Bash 構文チェック** と **Python 構文チェック**（`py_compile`）を実施し、問題がなければ `0` で終了します。  
スクリプト自身の位置から **2 階層上をリポジトリルート**（`TARGET_DIR`）として扱います。

> 処理の流れ

1) **ルート決定**  
   スクリプト自身（`$0`）の絶対パスから `SCRIPT_DIR` を計算し、2 階層上の `ROOT_DIR` を **リポジトリルート（`TARGET_DIR`）** として扱います。

2) **必須ファイル群の存在検証**  
   `nullglob` を有効化し、次のパターンで 1 件もマッチしなければ **即エラー終了**：  
   `update.sh`, `scripts/bin/*`, `scripts/lib/*.sh`, `scripts/**/*.py`, `web/wifi_manager.py`, `setup_all.sh`

3) **Bash 構文チェック（トップレベル）**  
   `find "$TARGET_DIR" -maxdepth 1 -name "*.sh"` で列挙し、各ファイルに `bash -n` を実行。NG なら **即終了**。

4) **Python 構文チェック（トップレベル）**  
   構文チェック前に  
   `export PYTHONPYCACHEPREFIX=/tmp/pycache` を設定。  
   これにより `py_compile` が生成する `__pycache__` を **/tmp 以下へ退避**し、  
   - リポジトリの**汚染防止**（未追跡ファイル増加の回避）  
   - **権限差分**や **読み取り専用領域**でのエラー回避  
   - CI 実行環境間の **キャッシュ衝突防止**  
   の効果が得られます。  
   その後 `find "$TARGET_DIR" -maxdepth 1 -name "*.py"` を `python3 -m py_compile` にかけ、NG なら **即終了**。

5) **成功終了**  
   すべて通過で `[HC] all checks passed` を出力し **0** で終了。

!!! warning "チェック範囲は **トップレベルのみ**"
    `find -maxdepth 1` を使用しているため、**サブディレクトリ配下の `.sh` / `.py` は検査対象外**です。  
    再帰的な検査が必要な場合は `-maxdepth` を拡張するか、別途再帰走査を実装してください。

!!! warning "`scripts/**/*.py` は **非再帰**（globstar 未使用）"
    現行実装では `shopt -s globstar` を有効化していないため、`**` は**再帰展開されません**。  
    `scripts/` 配下のサブディレクトリにある `.py` の存在確認が抜ける可能性があります。  
    必要であれば **`shopt -s globstar` を有効化**するか、`find` に置き換えてください。

!!! note "サブシェル内 `exit` の伝播"
    `find ... -print0 | while ...; do ... exit 1; done` のように **パイプラインで `while` を実行するとサブシェル**になり、  
    `exit 1` が**親シェルに伝播しない**ことがあります。確実な失敗伝播が必要なら **プロセス置換** `（while ...; do ...; done < <(find ...)）` や **累積リターンコード** の採用を検討してください。
