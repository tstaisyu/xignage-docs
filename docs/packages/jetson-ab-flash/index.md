# jetson-ab-flash

Jetson Orin Nano DevKit 向けに、A/B rootfs + NVMe フラッシュを自動化するスクリプト群です。
SDK Manager で取得した NVIDIA パッケージからベースイメージを生成し、Recovery 接続でフラッシュできます。

## 目的 / できること

- A/B rootfs 構成のベースイメージを生成する（`--no-flash`）
- Recovery 接続した Jetson を検出してフラッシュする（USB vendor 0955）
- 初回起動時に `/userdata` の準備と `device_type` 設定を行う（cloud-init + userdata-setup）
- `xignage` ユーザーを作成して初期セットアップを省略する

## 対象環境

### ホスト

- Ubuntu 22.04（README 記載）
- 必要ツール: `sudo`, `tar`, `lsusb`, `awk`, `dtc`
- NVIDIA SDK Manager で取得した以下の tbz2 が必要
  - `Jetson_Linux_R36.4.4_aarch64.tbz2`
  - `Tegra_Linux_Sample-Root-Filesystem_R36.4.4_aarch64.tbz2`

### ターゲット

- Jetson Orin Nano DevKit（`BOARD=jetson-orin-nano-devkit`）
- NVMe デバイス（デフォルト: `nvme0n1`）
- Recovery モードでの USB 接続が必要

### 前提ディレクトリ / ファイル

- 設定: `jetson-ab-flash/configs/jetson-orin-nano-devkit.conf`
- 作業ディレクトリ: `jetson-ab-flash/.work/`
- 出力ディレクトリ: `jetson-ab-flash/output/`

## 使い方

### Dry-run 相当（フラッシュなしで準備）

`build_base_image.sh` は内部で `--no-flash` を使い、フラッシュせずにベースイメージを生成します。

```bash
cd jetson-ab-flash
./scripts/host/build_base_image.sh
```

設定ファイルを変更している場合は `CONF_PATH` を指定します。

```bash
CONF_PATH=./configs/jetson-orin-nano-devkit.conf ./scripts/host/build_base_image.sh
```

### 実行（フラッシュ）

生成した tarball を指定してフラッシュします。

```bash
./scripts/host/flash_device.sh output/base_*.tar.gz
```

ビルドとフラッシュをまとめて行う場合は `flash_once.sh` を使用します。

```bash
./scripts/host/flash_once.sh
```

USB 検出で複数デバイスが見つかる場合は `--usb-instance` を明示します。

```bash
./scripts/host/flash_device.sh output/base_*.tar.gz --usb-instance 3-9
```

`flash_ab.sh` と `flash_vanilla_ab.sh` は `--erase-all` を使うため破壊的です。
必要性を確認したうえで利用してください。

### ログ

スクリプトは標準出力 / 標準エラーにログを出します。保存したい場合はリダイレクトします。

```bash
mkdir -p logs
./scripts/host/flash_device.sh output/base_*.tar.gz 2>&1 | tee logs/flash_$(date +%Y%m%d_%H%M%S).log
```

### よくある失敗（抜粋）

- `ERROR: not found: ...`: `SDK_DL_DIR` 配下の tbz2 が見つからない
- `ERROR: Not detected. Ensure Recovery mode & USB connected.`: Recovery 接続ができていない、またはケーブル / ポートの問題
- `ERROR: Multiple NVIDIA(0955) USB devices: ...`: `--usb-instance` で対象を指定する
- `ERROR: 'dtc' not found`: `dtc` が未導入で `flash_once.sh` が停止

## ディレクトリ構成（要約）

```text
jetson-ab-flash/
├── configs/
│   └── jetson-orin-nano-devkit.conf
├── scripts/
│   ├── host/
│   │   ├── build_base_image.sh
│   │   ├── flash_device.sh
│   │   ├── flash_once.sh
│   │   ├── flash_ab.sh
│   │   └── flash_vanilla_ab.sh
│   └── device/
│       ├── cloud-init/
│       │   ├── user-data
│       │   └── meta-data
│       └── userdata-setup.sh
├── output/
└── .work/
```

## 安全設計 / 注意点

- `build_base_image.sh` は設定ファイルと tbz2 の存在をチェックしてから処理を開始する
- `flash_device.sh` は USB vendor 0955 を自動検出し、複数台検出時は停止する
- `userdata-setup.sh` は `LABEL=UDA` を検出済みの場合はフォーマットを行わない
- `userdata-setup.sh` は `sgdisk` がない場合、UDA 作成をスキップする
- `flash_ab.sh` / `flash_vanilla_ab.sh` は `--erase-all` を使うため既存データが消える
- `build_base_image.sh` は `DEFAULT_USER` / `DEFAULT_PASS` / `DEFAULT_HOSTNAME` を環境変数で上書き可能
- 指定がない場合は `xignage` / `xignage` / `xignage-jetson` を使用する
- `UDA_SIZE_GIB` は tarball 名にのみ使われ、XML パッチ処理は実装されていない  
  （根拠: `jetson-ab-flash/scripts/host/build_base_image.sh`）

バックアップは事前に取得してください。

## トラブルシュート

- `ERROR: config not found: ...`: `CONF_PATH` を指定するか、`configs/jetson-orin-nano-devkit.conf` が存在することを確認する
- `ERROR: not found: Jetson_Linux_...tbz2`: `SDK_DL_DIR` に SDK Manager のダウンロードがあるか確認する
- `ERROR: L4T tree missing expected XML in ...`: tarball 展開に失敗している可能性があるため再展開する
- `WARN: Jetson (USB vendor 0955) not detected.`: Recovery モードで `lsusb` に 0955 が表示されるか確認する
- `sgdisk not available; skipping UDA partition setup`: `sgdisk` が未導入のため UDA 作成をスキップしている

## 関連

- `signage-jetson` ドキュメント: `xignage-docs/docs/packages/signage-jetson/index.md`
- TODO: `jetson-ab-flash` で作成したイメージが `signage-jetson` の想定ベース OS か確認する  
  （根拠: `signage-jetson/README.md`）
