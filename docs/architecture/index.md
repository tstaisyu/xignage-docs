# アーキテクチャ

## North Star（道しるべ）

**目的**  

- サイネージ端末を遠隔操作・安定配信できる仕組みを、現場で再現性高く運用する。

**非目的**  

- 動画編集・大型CMSの代替そのもの／クラウド常時接続を前提とした設計。

**主要コンポーネント**  

- **Adalo モバイルアプリ**（iOS/Android）  
- **signage-aws-nodejs**：Adalo→REST受付／デバイスへWebSocket橋渡し  
- **デバイス**  
  - **signage-server**（再生制御／WS受信）  
  - **signage-admin-ui**（LAN内のローカル管理UI）  
  - **signage-jetson**（セットアップ/サービス群）  
  - **jetson-ab-flash**（A/Bフラッシュ基盤、MenderによるOTA）  
- **Edge AI on Jetson**（任意：カメラ推論＋GUI連携）

**データフロー要約**  
Adalo →（REST）→ signage-aws-nodejs →（WebSocket）→ デバイスの signage-server → 再生  
ローカル管理は signage-admin-ui へ直接アクセス。更新は Mender（OTA）で段階配信・ロールバック。

**設計原則**  

- フィールド復旧容易性（APフォールバック／A/Bロールバック／再フラッシュ手順の標準化）  
- 宣言的設定（環境変数・cloud-init・スクリプト化）  
- オフライン耐性（最低限のローカル機能維持）  
- セキュリティ最小公開（証明書・最小ポート・権限分離）

## システム構成図

- [📄 PDFで見る](system_container.pdf)

![システム構成図](system_container.png)
