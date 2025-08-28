# ローカルソケット（local-socket）

端末内の **Socket.IO サーバ（ioLocal）** の接続ハンドリングと、  
ローカルUI用 **/admin ネームスペース**、および（任意）**クラウド側イベント（ioCloud）** からの音量系イベントの**相互ブリッジ**を行う。

## **概要**

- `ioLocal` の **既定ネームスペース（/）** と **`/admin`** に対し、接続/切断ログと一部イベント受け口を用意。
- `setVolume` / `toggleVolume` を **forward()** で `/`・`/admin`・`ioCloud`（あれば）へ**多方向配信**。
- `ioCloud` が与えられている場合、クラウド→ローカルの `setVolume` / `toggleVolume` を受け取り、同様に forward。

## **ネームスペース構成**

- `/`（既定）… ローカルクライアント（プレイヤ等）
- `/admin` … ローカル管理UI
- `ioCloud` … クラウド側イベントの受け口（オプション；cloud-socket 側から注入されることを想定）

## **公開関数**

### **`initLocalSocket(ioLocal, ioCloud) : void`**

- **引数**  
  `ioLocal`：Socket.IO サーバインスタンス（必須）  
  `ioCloud`：クラウド側のイベントエミッタ/Socket（任意）  
- **戻り値**：なし（副作用でハンドラを登録）
- **登録されるハンドラ**  
  `/`：`connection`（接続/切断ログ）  
  `/admin`：`connection`（接続/切断ログ）  
  =>  受信：`setVolume`・`toggleVolume` → `forward('event', payload)`  
  `ioCloud`（任意）：受信 `setVolume`・`toggleVolume` → `forward('event', payload)`  

## **イベント早見表**

| 受信元 | 受信イベント | 主なペイロード | 送出先（forward 先） | 概要 |
|---|---|---|---|---|
| `/admin` | `setVolume` | `{ volume, ... }` | `/`・`/admin`・`ioCloud?` | ローカルUIからの音量変更を全方面へ中継 |
| `/admin` | `toggleVolume` | 任意 | `/`・`/admin`・`ioCloud?` | ミュート切替等のトグルを中継 |
| `ioCloud?` | `setVolume` | `{ volume, ... }` | `/`・`/admin`・`ioCloud?` | クラウド指示の音量変更をローカルへ中継 |
| `ioCloud?` | `toggleVolume` | 任意 | `/`・`/admin`・`ioCloud?` | クラウド指示のトグルをローカルへ中継 |

> `forward(event, payload)` は **3方面**へ emit：`ioLocal.emit(event, payload)` / `adminNS.emit(event, payload)` / `ioCloud?.emit(event, payload)`

## **処理の流れ**

1) **既定NS（/）**  
   `ioLocal.on('connection', socket => { …; socket.on('disconnect', …) })`  
   現状、個別イベントは未定義（必要に応じ拡張）

2) **/admin ネームスペース**  
   `adminNS.on('connection', socket => { … })`  
   受信：`setVolume` / `toggleVolume` → `forward(...)`  
   切断ログを出力

3) **クラウド受信（任意）**  
   `ioCloud.on('setVolume' | 'toggleVolume', payload => forward(...))`

4) **forward(event, payload)**  
   `/` にブロードキャスト（`ioLocal.emit`）  
   `/admin` にブロードキャスト（`adminNS.emit`）  
   `ioCloud` があれば **逆方向にも** emit（`ioCloud.emit`）

## **メモ / 注意**

- **ループの可能性**：`ioCloud.emit()` も行うため、クラウド側で同名イベントを**そのまま再ブリッジ**するとループします。  
  解法：クラウド側で**起点フラグ**を付けて再送防止／イベント名を分離（例：`setVolume:cloud` vs `setVolume:local`）。  
- **不要な全体ブロードキャスト**：`forward()` は `/` と `/admin` の**両方に送信**します。必要に応じて **宛先を選別**する実装へ分割することを推奨。  
- **認証/認可**：現実装は**誰でも接続**できる前提。管理UI（`/admin`）は**トークン等の保護**を推奨。  
- **スロットリング**：`setVolume` が高頻度に流れる可能性があるため、**レート制限**や**デバウンス**の検討を。  
- **ログ量**：接続/切断ログは環境によって多くなる。ローテーション設定に留意。
