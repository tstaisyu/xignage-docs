# 設定（YAML）

既定の設定：`xignage_edge_detection/config/default.yaml`  

```yaml
model:
  yolox:
    weights: models/yolox_s.pth
    conf_threshold: 0.30
    nms_threshold: 0.45
    input_size: [640, 640]
  openface:
    weights: models/openface.pth
    face_detector: dlib

processing:
  camera_id: 0
  output_json: detection_result.json

logging:
  level: INFO
```

## **キー仕様**

- `model.yolox.*`：YOLOX の重み/閾値/入力解像度（`yolox_s` を前提）
- `model.openface.*`：視線推定（**現状は未使用**）
- `processing.camera_id`：整数（デバイスID）または RTSP/HTTP URL
- `processing.output_json`：結果 JSON の出力先
- `logging.level`：`DEBUG|INFO|WARNING|ERROR`

!!! tip
    `python -m xignage_edge_detection.main --config <path/to.yaml>` で YAML を差し替えられます。
