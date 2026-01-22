"""YOLO-based layout analysis with heuristic scoring.

This module provides `analyze_layout(image_path, yolo_model=None, face_detector=None)` which
returns a layout score in [0.0, 1.0] and a list of detections. The implementation tries to use
Ultralytics YOLO if available for general object/person detection and OpenCV Haar cascades for
face detection as a lightweight fallback.

Heuristics used for `layout_score`:
- Reward presence of faces and persons
- Reward centered subjects
- Penalize bounding boxes near image edges
- Penalize strong occlusion (high IoU between person boxes)

The module is defensive and will return a neutral score when detectors are unavailable.
"""
from typing import Dict, Optional, List
import numpy as np
from PIL import Image

# Optional imports
try:
    from ultralytics import YOLO
    _HAS_ULTRALYTICS = True
except Exception:
    _HAS_ULTRALYTICS = False

try:
    import cv2
    _HAS_CV2 = True
except Exception:
    _HAS_CV2 = False


def _iou(boxA: np.ndarray, boxB: np.ndarray) -> float:
    # boxes are [x1, y1, x2, y2]
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interW = max(0, xB - xA)
    interH = max(0, yB - yA)
    interArea = interW * interH
    boxAArea = max(0, boxA[2] - boxA[0]) * max(0, boxA[3] - boxA[1])
    boxBArea = max(0, boxB[2] - boxB[0]) * max(0, boxB[3] - boxB[1])
    denom = boxAArea + boxBArea - interArea
    if denom <= 0:
        return 0.0
    return float(interArea / denom)


def _center_distance_norm(box: np.ndarray, img_w: int, img_h: int) -> float:
    cx = (box[0] + box[2]) / 2.0
    cy = (box[1] + box[3]) / 2.0
    dx = abs(cx - img_w / 2.0) / (img_w / 2.0)
    dy = abs(cy - img_h / 2.0) / (img_h / 2.0)
    # normalized distance in [0, sqrt(2)] -> map to [0,1] with 1 at center
    dist = np.sqrt(dx * dx + dy * dy) / np.sqrt(2)
    return float(1.0 - np.clip(dist, 0.0, 1.0))


def load_yolo(model_path: str = "yolov8n.pt"):
    if not _HAS_ULTRALYTICS:
        raise RuntimeError("Ultralytics YOLO not available. Install `ultralytics` to enable YOLO detection.")
    return YOLO(model_path)


def _detect_faces_cv2(image_path: str) -> List[Dict]:
    """Return list of face detections using OpenCV Haar cascade.

    Each detection is dict: {"class": "face", "conf": 1.0, "bbox": [x1,y1,x2,y2]}
    """
    if not _HAS_CV2:
        return []
    img = cv2.imread(image_path)
    if img is None:
        return []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    out = []
    for (x, y, w, h) in faces:
        out.append({"class": "face", "conf": 1.0, "bbox": [float(x), float(y), float(x + w), float(y + h)]})
    return out


def analyze_layout(image_path: str, yolo_model: Optional[object] = None, face_detector: Optional[object] = None) -> Dict[str, object]:
    """Analyze layout and return a heuristic layout score and detections.

    Args:
        image_path: path to image
        yolo_model: optional Ultraytics YOLO model object (if not provided, will attempt to load default model when available)
        face_detector: reserved for future use (e.g., DNN face models)

    Returns:
        {"layout_score": float, "detections": [ {class, conf, bbox} ] }
    """
    detections = []

    # Try YOLO for general detections (person/objects)
    w = h = None
    try:
        pil = Image.open(image_path)
        w, h = pil.size
    except Exception:
        return {"layout_score": 0.5, "detections": []}

    if _HAS_ULTRALYTICS:
        try:
            if yolo_model is None:
                yolo_model = load_yolo()
            res = yolo_model(image_path)[0]
            # iteration over boxes
            boxes = getattr(res, "boxes", None)
            if boxes is not None:
                xyxy = boxes.xyxy.cpu().numpy() if hasattr(boxes.xyxy, "cpu") else np.array(boxes.xyxy)
                confs = boxes.conf.cpu().numpy() if hasattr(boxes.conf, "cpu") else np.array(boxes.conf)
                cls = boxes.cls.cpu().numpy() if hasattr(boxes.cls, "cpu") else np.array(boxes.cls)
                names = yolo_model.model.names if hasattr(yolo_model, "model") and hasattr(yolo_model.model, "names") else {}
                for i in range(len(xyxy)):
                    c = int(cls[i]) if len(cls) > 0 else -1
                    cls_name = names.get(c, str(c)) if isinstance(names, dict) else str(c)
                    detections.append({"class": cls_name, "conf": float(confs[i]), "bbox": [float(v) for v in xyxy[i]]})
        except Exception:
            # swallow and fallback to CV2 face detector
            pass

    # Faces: try cv2
    faces = _detect_faces_cv2(image_path)
    if faces:
        detections.extend(faces)

    # Heuristic scoring
    # Basic features
    has_face = any(d.get("class") == "face" for d in detections)
    person_boxes = [np.array(d["bbox"]) for d in detections if str(d.get("class")).lower() in ("person", "people")]
    face_boxes = [np.array(d["bbox"]) for d in detections if d.get("class") == "face"]

    # Presence scores
    face_score = 0.0
    if has_face:
        # reward if faces exist and are reasonably centered
        center_scores = [_center_distance_norm(b, w, h) for b in face_boxes] if face_boxes else [0.5]
        face_score = float(np.mean(center_scores))

    person_score = 0.0
    if person_boxes:
        center_scores = [_center_distance_norm(b, w, h) for b in person_boxes]
        person_score = float(np.mean(center_scores))

    # Edge penalty: penalize boxes that touch edges (>= 5% of image)
    edge_penalty = 0.0
    margin_x = w * 0.05
    margin_y = h * 0.05
    for b in person_boxes + face_boxes:
        x1, y1, x2, y2 = b
        if x1 <= margin_x or y1 <= margin_y or x2 >= (w - margin_x) or y2 >= (h - margin_y):
            edge_penalty += 0.2
    edge_penalty = min(edge_penalty, 0.6)

    # Occlusion penalty: compute mean IoU for person boxes
    occlusion_penalty = 0.0
    if len(person_boxes) > 1:
        ious = []
        for i in range(len(person_boxes)):
            for j in range(i + 1, len(person_boxes)):
                ious.append(_iou(person_boxes[i], person_boxes[j]))
        mean_iou = float(np.mean(ious)) if ious else 0.0
        occlusion_penalty = min(0.5, mean_iou)  # larger IoU -> larger penalty

    # Compose final score
    # weights: face 0.4, person 0.3, centering combined 0.3
    score = 0.5  # neutral baseline
    score += 0.4 * face_score
    score += 0.3 * person_score
    # reduce by penalties
    score -= edge_penalty
    score -= occlusion_penalty

    score = float(np.clip(score, 0.0, 1.0))

    return {"layout_score": score, "detections": detections}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("--yolo", default=None, help="optional yolov8 weights path")
    args = parser.parse_args()
    model = None
    if args.yolo and _HAS_ULTRALYTICS:
        model = load_yolo(args.yolo)
    out = analyze_layout(args.image, yolo_model=model)
    print(out)
