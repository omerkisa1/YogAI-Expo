#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/assets/mediapipe"
mkdir -p "$DEST"
curl -fsSL -o "$DEST/hand_landmarker.task" \
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
curl -fsSL -o "$DEST/pose_landmarker_full.task" \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
cp -f "$DEST/hand_landmarker.task" "$ROOT/assets/hand_landmarker.task"
echo "Saved hand_landmarker.task and pose_landmarker_full.task to $DEST"
echo "Copied hand_landmarker.task to assets/ for Android prebuild"
