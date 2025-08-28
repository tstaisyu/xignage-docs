# サービス - System / Platform

端末情報・OS/時刻/NTP・GPU統計・画面回転・電源/再起動・更新トリガ・ローカル設定を扱うサービス群。

## **早見表**

| ファイル | 役割（要約） | 主な関数 |
|---|---|---|
| `deviceInfo.js` | 端末情報の統合取得 | `getDeviceInfo()`, `getDeviceModel()` |
| `systemInfo.js` | OS/JetPack/Python/Timezone/NTP の取得 | `getOsReleaseInfo()`, `getJetpackVersion()`, `getPythonVersion()`, `getSystemTimezone()`, `getSystemTimeAndNtp()` |
| `gpuStats.js` | Jetson/RasPi/汎用の GPU 統計 | `getGpuStatsByDevice()`, `getJetsonGpuStats()`, `getRaspiGpuStats()`, `getGenericGpuStats()` |
| `systemManager.js` | 電源断・再起動の実行 | `execShutdown()`, `execReboot()` |
| `updateManager.js` | 更新の起動（systemd サービス） | `runUpdate()` |
| `rotationManager.js` | 画面・タッチ回転の取得/適用/トグル | `applyStartupRotation()`, `applyXrandrRotation()`, `applyJetsonRotation()`, `toggleRotation()` ほか |
| `localSettingsService.js` | 端末ローカル設定の読み書き | `loadSettings()`, `saveSettings()` |

---

## **deviceInfo.js**

`systemInfo`/`gpuStats` から収集した情報と `/sys/firmware/devicetree/base/model` を突き合わせ、端末情報オブジェクトを返す。

- `getDeviceModel(): string` … `/sys/firmware/devicetree/base/model` を読んでモデル名（失敗時 `''`）

- `getDeviceInfo(): object` … 下記キーを含むオブジェクト
  `model, os, version, jetpack, kernel, os_arch, pythonVersion, node, gpuUsage, gpuClock, gpuTemp, timezone, currentTime, ntpSyncStatus`
  **備考**：`model` に "Raspberry Pi" を含む場合、`jetpack`/`jetpackVersion` を削除

> 処理の流れ

1) `getDeviceModel()` でモデル名  

2) `getOsReleaseInfo()` で OS 名/バージョン  

3) `getGpuStatsByDevice()` で `gpuUsage/Clock/Temp`  

4) `getJetpackVersion()`, `getPythonVersion()`, `getSystemTimezone()`, `getSystemTimeAndNtp()`  

5) `os.release()`, `os.arch()`, `process.version` を加えて統合  

!!! note
    - `jetpackVersion` フィールドは生成時点では存在しないが、Pi の場合は `delete` しており互換考慮の名残。

---

## **systemInfo.js**

OS/JetPack/Python/タイムゾーン/現在時刻と NTP 同期状態を取得する。
各関数は下記コマンド/ファイル読込を実施し、失敗時にログして既定値へフォールバック。

- `getOsReleaseInfo(): Record<string,string>` … `/etc/os-release` を key=value でパース（失敗時 `{}`）

- `getJetpackVersion(): string` … `dpkg-query --show nvidia-l4t-core` の 2 トークン目、失敗時 `'N/A'`

- `getPythonVersion(): string` … `python3 --version` のトリム、失敗時 `'N/A'`

- `getSystemTimezone(): string` … `/etc/timezone` or `Intl.DateTimeFormat().resolvedOptions().timeZone`（失敗時 `'N/A'`）

- `getSystemTimeAndNtp(): { currentTime: string, ntpSync: 'yes'|'no'|'N/A' }`
  `currentTime` は `Asia/Tokyo` で `toLocaleString`、`timedatectl status` から `System clock synchronized:` を抽出（失敗時 `'N/A'`）

---

## **gpuStats.js**

Jetson なら `tegrastats` + sysfs、Raspberry Pi なら `vcgencmd`、それ以外は `'N/A'` で GPU 統計を返す。

- `getGpuStatsByDevice(): { gpuUsage, gpuClock, gpuTemp }` … Jetson → RasPi → Generic の順で判定

- `getJetsonGpuStats(): {…}|null` … `tegrastats` 実行と `parseTegraOutput()`、sysfs から `cur_freq` 取得

> 処理の流れ

1) `checkTegrastatsInstalled()` → 無ければ `null`  

2) `runTegrastats()`（timeout=1s, interval=100）。`124` タイムアウトでも `stdout` があればパース  

