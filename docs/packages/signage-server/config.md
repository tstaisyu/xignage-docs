# 設定リファレンス（config/index.js）

`config/index.js` がエクスポートする設定値と、読み込み時の副作用（ディレクトリ自動作成）をまとめます。  
`.env` は **起動カレントディレクトリ** の `.env` を `dotenv` で読み込みます。

## **エクスポート値一覧**

| Export 名 | 型 | 既定値 / 由来 | 上書き可能な環境変数 | 説明 |
| --- | --- | --- | --- | --- |
| `SERVER_URL` | string | `'https://api.xrobotics.jp'` | `SERVER_URL` | クラウド API のベース URL。 |
| `SERVER_PORT` | string | `'3000'`（`PORT` → `SERVER_PORT` → 既定 の優先） | `PORT`, `SERVER_PORT` | HTTP サーバの待受ポート。 |
| `DEVICE_ID` | string | `'jetson001'` | `DEVICE_ID` | 端末一意識別子。 |
| `DEFAULT_ROTATION` | string | `'right'` | `DEFAULT_ROTATION` | 既定の画面回転（例：`right`）。 |
| `PATCH_FILE` | string | `'/opt/signage-core/patches_applied.txt'` | `PATCH_FILE` | 適用済みパッチの記録ファイル。 |
| `MIGR_DIR` | string | `'/opt/signage-core/signage-jetson/current/migrations'` | `MIGR_DIR` | マイグレーション *.sh の配置先。 |
| `DONE_DIR` | string | `'/opt/signage-core/signage-migrations'` | `DONE_DIR` | マイグレーション適用済みマーカー（*.done）の配置先。 |
| `HOME_DIR` | string | `os.homedir()` | — | 実行ユーザのホームディレクトリ。 |
| `CONTENTS_DIR` | string | `${HOME_DIR}/contents` | — | コンテンツのベースディレクトリ。 |
| `IMAGES_DIR` | string | `${CONTENTS_DIR}/images` | — | 画像ディレクトリ。 |
| `VIDEOS_DIR` | string | `${CONTENTS_DIR}/videos` | — | 動画ディレクトリ。 |
| `BUILD_DIR` | string | `path.join(__dirname, '../build')` | — | ビルド成果物の配置先（コード相対）。 |

## **読み込み時の副作用（ディレクトリ自動作成）**

`ensureDirectories()` が **モジュール読込時** に実行され、以下のパスを作成します（存在しない場合）。

| 自動作成されるディレクトリ | 由来 |
| --- | --- |
| `IMAGES_DIR` | `${CONTENTS_DIR}/images` |
| `VIDEOS_DIR` | `${CONTENTS_DIR}/videos` |

!!! note "相対パスの基準"
`BUILD_DIR` は **`config/index.js` からの相対**です（`__dirname` 起点）。  
一方、`CONTENTS_DIR` 以下は **ユーザホーム配下**に作成されます。

## **環境変数の優先順位・読み込み**

- `.env` は `dotenv.config()` により **カレントディレクトリ** の `.env` を読み込みます。
- `SERVER_PORT` は `PORT` → `SERVER_PORT` → 既定 `'3000'` の順で評価されます。
- 上記表の「上書き可能な環境変数」に該当しないものは **環境変数での上書き不可**（コード計算値）です。

!!! note
    - 本モジュールを `require` / `import` した時点で **ディレクトリが作成** されます。テスト時に副作用を避けたい場合は、読み込み前に `process.env` を切り替えるか、モック化してください。  
    - ディレクトリの **所有者／権限** は実行ユーザに依存します。サービス起動ユーザ（`systemd` など）と整合させてください。
