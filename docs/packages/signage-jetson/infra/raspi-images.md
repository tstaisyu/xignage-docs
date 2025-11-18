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
| `v1.0.0` | **練習用**：純粋な Ubuntu Server 22.04 for Raspberry Pi 生イメージ（signage-jetson 未セットアップ） | `ubuntu-22.04.5-preinstalled-server-arm64+raspi` | `s3://xignage-raspi-images/ubuntu-22.04/v1.0.0/ubuntu-22.04-raspi-v1.0.0.img.xz` | `raspi-base-ubuntu22.04-v1.0.0` |

---

## 運用メモ

- このページには **「OSイメージ」単位の管理情報のみ** を記録し、実際のセットアップ手順（`setup_all.sh` など）は `signage-jetson` 側のドキュメントを参照します。
- 将来的に「共通セットアップを含んだイメージ」を作成した場合も、この表に行を追加し、  
  そのイメージに含めた `scripts/setup/NNN_*.sh` の範囲  
  対応する `signage-jetson` のタグ  
を追記していきます。
