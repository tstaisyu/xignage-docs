# API（Pipeline / Detectors / IO / Models）

> ## **Public Entry（`__init__.py`）**

```python
from .pipeline import run_camera_loop, run_inference_once
```

> ## **Main（`main.py`）**

- `--config <yaml>` を読み込み、`run_camera_loop(camera_id, output_json)`を起動。
- ロギングレベルは YAML の `logging.level` を反映。

> ## **Pipeline（`pipeline/inference.py`）**

`run_inference_once(frame, writers) -> DetectionResult`  

- YOLOX で人物検知 → `DetectionResult` を生成 → `writers[*].write(result)`を実行
- 視線推定は現在 `None`  

`run_camera_loop(camera_id=0, output_json="detection_result.json") -> None`  

- `cv2.VideoCapture(camera_id)` でフレーム取得し、各フレームで `run_inference_once`
- Ctrl-C または取得失敗で終了
- 出力は `JsonWriter` が **アトミック**に更新  

> ## **Models（`pipeline/models.py`）**

```python
@dataclass
class BoundingBox:
    x1: int; y1: int; x2: int; y2: int; confidence: float

@dataclass
class DetectionResult:
    timestamp: datetime
    people: List[BoundingBox]
    gaze_vector: Tuple[float, float, float]  # or None
```

## **Detectors**

> ### **YOLOX（`detector/yolox_wrapper.py`）**

- `detect_people(frame, conf=0.30) -> List[BoundingBox]`
- 内部で **モデルを一度だけロード&キャッシュ**
- `yolox_s` 前提、COCO クラスID 0（person）のみ抽出

> ### **OpenFace（`detector/openface_wrapper.py`）**

- `analyze_gaze(frame) -> Tuple[float,float,float]`（**プレースホルダ**）
- `dlib` の顔検出 + ダミー `GazeLSTM` を参照（現行は呼び出していません）

!!! warning
    OpenFace 部分は将来的な実装予定です。現状のパッケージでは `gaze_vector=None` を返します。

> ## **IO（`io/json_writer.py`）**

`JsonWriter(filepath).write(result)`  

- `asdict(result)` を ISO8601 の `timestamp` で整形し、**一時ファイル→置換**で出力（アトミック）

**出力 JSON（サンプル）**  

```json
{
  "timestamp": "2025-08-30T07:12:34.567890+00:00",
  "people": [
    { "x1": 120, "y1": 80, "x2": 260, "y2": 400, "confidence": 0.91 }
  ],
  "gaze_vector": null
}
```
