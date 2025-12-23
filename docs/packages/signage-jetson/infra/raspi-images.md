# Raspberry Pi ベースイメージ管理

Raspberry Pi 向けの **OSベースイメージ（SDカードイメージ）** と、  
対応する **signage-jetson のタグ**・S3 上のパスをここで管理します。

!!! note "目的"
    - セットアップスクリプト `setup_all.sh` と OS イメージの対応関係を明示する
    - 「どのイメージを焼けばよいか」「どのタグと組み合わせるか」を後から辿れるようにする

---

## イメージ一覧

| イメージ版 | 用途 / 説明 | Ubuntu ベース | S3 パス | 対応 signage-jetson タグ |
| ---------- | ----------- | ------------- | ------- | ------------------------- |
| TODO | Ubuntu Server 24.04 LTS（Raspberry Pi 向け） | `ubuntu-24.04.x-preinstalled-server-arm64+raspi` | TODO | TODO |

!!! note "TODO"
    24.04 向けの実配布イメージと S3 パス、対応タグは別管理の可能性があるため確認が必要です。  
    根拠：`signage-jetson/README.md`（v2.x は 24.04 LTS を前提）。

---

## 運用メモ

- このページには **「OSイメージ」単位の管理情報のみ** を記録し、実際のセットアップ手順（`setup_all.sh` など）は `signage-jetson` 側のドキュメントを参照します。
