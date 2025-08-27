# サービス

## [**Media / Content**](./media.md)

プレイリスト管理、サムネイル生成（画像/動画）、アップロードを扱う **コンテンツ層サービス**のまとまりです。

- 主な機能
  - プレイリストのロード/保存/並び替え/サムネイルURL付与（`playlistManager.js`）
  - 画像サムネイル生成（`imageService.js`：240×240・白背景・EXIF回転考慮）
  - 動画サムネイル生成（`videoService.js`：ffmpegで1秒目フレームを240×240にパディング）
  - Multer受領ファイルの保存とカテゴリ解決（`uploadService.js`）
