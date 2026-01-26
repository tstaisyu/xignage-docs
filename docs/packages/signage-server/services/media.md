# サービス - Content / Doorbell

クラウド正本型の同期とドアベル通知（IoT publish）を扱うサービス群。  
対象ファイル：`cloudContentSync.js`, `iotDoorbellPublisher.js`

## **早見表**

| ファイル | 役割（要約） | 主な関数 |
| --- | --- | --- |
| `cloudContentSync.js` | クラウド正本の **プレイリスト/メディア同期** | `syncOnceFromCloud({ apiBaseUrl, deviceId })` |
| `iotDoorbellPublisher.js` | ドアベル押下の **IoT publish** | `publishDoorbellTest({ deviceId })` |

---

## **cloudContentSync.js**

クラウド側 API から **プレイリスト**と**メディアマニフェスト**を取得し、端末内へ同期します。  
同期完了後は **`sync-complete`** をクラウドへ POST します。

### **syncOnceFromCloud({ apiBaseUrl, deviceId })**

- **入力**：
  - `apiBaseUrl`（例: `https://device.api.xrobotics.jp`）
  - `deviceId`
- **出力**：`{ ok, playlistId, downloaded, skipped, failed, syncCompletePosted, error? }`

> 処理の流れ

1) **プレイリスト取得**  
   `GET ${apiBaseUrl}/api/devices/:deviceId/playlist`  
   取得結果を `config.CONTENTS_DIR/playlist.json` に保存（テンポラリ → rename）

2) **メディアマニフェスト取得**  
   `GET ${apiBaseUrl}/api/devices/:deviceId/media-manifest`  
   `media[]` に含まれる `contentId / mediaType / sizeBytes / downloadUrl / updatedAt` を使用

3) **メディア同期**  
   `syncMediaFilesFromManifest({ media })` を実行  
   `contentId` の拡張子 or `mediaType` から `IMAGES_DIR` / `VIDEOS_DIR` に保存  
   既存ファイルはサイズ/更新日時でスキップ  
   旧ファイル名（スペース/アンダースコア差異）は rescue 処理でリネーム

4) **sync-complete 通知**  
   `POST ${apiBaseUrl}/api/devices/:deviceId/sync-complete`  
   ボディ：`{ playlistId, syncedAt }`

!!! note
    - **部分失敗**：メディア同期に失敗がある場合は `ok: false` を返し、`sync-complete` は送信しません。  
    - **保存先**：`images/`・`videos/` ディレクトリは `config/index.js` で自動作成されます。  
    - **旧ファイル救済**：`contentId` の空白/アンダースコア差異を自動補正（`rescueLegacyFileIfNeeded`）。

### cloudContentSync.js の関連ルート

- `POST /api/test/cloud-sync`（`routes/testRoutes.js`）
- `syncContentFromCloud`（`sockets/cloudSocket/playlistCommands.js`）

---

## **iotDoorbellPublisher.js**

ドアベル押下を **AWS IoT Data Plane** に publish します。

### **publishDoorbellTest({ deviceId })**

- **入力**：`deviceId`（必須）
- **publish topic**：`xignage/v1/devices/${deviceId}/events/button`
- **payload**：`{ event, deviceId, title, body, event_id, ts, type, value, src }`
- **例外**：`deviceId` 未指定は例外。`IOT_ENDPOINT` 未指定は **起動時に例外**。

### **必要環境変数**

| Key | Required | Default | Note |
| --- | --- | --- | --- |
| `IOT_ENDPOINT` | yes | — | `xxxxx-ats.iot.<region>.amazonaws.com` |
| `AWS_REGION` | no | `ap-northeast-1` | IoT Data Plane のリージョン |

### iotDoorbellPublisher.js の関連ルート

- `POST /api/doorbell/test`（`routes/doorbellRoutes.js`）
