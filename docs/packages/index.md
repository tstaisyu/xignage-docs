# パッケージ一覧

ここでは、本プロジェクトの主要パッケージの**概要**と**ドキュメント入口**をまとめます。

## **サマリー**

| パッケージ | 役割 / 概要 | 対象 / 実行環境 | ステータス | ドキュメント |
|---|---|---|---|---|
| **signage-jetson** | Jetson / Raspberry Pi を**サイネージ端末化**するセットアップスクリプト群（ネットワーク統一、AP フォールバック、更新基盤、キオスク起動 等を冪等適用） | Ubuntu 系（Jetson L4T/Ubuntu・Ubuntu for Raspberry Pi） | **Complete** | [`packages/signage-jetson`](./signage-jetson/index.md) |
| **signage-server** | 端末上で動作する**バックエンド**。Express API、コンテンツ管理、プレイリスト、サムネイル生成、Socket 連携など | Node.js（Jetson / Raspberry Pi / Linux） | **WIP（ドキュメント整備中）** | [`developers/packages/signage-server`](./signage-server/index.md) |

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
