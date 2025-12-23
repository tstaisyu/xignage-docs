# アップデートツール ( update_manager / update_runner / update.sh / healthcheck )

端末のキオスク動作を安全に保ちながら **OTA 更新を段階実行**するツール群。  
サービス停止 → 更新実行 → 検証 → 切替 → 復帰を一連で行い、**ヘルスチェックとロールバック**で可用性を担保します。

## **関連スクリプト**

- `update_manager` … `signage-update.service` から起動。GUI停止→`/tmp/UPDATING`→`update_runner` 実行→`/tmp/update_done` 待機→**再起動**。
- `update_runner` … **NTP 同期確認**→パッチ適用→`signage-jetson` TAR 展開・マイグレーション・切替→metrics 同期→`update.sh` 実行→完了フラグ。
- `update.sh` … `signage-server` 更新（TAR + healthcheck）＋ **Jetson の `xignage-edge-detection` 更新**。
- `healthcheck` … 必須ファイル存在と **トップレベルの bash/python 構文チェック**。

---

## **update_manager**

- `/tmp/UPDATING` を作成して GUI 再起動を抑止
- `update_runner` を実行し、`/tmp/update_done` を待機
- 終了後に **再起動**

ログ: `/var/log/update_manager/update_manager_*.log`（30 日超は自動削除）

---

## **update_runner**

1) **Wi-Fi 設定確認**：`$FLAG_FILE` が無ければ更新スキップ
2) **NTP 同期待機**：未同期ならスキップ
3) **パッチ適用**：`patches_all.zip` を取得・展開し、`PATCH_MARK` より新しい `*.sh` を昇順実行
4) **TAR 更新**：`signage-scripts.tar.gz` を展開し、**migrations** を実行
5) **ヘルスチェック（before/after）**：失敗時はロールバック
6) **metrics 同期**：`/opt/xignage-metrics` を `rsync` + `npm ci`、サービス再起動
7) **`update.sh` 実行**
8) **Web 配置**：`static/index.html` / `web/wifi_manager.py` を `/var/www/html` に配置
9) **完了シグナル**：`/tmp/update_done` を作成

ログ: `/var/log/update_runner/update_runner_*.log`

---

## **update.sh**

### **signage-server 更新**

- Releases から `signage-server.tar.gz` / `.sha256` を取得
- `releases/<timestamp>` に展開して `npm ci --omit=dev --ignore-scripts`
- `current` を切替
- `http://127.0.0.1:3000/health` を **最大 20 秒**確認
- 失敗時は **即ロールバック**

### **xignage-edge-detection 更新（Jetson のみ）**

- Releases から TAR/SHA を取得・検証
- `releases/<timestamp>` に展開し `current` を切替
- `xignage-metrics.service` を停止 → `rsync` + `npm ci` → **手動再起動を促すログ**

ログ: `/var/log/update/update_*.log` / `update_debug_*.log`

---

## **healthcheck**

- 必須ファイル群の存在確認（`update.sh`, `scripts/bin/*`, `scripts/lib/*.sh`, `scripts/**/*.py`, `web/wifi_manager.py`, `setup_all.sh`）
- **トップレベルのみ**の bash / python 構文チェック

> `scripts/**/*.py` は **globstar 無効のため再帰展開されません**。再帰検査が必要なら `find` に置換してください。
