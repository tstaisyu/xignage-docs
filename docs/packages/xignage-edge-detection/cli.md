# CLI（scripts/run_inference.py）

## **使い方**

```bash
# カメラ0 / 出力 detection_result.json
python scripts/run_inference.py

# カメラ1 / 出力を /tmp に
python scripts/run_inference.py --src 1 --out /tmp/detection.json

# RTSP/HTTP URL から
python scripts/run_inference.py --src rtsp://user:pass@ip/stream
```

## **引数**

- `--src, --cam, --camera_id`：カメラIDまたはURL（既定 `0`）
- `--out, --output_json`：出力 JSON パス（既定 `detection_result.json`）  

内部では `run_camera_loop(camera_id, output_json)`をそのまま呼び出します。  
