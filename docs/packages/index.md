# パッケージ一覧

ここでは、本プロジェクトの主要パッケージの**概要**と**ドキュメント入口**をまとめます。

## **サマリー**

| パッケージ | 役割 / 概要 | 対象 / 実行環境 | ステータス | ドキュメント |
|---|---|---|---|---|
| **signage-jetson** | Jetson / Raspberry Pi を**サイネージ端末化**するセットアップスクリプト群（ネットワーク統一、AP フォールバック、更新基盤、キオスク起動 等を冪等適用） | Ubuntu 系（Jetson L4T/Ubuntu・Ubuntu for Raspberry Pi） | **Complete** | [`packages/signage-jetson`](./signage-jetson/index.md) |
| **signage-server** | 端末上で動作する**バックエンド**。Express API、コンテンツ管理、プレイリスト、サムネイル生成、Socket 連携など | Node.js（Jetson / Raspberry Pi / Linux） | **Complete** | [`packages/signage-server`](./signage-server/index.md) |
| **signage-aws-nodejs** | AWS 上で常駐する**クラウド側バックエンド**。Express + Socket.IO で端末制御／メディアアップロード／プレイリスト操作／設定更新／バージョン・パッチ照会などを提供 | Node.js 22（AWS / Linux, EC2・Lightsail・Container） | **Complete** | [`packages/signage-aws-nodejs`](./signage-aws-nodejs/index.md) |
| **signage-admin-ui** | 端末ローカルで操作・管理する**フロント UI**（音量ミュート/スライダー、D&D アップロード、状態確認） | ブラウザ（Vite ビルドを Nginx 等で静的配信、**/admin** ベース） | **Complete** | [`packages/signage-admin-ui`](./signage-admin-ui/index.md) |
| **xignage-edge-detection** | Jetson 上で動作する**人物検知パイプライン**（YOLOX）＋将来の視線推定（OpenFace, 現状はプレースホルダ）。カメラ入力→最新結果を **JSON にアトミック書き込み** | Python 3.9+（Jetson Orin / JetPack, CUDA/TensorRT 対応ホイール） | **Complete** | [`developers/packages/xignage-edge-detection`](./xignage-edge-detection/index.md) |

---

> ## **signage-jetson**

- **目的**：端末を**即戦力のサイネージ専用デバイス**として構成（Openbox+Chromium キオスク、Nginx、Node サーバ、更新・メトリクス・AP フォールバック等）。
- **特徴**：ボード自動判別 / 冪等適用 / 最小権限 / フェーズ分割（000–999）。
- **入口**：[`signage-jetson / index`](./signage-jetson/index.md)

---

> ## **signage-server**

- **目的**：画像・動画・YouTube・AI テキストの**配信と制御**を担うバックエンド。REST/HTTP と Socket を提供。
- **現状**：ドキュメント整備中（API・ユーティリティ・設定の章から順次拡充）。
- **入口**：[`signage-server / index`](./signage-server/index.md)

---

> ## **signage-aws-nodejs**

- **目的**：クラウドから端末（Jetson/RasPi）を**安全に制御・同期**。REST/HTTP と Socket.IO を橋渡しし、画像/動画の**一覧・サムネ取得・アップロード/削除**、**プレイリスト操作**、**デバイス設定（get/update）**、**バージョン/パッチ状態**、**電源操作**、**IP/MAC/接続状態**、必要に応じて **OpenAI 応答配信**を担う。
- **特徴**：`requestId` による **ACK 相関**（誤解決防止）／`deviceSockets`＋`getIO()` で接続管理／`io.to(deviceId)` の**ルーム送信**／アップロードは **Buffer 直送**（サイズ制御推奨）／**CI** は fmt/lint/test＋**ライセンスチェック**＋**Release バッジ更新** を実施。
- **入口**：[`signage-aws-nodejs / index`](./signage-aws-nodejs/index.md)

---

> ## **signage-admin-ui**

- **目的**：端末ローカルでの**管理・操作 UI**。音量制御、メディアの D&D アップロード、状態確認をブラウザから実行。
- **特徴**：
  - **SPA**（`/admin` ベース）：`BrowserRouter basename="/admin"` / Vite `base: '/admin/'`
  - **Socket.IO**：`io('/admin')`（`volumeStatusChanged` 受信、`toggleVolume` / `setVolume{ volume:"NN%" }` 送信）
  - **アップロード**：`POST /api/admin/upload`（`multipart/form-data`）→ 成功で `toast` と SWR `mutate('/api/admin/list')`
  - **UI/技術**：Tailwind（`clsx` + `tailwind-merge`）、Radix Slider、react-dropzone、react-hot-toast、SWR
  - **補足**：OpenAPI は `/api/v1/*` を定義 → 本番は **/api/admin ↔ /api/v1** をリバースプロキシで写像
- **入口**：[`signage-admin-ui / index`](./signage-admin-ui/index.md)

---

> ## **xignage-edge-detection**

- **目的**：エッジ側（Jetson）での**人物検知**と（将来的に）**視線推定**を低遅延に実行し、結果を JSON で外部に提供。
- **特徴**：YOLOX ラッパで**単回ロード＆キャッシュ**／`JsonWriter` による**アトミック書き込み**／`default.yaml` で**設定管理**／CLI（`scripts/run_inference.py`）／公開 API（`run_camera_loop` / `run_inference_once`）。  
  *注：OpenFace 部分は現在プレースホルダで、`gaze_vector=None`。*
- **入口**：[`xignage-edge-detection / index`](./xignage-edge-detection/index.md)
