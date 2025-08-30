# Runtime & Troubleshooting

## **Jetson 最適化のヒント**

- **依存**：`requirements-full.txt` は Jetson 向けの CUDA/TensorRT 対応版（PyTorch/TorchVision の nv ビルド）
- **熱設計**：`sudo nvpmodel -m <mode>`、`sudo jetson_clocks` で安定化
- **パフォーマンス**：解像度（`model.yolox.input_size`）・閾値調整で FPS を確保
- **dlib**：CPU 負荷が高いので、視線推定は当面オフ（`gaze_vector=None`）

## **よくある問題**

- **カメラが開けない**：`camera_id` が誤り / 権限不足 / GStreamer の不足
- **YOLOX 重みが無い**：`models/yolox_s.pth` を配置し、`config.yaml` の `model.yolox.weights` を修正
- **OpenFace の ImportError**：現状未使用。無効化で運用可（`gaze_vector=None`）
- **JSON が更新されない**：カメラ取得失敗（ログに「Frame capture failed」）/ 書き込み権限

## **運用メモ**

- JSON は **最新状態のみ**を保持（ログ蓄積が必要ならローテーション Writer を追加）
- 監視：プロセス死活/ファイル更新時刻でヘルスチェック可能
