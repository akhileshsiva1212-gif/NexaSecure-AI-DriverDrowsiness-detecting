# Datasets

**No dataset files or model weights are committed to this repo** (they are large and often
license-restricted). This file records *where* to get them when you train/evaluate models.

| Feature | Suggested public dataset | Notes |
|---------|--------------------------|-------|
| Drowsiness | NTHU-DDD, or build from MediaPipe landmarks | Driver eye/yawn behavior |
| Distraction | State Farm Distracted Driver | Cabin-facing classification |
| Lane detection | TuSimple, CULane | Lane segmentation benchmarks |
| Traffic signs | GTSRB | Classic sign classification |
| Road hazards | Custom + open object-detection sets | Potholes/debris/obstacles |
| Forward collision | KITTI, BDD100K | Vehicles/pedestrians + distance |

When you download data, place it under `datasets/<name>/` (already gitignored) and add a
one-line note here. Always check each dataset's license before use.
