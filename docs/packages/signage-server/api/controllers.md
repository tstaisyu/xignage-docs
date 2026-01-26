# コントローラー（api/）

`controllers/` 配下のコントローラを 1 ページに統合して記述します。  
本ページのパス表記は **ルーターのマウント先からの相対パス**です（実際の URL は `app.use()` に依存）。

## **早見表（Routes ↔ Controllers 対応）**

| Group | Method | Path | Controller (Function) | 成功時レスポンス例 | 備考 |
| --- | --- | --- | --- | --- | --- |
| Test | GET | `/test/csi-snapshot` | `cameraController.getCsiSnapshot` | `image/jpeg` | `rpicam-jpeg` を実行 |

## **cameraController.js**

CSI カメラのスナップショットを **`rpicam-jpeg`** で取得し、`image/jpeg` としてストリーム返却します。

### **getCsiSnapshot(req, res)**

- 戻り値：`image/jpeg` ストリーム
- 失敗時：`500 { error: "CSI camera error" }`（ヘッダ送信前のみ）

> 処理の流れ

1) `rpicam-jpeg` を `spawn` し、`stdout` を `res` に pipe  
2) `stderr` は logger に流す（`logger.debug` が存在する場合）  
3) `error` 時は `500` を返す（ヘッダ送信済みなら `res.end()`）  
4) クライアント切断時は `SIGTERM` で停止

!!! note
    - `rpicam-jpeg` が未導入の場合は常に失敗します。  
    - レスポンスは **連続ストリームではなくスナップショット**です（呼び出し側でポーリング）。
