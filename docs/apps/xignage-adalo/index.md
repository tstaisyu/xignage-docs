# Xignage（Adalo）— Mobile Apps Overview

**What**：ユーザが**サイネージ本体を操作**するためのモバイルアプリ（Adalo 製）  
**Why**：現場から **動画/写真のアップロード** や **表示内容の管理** を素早く行う  
**Platforms**：iOS / Android（Android は現在 招待制公開）

## **ストア / 識別子**

- **iOS**：`itms-apps://apps.apple.com/app/id6742766086?`
- **Android**：`market://details?id=com.example.xignage`（招待制）
- **名称**：Xignage（仮）

## **バックエンド / API**

- **Base（Prod）**：`https://api.xrobotics.jp`
- 代表的な呼び出し例
  画像一覧：`GET /api/images/list?deviceId={id}`
  デバイス設定更新（autoPlaylist）：`PATCH /api/deviceSettings/{deviceId}`（`{"autoPlaylist": true|false}`）
  **TODO**：動画一覧 API パス
  **TODO**：再生 API パス（例：`/api/v1/play` 相当）
  **TODO**：メディアアップロード API パス（multipart）
  **TODO**：デバイス紐付け / ステータス取得 API パス

## **認証**

- **アプリ利用者（Adalo側）**：Adalo 標準ログイン（メール＋パスワードでアカウント作成）
- **API（AWS 側）**：**現状なし**（将来導入予定）

## **主要画面**

- **welcome**：アカウント作成 or ログイン
- **ログイン/サインイン**：メール＋パスワード
- **端末登録**：アプリ内カメラで **QR** 読取り → deviceId 登録
- **Home**：登録端末一覧、プレイリスト編集への導線、ボトムナビ（5 アイコン）
- **写真／動画**：一覧表示／再生／削除／新規アップロード
- **設定**：アカウント・デバイス情報、**アップデート/再起動**コマンド
- **機能ページ（β）**：YouTube 再生、AI 対話、ビデオ通話、ミラー、スクリーンセーバー
- **サポート**：外部 URL → 公式 LINE（マニュアル/サポート）

## **データモデル（Adalo）**

> ### **Users**

| Field                  | Type                      | Required | Note |
|------------------------|---------------------------|:--------:|------|
| Password               | text                      | ✓        |      |
| Username               | text                      |          |      |
| Full Name              | text                      | ✓        |      |
| Local IP               | text                      |          |      |
| Device                 | text                      |          | 選択中の **deviceId**（文字列） |
| preupload_image        | image file                |          |      |
| preupload_video        | video file                |          |      |
| Youtube                | text                      |          |      |
| screen saver           | text                      |          |      |
| status                 | text                      |          | 例：online/offline |
| MAC Address            | text                      |          |      |
| Devices                | Relationship → **Devices**|          | ユーザ所持デバイス一覧 |
| selected device        | text                      |          | 表示用のデバイス名 |
| playlist editing       | text                      |          |      |
| playlist insert        | number                    |          |      |
| loop                   | bool                      |          |      |
| start_guide_QR_visited | bool                      |          |      |
| selected playlist      | text                      |          | 将来の複数プレイリスト向け |
| toggleVideoMuted       | bool                      |          |      |
| volume level           | number                    |          | 0–100 |
| App_version            | number                    |          |      |
| deviceVersion          | text                      |          |      |
| farmVersion            | text                      |          | （firmware 想定） |
| patchMigState          | text                      |          |      |
| autoPlaylist           | bool                      |          |      |
| ID                     | number (System)           |          | Adalo 自動 |
| Created                | date & time (System)      |          | Adalo 自動（表示は “~ago”） |
| Updated                | date & time (System)      |          | Adalo 自動（表示は “~ago”） |

### **Devices**

| Field      | Type                      | Required | Note |
|------------|---------------------------|:--------:|------|
| deviceId   | text                      |          | 端末の一意 ID |
| owner      | text                      |          | 文字列所有者（参考） |
| deviceName | text                      |          | 表示名 |
| location   | text                      |          | 任意ロケーション |
| User       | Relationship → **Users**  |          | 所有ユーザ（1:N 想定、実装上は N:N も運用可能） |
| ID         | number (System)           |          | Adalo 自動 |
| Created    | date & time (System)      |          | Adalo 自動 |
| Updated    | date & time (System)      |          | Adalo 自動 |

### **外部コレクション（読み取り）**

- **images**
  - Endpoint：**GET** `https://api.xrobotics.jp/api/images/list?deviceId=<user.device>`
  - Fields：`id:number`, `fileName:text`, `thumbnailUrl:text`

- **videos**
  - Endpoint：**GET** `https://api.xrobotics.jp/api/videos/list?deviceId=<user.device>`
  - Fields：`id:number`, `fileName:text`, `thumbnailUrl:text`, `deviceId:text（返却されるが未使用）`

