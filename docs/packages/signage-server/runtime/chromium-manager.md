# Chromium Manager（キオスク再読込）

- 対象ファイル: `chromiumManager.js`  
- 役割: **キオスク再読込**（Chromium プロセスの強制終了）

## **実装要点**

```js
const ENV_OPTS = {
  env: {
    ...process.env,
    DISPLAY: ':0',
    HOME: config.HOME_DIR,
    XAUTHORITY: config.HOME_DIR + '/.Xauthority',
  },
};

function forceKiosk() {
  exec('killall chrome', ENV_OPTS, (err, out, errout) => { ... });
}
```

- **X 環境**：`DISPLAY=:0`、`XAUTHORITY=$HOME/.Xauthority` を付与
- **動作**：`killall chrome` を実行（**プロセス名が環境で異なる**点に注意）

## **連携エンドポイント**

- `GET /forceKiosk`（`app.js`）
  呼び出しで `forceKiosk()` を実行 → `Kiosk reloading...` を返す

!!! note
    - **プロセス名差異**：環境により `chrome` / `chromium` / `chromium-browser` 等。必要なら複数候補を試行。
    - **権限**：X 認証と実行ユーザの整合を確認（`sudo -u <user>` や systemd ユーザサービスでの起動設計）。
    - **安全性**：誤操作防止のため、エンドポイントに**認証/認可**やロールベース保護を推奨。
