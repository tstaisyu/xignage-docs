# xignage-edge-detection（Overview）

YOLOX による**人物検知**と、OpenFace ベースの**視線推定（将来対応）**を組み合わせた **Jetson 向けエッジ推論**パッケージです。  
**入力**はカメラ/URL、**出力**は最新結果を1つの JSON に**アトミック書き込み**します。

- 公開 API：`run_camera_loop(camera_id, output_json)` / `run_inference_once(frame, writers)`（`__init__.py` でエクスポート）
- 推奨環境：Jetson Orin + JetPack（CUDA/TensorRT 対応の PyTorch/TorchVision ホイール）
- ディレクトリ（抜粋）：
  `xignage_edge_detection/config/default.yaml` … 基本設定
  `xignage_edge_detection/pipeline/*` … ループ・モデル・Writer
  `xignage_edge_detection/detector/*` … YOLOX / OpenFace ラッパ
  `xignage_edge_detection/io/json_writer.py` … JSON Writer（アトミック）
  `scripts/run_inference.py` … CLI エントリ
  `requirements-*.txt` / `pyproject.toml` … 依存

**Quick Links**  

- [セットアップ](./setup.md)
- [設定](./config.md)
- [API](./api.md)
- [CLI](./cli.md)
- [Runtime & Troubleshooting](./runtime.md)
- [CI / GitHub Actions](../../ci/workflows/xignage-edge-detection/ci.md)

!!! note
    現状、`openface_wrapper.py` のモデルは **プレースホルダ**実装です（視線推定は無効化／`None` 返却）。