- **device_info**
  - Endpoint：**GET** `https://api.xrobotics.jp/api/device-info?deviceId=<user.device>`
  - Fields：`key:text`, `value:text`
  - 備考：レコード自体は deviceId を持たず、**クエリでスコープ**します。

- **playlists**
  - Endpoint：**GET** `https://api.xrobotics.jp/api/playlist?deviceId=<user.device>`
  - Fields：`uuid:text`, `contentId:text`, `type:text`, `duration:number`, `order:number`, `thumbnailUrl:text`

- **DeviceConfig**
  - 取得：**GET** `https://api.xrobotics.jp/api/deviceSettings/<user.device>`
  - 更新：**PATCH** `https://api.xrobotics.jp/api/deviceSettings/<user.device>`  
    Body：`{"autoPlaylist": true|false}`

## **Custom Actions（Adalo）**

> BASE_URL: `https://api.xrobotics.jp`

| Name                | Method | URL/Path                          | Headers                         | Body（例）                                                                                          | 備考 |
|---------------------|:------:|---------------------------------------------------------|---------------------------------|------------------------------------------------------------------------------------------------------|------|
| toggleVideoVolume   | POST   | `{BASE_URL}/api/commands/send`    | Content-Type: application/json | `{"deviceId":"<user.device>","command":"toggleLocalVideoVolume","payload":{}}`                      | コマンドバス |
| Delete_image        | POST   | `{BASE_URL}/api/delete/image`     | Content-Type: application/json | `{"deviceId":"<user.device>","fileName":"<selected file>"}`                                          | 画像削除 |
| setAutoPlaylist     | PATCH  | `{BASE_URL}/api/deviceSettings/<user.device>` | Content-Type: application/json | `{"autoPlaylist": true}`                                                                             | 設定ON |
| disableAutoPlaylist | PATCH  | `{BASE_URL}/api/deviceSettings/<user.device>` | Content-Type: application/json | `{"autoPlaylist": false}`                                                                            | 設定OFF |

### プレースホルダ（要充填）

| Name                       | Method | URL | Headers | Body | 備考 |
|---------------------------|:------:|-----|--------|------|------|
| Delete_movie              |  TBD   | TBD |        | TBD  |      |
| Delete_all_contents       |  TBD   | TBD |        | TBD  |      |
| Local videos              |  TBD   | TBD |        | TBD  |      |
| volume_level              |  TBD   | TBD |        | TBD  |      |
| Update_deviceinfo         |  TBD   | TBD |        | TBD  |      |
| youtube_playlist_play     |  TBD   | TBD |        | TBD  |      |
| kiosk_bt                  |  TBD   | TBD |        | TBD  |      |
| end_call                  |  TBD   | TBD |        | TBD  |      |
| randomNameAlpha           |  TBD   | TBD |        | TBD  |      |
| remove_file_from_playlist |  TBD   | TBD |        | TBD  |      |
| resume_loop               |  TBD   | TBD |        | TBD  |      |
| pause_loop                |  TBD   | TBD |        | TBD  |      |
| system_update             |  TBD   | TBD |        | TBD  |      |
| kiosk_before_youtube      |  TBD   | TBD |        | TBD  |      |
| play_video                |  TBD   | TBD |        | TBD  |      |
| toggleVolume              |  TBD   | TBD |        | TBD  |      |
| wifi_reconfig             |  TBD   | TBD |        | TBD  |      |
| Add_to_playlist           |  TBD   | TBD |        | TBD  |      |
| sort_playlist             |  TBD   | TBD |        | TBD  |      |
| ai_assist                 |  TBD   | TBD |        | TBD  |      |
| screen_saver              |  TBD   | TBD |        | TBD  |      |
| openai_ask                |  TBD   | TBD |        | TBD  |      |
| Get DeviceMAC             |  TBD   | TBD |        | TBD  |      |
| Status_check              |  TBD   | TBD |        | TBD  |      |
| upload_image              |  TBD   | TBD |        | TBD  |      |
| Get DeviceInfo            |  TBD   | TBD |        | TBD  |      |
| show_image                |  TBD   | TBD |        | TBD  |      |
| mirror                    |  TBD   | TBD |        | TBD  |      |
| Get Local-IP              |  TBD   | TBD |        | TBD  |      |
| start_videocall           |  TBD   | TBD |        | TBD  |      |
| shutdown                  |  TBD   | TBD |        | TBD  |      |
| reboot                    |  TBD   | TBD |        | TBD  |      |
| rotate_display            |  TBD   | TBD |        | TBD  |      |
| device_version            |  TBD   | TBD |        | TBD  |      |
| Get_PatchMigState         |  TBD   | TBD |        | TBD  |      |

## **今後の変更予定**

- **API 認証**の導入（`Authorization: Bearer <JWT>` 等）  
- **複数プレイリスト**対応（`selected playlist` の実利用）
