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

!!! note "バインド規約"
    - `{deviceId}` は Adalo では **Logged In User > Device**（text）をバインド
    - POST/PATCH は **Headers: Content-Type: application/json**

| Name                | Method | URL/Path                          | Headers                         | Body（例）                                                                                          | 備考 |
|---------------------|:------:|---------------------------------------------------------|---------------------------------|------------------------------------------------------------------------------------------------------|------|
| toggleVideoVolume   | POST   | `{BASE_URL}/api/commands/send`    | Content-Type: application/json | `{"deviceId":"<user.device>","command":"toggleLocalVideoVolume","payload":{}}`                      | コマンドバス |
| Delete_image        | POST   | `{BASE_URL}/api/delete/image`     | Content-Type: application/json | `{"deviceId":"<user.device>","fileName":"<selected file>"}`                                          | 画像削除 |
| Delete_movie           | POST   | `{BASE_URL}/api/delete/video`                                       | Content-Type: application/json   | `{"deviceId":"<user.device>","fileName":"<selected file>"}`                                                          | 動画削除 |
| Delete_all_contents    | POST   | `{BASE_URL}/api/delete/all`                                         | Content-Type: application/json   | `{"deviceId":"<user.device>"}`                                                                                       | 全消去 |
| volume_level           | POST   | `{BASE_URL}/api/commands/send`                                      | Content-Type: application/json   | `{"deviceId":"<user.device>","command":"setVolume","payload":{"volume":"<volume level>%"}}`                          | 例：`"50%"` |
| Update_deviceInfo      | POST   | `{BASE_URL}/api/device-info/update`                                 | Content-Type: application/json   | `{"deviceId":"<user.device>"}`                                                                                       | 端末情報更新 |
| youtube_playlist_play  | POST   | `{BASE_URL}/api/commands/send`                                      | Content-Type: application/json   | `{"deviceId":"<user.device>","command":"playYoutube","payload":{"youtubeUrl":"<youtubeUrl>"}}`                       | YouTube 再生 |
| kiosk_bt               | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=switchView&fileName=kiosk.html` | —                                | —                                                                                                                    | 表記確認：`kiost_bt` → `kiosk_bt`? |
| end_call               | POST   | `{BASE_URL}/api/commands/kioskRestart`                              | Content-Type: application/json   | `{"deviceId":"<user.device>"}`                                                                                       | 通話終了/キオスク再起動 |
| randomNameAlpha        | GET    | `{BASE_URL}/api/random/roomNameAlpha`                               | —                                | —                                                                                                                    | ランダム名取得 |
| remove_file_from_playlist | DELETE | `{BASE_URL}/api/playlist/<selected uuid>?deviceId=<user.device>`  | —                                | —                                                                                                                    | プレイリストから削除 |
| disableAutoPlaylist | PATCH  | `{BASE_URL}/api/deviceSettings/<user.device>` | Content-Type: application/json | `{"autoPlaylist": false}`                                                                            | 設定OFF |
| resume_loop            | POST   | `{BASE_URL}/api/commands/start`                                     | Content-Type: application/json   | `{"deviceId":"<user.device>"}`                                                                                       | ループ再開 |
| pause_loop             | POST   | `{BASE_URL}/api/commands/stop`                                      | Content-Type: application/json   | `{"deviceId":"<user.device>"}`                                                                                       | ループ停止 |
| setAutoPlaylist     | PATCH  | `{BASE_URL}/api/deviceSettings/<user.device>` | Content-Type: application/json | `{"autoPlaylist": true}`                                                                             | 設定ON |
| system_update          | POST   | `{BASE_URL}/api/commands/update`                                    | Content-Type: application/json   | `{"deviceId":"<user.device>"}`                                                                                       | システム更新 |
| kiosk_before_youtube   | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=switchViewYT&fileName=kiosk.html` | —                                | —                                                                                                                    | YT 前面表示切替 |
| play_video             | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=playVideo&fileName=<selected video>&isSingle=true` | — | —                                                                                                                    | 単発再生 |
| toggleVolume           | POST   | `{BASE_URL}/api/commands/send`                                      | Content-Type: application/json   | `{"deviceId":"<user.device>","command":"toggleVolume","payload":{}}`                                                 | ミュート切替 |
| wifi_reconfig          | POST   | `{BASE_URL}/api/commands/network/reset`                             | Content-Type: application/json   | `{"deviceId":"<user.device>"}`                                                                                       | Wi-Fi リセット |
| Add_to_playlist          | POST   | `{BASE_URL}/api/playlist?deviceId=<user.device>`                                                          | Content-Type: application/json | `{"deviceId":"<user.device>","action":"add","contentId":"<selected file>","duration":"<duration value>"}`                | 追加 |
| sort_playlist            | PATCH  | `{BASE_URL}/api/playlist/<uuid>?deviceId=<user.device>`                                                   | Content-Type: application/json | `{"action":"move","targetIndex":<order value>}`                                                                           | 並び替え |
| ai_assist                | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=switchView&fileName=ai_assist.html`         | —                              | —                                                                                                                         | 画面切替 |
| screen_saver             | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=switchView&fileName=screensaver.html?image=<user.screen_saver>` | —               | —                                                                                                                         | `image` はURLエンコード推奨 |
| openai_ask               | POST   | `{BASE_URL}/api/openai/ask`                                                                               | Content-Type: application/json | `{"userInput":"<text>"}`                                                                                                  | 質問送信 |
| Get DeviceMAC            | GET    | `{BASE_URL}/api/mac?deviceId=<user.device>`                                                               | —                              | —                                                                                                                         | MAC参照 |
| Status_check             | GET    | `{BASE_URL}/api/status?deviceId=<user.device>`                                                            | —                              | —                                                                                                                         | ステータス |
| upload_movie             | POST   | `{BASE_URL}/api/uploads/video`                                                                            | Content-Type: application/json | `{"deviceId":"<user.device>","fileUrl":"<selected file>"}`                                                                | サーバ側がURL取得 |
| upload_image             | POST   | `{BASE_URL}/api/uploads/image`                                                                            | Content-Type: application/json | `{"deviceId":"<user.device>","fileUrl":"<selected file>"}`                                                                | 同上 |
| Get DeviceInfo           | GET    | `{BASE_URL}/api/device-info?deviceId=<user.device>`                                                       | —                              | —                                                                                                                         | 端末情報 |
| show_image               | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=showImage&fileName=<selected file>`         | —                              | —                                                                                                                         | 単画像表示 |
| mirror                   | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=switchView&fileName=mirror.html`            | —                              | —                                                                                                                         | ミラー表示 |
| Get Local-IP             | GET    | `{BASE_URL}/api/ip?deviceId=<user.device>`                                                                | —                              | —                                                                                                                         | ローカルIP |
| start_videocall          | GET    | `{BASE_URL}/api/commands/send?deviceId=<user.device>&command=switchView&fileName=https://meet.jit.si/<user.device>-<randomRoomName>` | —           | —                                                                                                                         | URLはエンコード推奨 |
| shutdown                 | POST   | `{BASE_URL}/api/device/power/shutdown`                                                                    | Content-Type: application/json | `{"deviceId":"<user.device>"}`                                                                                            | 電源OFF |
| reboot                   | POST   | `{BASE_URL}/api/device/power/reboot`                                                                      | Content-Type: application/json | `{"deviceId":"<user.device>"}`                                                                                            | 再起動 |
| rotate_display           | POST   | `{BASE_URL}/api/commands/rotate`                                                                          | Content-Type: application/json | `{"deviceId":"<user.device>"}`                                                                                            | 画面回転 |
| device_version           | GET    | `{BASE_URL}/api/version/versions?deviceId=<user.device>`                                                  | —                              | —                                                                                                                         | バージョン群 |
| Get_PatchMigState        | GET    | `{BASE_URL}/api/patchMigState?deviceId=<user.device>`                                                     | —                              | —                                                                                                                         | パッチ/マイグ状態 |

## **今後の変更予定**

- **API 認証**の導入（`Authorization: Bearer <JWT>` 等）  
- **複数プレイリスト**対応（`selected playlist` の実利用）
