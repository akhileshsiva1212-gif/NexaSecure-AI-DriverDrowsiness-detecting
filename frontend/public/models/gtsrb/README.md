# GTSRB multi-class sign model (optional)

The **Multi-class** toggle on the Road Signs card loads a TensorFlow.js GTSRB classifier
(43 German Traffic Sign classes) and runs it fully on-device. Until a model is placed here,
the toggle degrades gracefully: STOP detection (via the COCO object detector) keeps working
and the card shows a friendly "model unavailable" message.

## How to add the model

1. Train or obtain a GTSRB classifier (Keras/TF). A small CNN on 48×48 RGB inputs is plenty —
   GTSRB is a classic Kaggle/benchmark dataset.
2. Convert it to TensorFlow.js Layers format:

   ```bash
   pip install tensorflowjs
   tensorflowjs_converter --input_format keras path/to/model.h5 \
       frontend/public/models/gtsrb
   ```

   This writes `model.json` + `group1-shard*.bin` into this folder.

3. Expected input: `48×48×3`, pixel values scaled to `[0, 1]`. Output: a 43-way softmax whose
   class indices follow the standard GTSRB ordering (see `signClassifier.ts` → `GTSRB_MAP`).

The classifier is loaded lazily only when the user enables Multi-class, so it never affects
the dashboard's initial load. Detection still happens entirely in the browser — no images are
uploaded.