3) `parseTegraOutput()` で `GR3D_FREQ` と `gpu@xxC` を抽出、クロックは `cur_freq`（Hz→MHz）を sysfs から  

- `getRaspiGpuStats(): {…}|null` … `vcgencmd measure_temp/measure_clock v3d` をパース（usage は空→`N/A`）し、温度/クロック（500000000→500MHz）を算出

- `getGenericGpuStats(): { gpuUsage:'N/A', gpuClock:'N/A', gpuTemp:'N/A' }`

!!! note
    - sysfs パス: `/sys/devices/platform/bus@0/17000000.gpu/devfreq/17000000.gpu/cur_freq`  
    - 取得失敗時は各値を `'N/A'` に正規化。

---

## **systemManager.js**

電源断/再起動を `sudo` 経由で実行する薄いラッパ。

- `execShutdown(): void` … `sudo poweroff` を実行（成功/失敗をログ）
- `execReboot(): void` … `sudo reboot` を実行（成功/失敗をログ）

!!! note
    - `sudo` 実行権限（sudoers のコマンド許可）が必要。

---

## **updateManager.js**

更新ワークフロー（`signage-update.service`）を起動する。

- `runUpdate(): void` … `sudo systemctl start signage-update.service` を実行

> 処理の流れ

1) 上記コマンドを `exec`  

2) 成功/失敗をログ出力

!!! note
    - `signage-jetson` 側で定義される oneshot サービスが前提。

---

## **rotationManager.js**

起動時の希望回転を端末種類（Jetson/その他）に応じて適用し、必要に応じ **タッチ座標の変換行列**も設定。回転のトグル操作も提供。

- 定数：`XORG_CONF_PATH='/etc/X11/xorg.conf.d/10-nvidia-rotate.conf'`

- 主要関数：  
  `applyStartupRotation(retry=0): void` … 起動時に `getWantedRotation()` を判定して適用  
  `applyXrandrRotation(wanted, retry): void` … `xrandr --query` で出力/回転を検出 → `xrandr --rotate`  
  `applyJetsonRotation(wanted): void` … Xorg conf の `Rotation=...` を書換 → `sudo pkill Xorg`  
  `toggleRotation(): void` … Jetson→`toggleJetsonRotation()` / それ以外→`toggleXrandrRotation()`  
  `applyTouchRotation(rotation): void` … `xinput set-prop "Coordinate Transformation Matrix"` を設定  
  `saveRotation(newMode): void` … `localSettingsService.saveSettings({screenRotation:newMode})`  

> 処理の流れ

1) `getWantedRotation()`：`localSettings.screenRotation` or `DEFAULT_ROTATION`

2) 回転の適用  
**Jetson**：`/etc/X11/xorg.conf.d/10-nvidia-rotate.conf` 内の `Rotation=` を `sed -i` で切替 → `pkill Xorg`  
**RasPi/Other**：`xrandr --query` で出力と回転を検出し、`xrandr --rotate <mode>`（`DISPLAY=:0`, `sudo -u ubuntu`）

3) タッチ：`xinput list` で **"WingCoolTouch WingCoolTouch"** の pointer を特定し、行列を適用  
（right/left/inverted/normal に対応する 3x3 行列を設定）

!!! note
    - `xrandr`/`xinput` の DISPLAY/権限に注意（`sudo -u ubuntu DISPLAY=:0` で実行）。  
    - タッチデバイス名はハード依存。該当名称が無い場合はスキップされる。  
    - Jetson 回転は Xorg の設定ファイルを編集するため、**権限と再起動**が伴う（`pkill Xorg`）。

---

## **localSettingsService.js**

**端末ローカル設定**の読み書き。無ければデフォルトを作成。

- ファイル：`/var/lib/signage_local/localSettings.json`（`process.env.LOCAL_SETTINGS_FILE_PATH` で上書き可）

- `loadSettings(): { autoPlaylist: boolean, screenRotation: string }` … 読込/無ければ `{autoPlaylist:false, screenRotation: DEFAULT_ROTATION}` を作成・返却 → 既存は JSON を返却（失敗時はデフォルトを返却）

- `saveSettings(patch: Partial<Settings>): void` … 現行 JSON を読み取り、引数とマージして書込

!!! note
    - ディレクトリが無い場合は `mkdir -p` 的に自動作成。  
    - サービス/ユーザ権限での**書込可否**に注意（`systemd --user`/`root` 等の差）。
