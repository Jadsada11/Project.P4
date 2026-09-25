import os
import io
import time
import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from PIL import Image
import cv2

logger = logging.getLogger("yolo_service")

# Global model cache
_yunet_detector = None
_yolo_pose_model = None
_yolo_general_model = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
YUNET_MODEL_PATH = os.path.join(BASE_DIR, "yunet.onnx")
POSE_MODEL_PATH = os.path.join(BASE_DIR, "yolov8n-pose.pt")
GENERAL_MODEL_PATH = os.path.join(BASE_DIR, "yolov8n.pt")

# COCO animal class IDs in standard YOLOv8
# 14: bird, 15: cat, 16: dog, 17: horse, 18: sheep, 19: cow, 20: elephant, 21: bear, 22: zebra, 23: giraffe
ANIMAL_CLASS_IDS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23]


def get_yunet_detector():
    """
    Lazily load OpenCV Deep Learning Human Face Detector (YuNet ONNX).
    Specialized for human faces and 5 facial landmarks (Eyes, Nose, Mouth corners).
    Does NOT detect animals or non-human objects.
    """
    global _yunet_detector
    if _yunet_detector is None:
        try:
            if os.path.exists(YUNET_MODEL_PATH):
                _yunet_detector = cv2.FaceDetectorYN.create(
                    model=YUNET_MODEL_PATH,
                    config="",
                    input_size=(640, 480),
                    score_threshold=0.55,
                    nms_threshold=0.3,
                    top_k=5000,
                )
                logger.info(f"OpenCV YuNet face detector loaded successfully from {YUNET_MODEL_PATH}")
            else:
                logger.warning(f"YuNet model not found at {YUNET_MODEL_PATH}")
                _yunet_detector = None
        except Exception as e:
            logger.error(f"Failed to load YuNet face detector: {e}")
            _yunet_detector = None
    return _yunet_detector


def get_yolo_pose_model():
    """Lazily load Ultralytics YOLOv8-pose model for secondary human anatomy & face keypoints."""
    global _yolo_pose_model
    if _yolo_pose_model is None:
        try:
            from ultralytics import YOLO
            target_weights = POSE_MODEL_PATH if os.path.exists(POSE_MODEL_PATH) else "yolov8n-pose.pt"
            logger.info(f"Loading YOLOv8-pose model from {target_weights}...")
            _yolo_pose_model = YOLO(target_weights)
            logger.info("YOLOv8-pose model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load YOLO pose model: {e}")
            _yolo_pose_model = None
    return _yolo_pose_model


def get_yolo_model():
    """Lazily load Ultralytics YOLOv8 general model for animal exclusion and scene analysis."""
    global _yolo_general_model
    if _yolo_general_model is None:
        try:
            from ultralytics import YOLO
            target_weights = GENERAL_MODEL_PATH if os.path.exists(GENERAL_MODEL_PATH) else "yolov8n.pt"
            _yolo_general_model = YOLO(target_weights)
        except Exception as e:
            logger.error(f"Failed to load general YOLO model: {e}")
            _yolo_general_model = None
    return _yolo_general_model


def bytes_to_image(image_bytes: bytes) -> Optional[np.ndarray]:
    """Convert raw image bytes to an OpenCV/Numpy RGB image."""
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return np.array(image)
    except Exception as e:
        logger.error(f"Error decoding image bytes: {e}")
        return None


def is_valid_human_face_geometry(landmarks: np.ndarray, box: List[int], img_w: int, img_h: int) -> Tuple[bool, str]:
    """
    Validates that detected facial landmarks strictly conform to human facial anatomy.
    Rejects animal faces (dogs, cats, pets), distorted objects, and non-faces:
      1. Eyes horizontal separation and minimum inter-ocular distance.
      2. Eye tilt angle within plausible range (<= 45 degrees).
      3. Strict vertical feature order: Eyes must be above Nose, and Nose above Mouth.
      4. Both mouth corners must be situated below the nose tip.
      5. Human biometric aspect ratio (W / H in [0.45, 1.35]).
      6. Facial bilateral symmetry between eyes and nose.
    """
    if landmarks is None or landmarks.shape != (5, 2):
        return False, "invalid_landmarks_shape"

    r_eye, l_eye, nose, r_mouth, l_mouth = landmarks
    rx, ry = float(r_eye[0]), float(r_eye[1])
    lx, ly = float(l_eye[0]), float(l_eye[1])
    nx, ny = float(nose[0]), float(nose[1])
    rmx, rmy = float(r_mouth[0]), float(r_mouth[1])
    lmx, lmy = float(l_mouth[0]), float(l_mouth[1])

    # 1. Eyes horizontal separation
    eye_dist = np.sqrt((lx - rx) ** 2 + (ly - ry) ** 2)
    if eye_dist < 12.0:
        return False, f"eyes_too_close ({eye_dist:.1f}px)"

    # 2. Eye tilt angle (within 45 degrees)
    dx = abs(lx - rx)
    dy = abs(ly - ry)
    if dx > 0 and (dy / dx) > 1.05:  # > ~46 deg
        return False, f"eyes_tilted_excessively (dy/dx={dy/dx:.2f})"

    # 3. Vertical feature order: Eyes must be above Nose, and Nose above Mouth
    eyes_y = (ry + ly) / 2.0
    mouth_y = (rmy + lmy) / 2.0
    if not (eyes_y - 4.0 <= ny <= mouth_y + 4.0):
        return False, f"invalid_vertical_order (eyes_y={eyes_y:.1f}, nose_y={ny:.1f}, mouth_y={mouth_y:.1f})"

    # 4. Both mouth corners must be below nose
    if rmy < ny - 2.0 or lmy < ny - 2.0:
        return False, "mouth_above_nose"

    # 5. Face bounding box aspect ratio
    x1, y1, x2, y2 = box
    fw = max(1, x2 - x1)
    fh = max(1, y2 - y1)
    aspect_ratio = fw / float(fh)
    if aspect_ratio < 0.45 or aspect_ratio > 1.35:
        return False, f"unnatural_aspect_ratio ({aspect_ratio:.2f})"

    # 6. Bilateral symmetry: Left eye-to-nose vs Right eye-to-nose distance ratio
    d_r_nose = np.sqrt((rx - nx) ** 2 + (ry - ny) ** 2)
    d_l_nose = np.sqrt((lx - nx) ** 2 + (ly - ny) ** 2)
    if d_r_nose > 1.0 and d_l_nose > 1.0:
        sym_ratio = d_r_nose / d_l_nose
        if sym_ratio < 0.32 or sym_ratio > 3.1:
            return False, f"asymmetrical_landmarks (ratio={sym_ratio:.2f})"

    return True, f"valid_human_face (eye_dist={eye_dist:.1f}px, ratio={aspect_ratio:.2f})"


def is_animal_in_box(image_np: np.ndarray, face_box: List[int]) -> Tuple[bool, str]:
    """
    Check if YOLO detects an animal (cat, dog, bird, horse, etc.) overlapping with the face area.
    If an animal is detected in the area, reject the face immediately.
    """
    model = get_yolo_model()
    if model is None:
        return False, "yolo_not_loaded"

    try:
        fx1, fy1, fx2, fy2 = face_box
        results = model.predict(source=image_np, classes=ANIMAL_CLASS_IDS, conf=0.35, verbose=False)
        for r in results:
            if r.boxes is not None:
                for b in r.boxes:
                    coords = b.xyxy[0].cpu().numpy().astype(int).tolist()
                    ax1, ay1, ax2, ay2 = coords
                    cls_id = int(b.cls[0].cpu().numpy())
                    cls_name = model.names.get(cls_id, "animal")

                    # Calculate Intersection Over Union (IoU) or overlap
                    inter_x1 = max(fx1, ax1)
                    inter_y1 = max(fy1, ay1)
                    inter_x2 = min(fx2, ax2)
                    inter_y2 = min(fy2, ay2)

                    if inter_x2 > inter_x1 and inter_y2 > inter_y1:
                        inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
                        face_area = (fx2 - fx1) * (fy2 - fy1)
                        overlap_ratio = inter_area / max(1.0, float(face_area))
                        if overlap_ratio > 0.20:
                            logger.info(f"Rejected detection overlapping with {cls_name} ({overlap_ratio*100:.1f}%)")
                            return True, f"animal_detected_{cls_name}"
    except Exception as e:
        logger.debug(f"Animal check skipped: {e}")

    return False, "no_animal"


def is_photo_or_spoof(
    face_bgr: np.ndarray,
    full_image_bgr: Optional[np.ndarray] = None,
    box: Optional[List[int]] = None,
) -> Tuple[bool, str]:
    """
    Advanced Anti-Spoofing & Liveness Verification:
    Rejects printed 2D pictures, paper photos, cartoons, and mobile screen displays:
      1. Minimum dimension check.
      2. Human skin chrominance in YCrCb color space.
      3. Contrast & Flatness check (rejects flat printed paper / cardboard).
      4. Screen subpixel grid & Moiré frequency pattern analysis (2D FFT).
      5. Phone bezel / rectangular border detection around the face crop.
    """
    if face_bgr is None or face_bgr.size == 0:
        return True, "empty_face_image"

    h, w = face_bgr.shape[:2]
    if h < 24 or w < 24:
        return True, f"face_crop_too_small ({w}x{h})"

    # 1. Skin Chrominance Check (YCrCb color space)
    # Human skin under normal lighting: Cr in [128, 180], Cb in [75, 132]
    ycrcb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2YCrCb)
    cr = ycrcb[:, :, 1]
    cb = ycrcb[:, :, 2]
    skin_mask = (cr >= 128) & (cr <= 180) & (cb >= 75) & (cb <= 132)
    skin_ratio = float(np.sum(skin_mask)) / float(h * w)

    # If skin chrominance is unnaturally low (e.g. grayscale photo, blueish phone screen, cartoon)
    if skin_ratio < 0.16:
        return True, f"unnatural_skin_chrominance (ratio={skin_ratio:.2f})"

    # 2. Contrast & Flatness Check
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    gray_std = float(np.std(gray))
    if gray_std < 10.0:
        return True, f"flat_photo_contrast (std={gray_std:.1f})"

    # 3. High-frequency Moiré / Screen Grid Analysis via 2D FFT
    # Phone screens and printed halftones show repetitive periodic spikes in high frequencies
    try:
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        magnitude = cv2.magnitude(dft_shift[:, :, 0], dft_shift[:, :, 1])
        mag_spec = np.log(magnitude + 1.0)

        ch, cw = h // 2, w // 2
        r_mid = max(3, min(ch, cw) // 3)
        r_high = max(6, min(ch, cw) // 2)

        y_idx, x_idx = np.ogrid[:h, :w]
        dist_from_center = np.sqrt((y_idx - ch) ** 2 + (x_idx - cw) ** 2)

        mask_mid = (dist_from_center >= r_mid) & (dist_from_center < r_high)
        mask_high = dist_from_center >= r_high

        mean_mid = np.mean(mag_spec[mask_mid]) if np.any(mask_mid) else 1.0
        mean_high = np.mean(mag_spec[mask_high]) if np.any(mask_high) else 1.0

        moire_ratio = float(mean_high) / max(float(mean_mid), 1e-4)
        if moire_ratio > 3.2:
            return True, f"screen_moire_pattern_detected (ratio={moire_ratio:.2f})"
    except Exception as e:
        logger.debug(f"FFT spoof check skipped: {e}")

    # 4. Rectangular Phone / Photo Bezel Border Detection
    # When someone holds a phone or photo card, sharp rectangular edges closely encircle the face
    if full_image_bgr is not None and box is not None:
        try:
            img_h, img_w = full_image_bgr.shape[:2]
            fx1, fy1, fx2, fy2 = box
            fw = fx2 - fx1
            fh = fy2 - fy1

            # Check region with 20% margin around face box
            margin_x = int(fw * 0.25)
            margin_y = int(fh * 0.25)
            bx1 = max(0, fx1 - margin_x)
            by1 = max(0, fy1 - margin_y)
            bx2 = min(img_w, fx2 + margin_x)
            by2 = min(img_h, fy2 + margin_y)

            border_crop = full_image_bgr[by1:by2, bx1:bx2]
            if border_crop.shape[0] > 30 and border_crop.shape[1] > 30:
                border_gray = cv2.cvtColor(border_crop, cv2.COLOR_BGR2GRAY)
                # Compute gradient magnitude
                sobelx = cv2.Sobel(border_gray, cv2.CV_64F, 1, 0, ksize=3)
                sobely = cv2.Sobel(border_gray, cv2.CV_64F, 0, 1, ksize=3)
                grad_mag = np.sqrt(sobelx**2 + sobely**2)

                # Check if sharp linear borders exist along outer boundary (screen edges)
                outer_top = np.mean(grad_mag[:margin_y, :]) if margin_y > 0 else 0
                outer_bottom = np.mean(grad_mag[-margin_y:, :]) if margin_y > 0 else 0
                outer_left = np.mean(grad_mag[:, :margin_x]) if margin_x > 0 else 0
                outer_right = np.mean(grad_mag[:, -margin_x:]) if margin_x > 0 else 0

                edge_max = max(outer_top, outer_bottom, outer_left, outer_right)
                # High edge response indicating sharp phone bezel or card frame
                if edge_max > 180.0:
                    return True, f"phone_screen_bezel_detected (edge_val={edge_max:.1f})"
        except Exception as be:
            logger.debug(f"Bezel check skipped: {be}")

    return False, f"real_human_face (skin={skin_ratio:.2f}, std={gray_std:.1f})"


def extract_face_box_from_keypoints(
    kps: np.ndarray,
    confs: np.ndarray,
    person_box: List[float],
    img_w: int,
    img_h: int,
) -> Optional[Tuple[List[int], float, np.ndarray]]:
    """
    Extract tightly-fitted human face bounding box from YOLOv8-pose keypoints.
    Keypoint indices:
      0: Nose, 1: Left Eye, 2: Right Eye, 3: Left Ear, 4: Right Ear
    Returns ([x1, y1, x2, y2], face_confidence, 5_landmarks) or None if not a valid human face.
    """
    if len(kps) < 5 or len(confs) < 5:
        return None

    nose_conf = float(confs[0])
    left_eye_conf = float(confs[1])
    right_eye_conf = float(confs[2])
    left_ear_conf = float(confs[3])
    right_ear_conf = float(confs[4])

    # A human face facing the camera MUST have nose and at least one eye detected
    has_valid_face_kps = (
        (left_eye_conf >= 0.35 and right_eye_conf >= 0.35)
        or (nose_conf >= 0.38 and (left_eye_conf >= 0.30 or right_eye_conf >= 0.30))
    )
    if not has_valid_face_kps:
        return None

    x0, y0 = float(kps[0][0]), float(kps[0][1])
    x1, y1 = float(kps[1][0]), float(kps[1][1])
    x2, y2 = float(kps[2][0]), float(kps[2][1])

    # Inter-ocular distance and eye center
    if left_eye_conf >= 0.30 and right_eye_conf >= 0.30:
        iod = np.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
        eye_cx = (x1 + x2) / 2.0
        eye_cy = (y1 + y2) / 2.0
    elif left_eye_conf >= 0.30:
        iod = np.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) * 1.5
        eye_cx = x1
        eye_cy = y1
    else:
        iod = np.sqrt((x2 - x0) ** 2 + (y2 - y0) ** 2) * 1.5
        eye_cx = x2
        eye_cy = y2

    iod = max(float(iod), 12.0)

    # Ear width if visible
    ear_w = 0.0
    if left_ear_conf >= 0.35 and right_ear_conf >= 0.35:
        ear_w = np.sqrt((float(kps[3][0]) - float(kps[4][0])) ** 2 + (float(kps[3][1]) - float(kps[4][1])) ** 2)

    face_w = max(iod * 2.25, ear_w * 1.15)
    face_h = face_w * 1.30

    if nose_conf >= 0.35:
        fc_x = eye_cx * 0.55 + x0 * 0.45
        fc_y = eye_cy * 0.45 + y0 * 0.55
    else:
        fc_x = eye_cx
        fc_y = eye_cy + iod * 0.35

    fx1 = int(max(0, fc_x - face_w * 0.5))
    fy1 = int(max(0, fc_y - face_h * 0.48))
    fx2 = int(min(img_w, fc_x + face_w * 0.5))
    fy2 = int(min(img_h, fc_y + face_h * 0.52))

    if (fx2 - fx1) < 24 or (fy2 - fy1) < 24:
        return None

    face_conf = max(nose_conf, (left_eye_conf + right_eye_conf) / 2.0)
    
    # Synthesize 5 landmarks for geometry verification
    mouth_y = y0 + iod * 0.75
    landmarks_5 = np.array([
        [x2, y2],                 # Right Eye
        [x1, y1],                 # Left Eye
        [x0, y0],                 # Nose
        [eye_cx - iod * 0.4, mouth_y], # Right Mouth
        [eye_cx + iod * 0.4, mouth_y], # Left Mouth
    ], dtype=np.float32)

    return [fx1, fy1, fx2, fy2], face_conf, landmarks_5


def run_yolo_detection(image_np: np.ndarray) -> List[Dict[str, Any]]:
    """
    Run Deep Learning inference to detect ONLY human faces.
    - Accurately fits bounding box [x1, y1, x2, y2] to the human face.
    - Rejects animal faces (dogs, cats, pets) via dedicated human face model + anatomical landmark checks.
    - Rejects animal bodies via YOLO COCO animal detector.
    - Filters out photos, mobile phone screens, and static 2D pictures via anti-spoofing.
    - Returns [] when no real human face is found (NO fake dummy boxes!).
    """
    h, w = image_np.shape[:2]
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    detections: List[Dict[str, Any]] = []

    # =========================================================================
    # STAGE 1: Primary Human Face Detector (OpenCV YuNet ONNX)
    # =========================================================================
    yunet = get_yunet_detector()
    if yunet is not None:
        try:
            yunet.setInputSize((w, h))
            ret, faces = yunet.detect(image_bgr)
            if faces is not None and len(faces) > 0:
                for face in faces:
                    x, y, fw, fh = face[:4].astype(int)
                    score = float(face[-1])
                    landmarks = face[4:14].reshape(5, 2)

                    fx1 = int(max(0, x))
                    fy1 = int(max(0, y))
                    fx2 = int(min(w, x + fw))
                    fy2 = int(min(h, y + fh))

                    if (fx2 - fx1) < 24 or (fy2 - fy1) < 24:
                        continue

                    box_coords = [fx1, fy1, fx2, fy2]

                    # 1.1 Strictly verify human face anatomy (Rejects animal faces)
                    is_human, geom_reason = is_valid_human_face_geometry(landmarks, box_coords, w, h)
                    if not is_human:
                        logger.info(f"Rejected non-human/animal face at [{fx1},{fy1},{fx2},{fy2}]: {geom_reason}")
                        continue

                    # 1.2 Check for animal presence in box area via YOLO
                    is_animal, animal_reason = is_animal_in_box(image_np, box_coords)
                    if is_animal:
                        logger.info(f"Rejected animal detection: {animal_reason}")
                        continue

                    # 1.3 Anti-Spoofing: Filter 2D printed pictures, photos, or mobile screens
                    face_crop_bgr = image_bgr[fy1:fy2, fx1:fx2]
                    is_spoof, spoof_reason = is_photo_or_spoof(face_crop_bgr, full_image_bgr=image_bgr, box=box_coords)
                    if is_spoof:
                        logger.info(f"Filtered out picture/spoof at [{fx1},{fy1},{fx2},{fy2}]: {spoof_reason}")
                        continue

                    final_conf = round(float(score) * 100, 1)
                    detections.append({
                        "box": [fx1, fy1, fx2, fy2],
                        "confidence": final_conf,
                        "class_id": 0,
                        "class_name": "face",
                        "is_real_face": True,
                        "landmarks": {
                            "right_eye": [float(landmarks[0][0]), float(landmarks[0][1])],
                            "left_eye": [float(landmarks[1][0]), float(landmarks[1][1])],
                            "nose": [float(landmarks[2][0]), float(landmarks[2][1])],
                            "right_mouth": [float(landmarks[3][0]), float(landmarks[3][1])],
                            "left_mouth": [float(landmarks[4][0]), float(landmarks[4][1])],
                        },
                    })

                if len(detections) > 0:
                    return detections
        except Exception as ye:
            logger.error(f"YuNet face detection error: {ye}")

    # =========================================================================
    # STAGE 2: Secondary Fallback (YOLOv8-pose Human Skeleton Keypoints)
    # =========================================================================
    pose_model = get_yolo_pose_model()
    if pose_model is not None and len(detections) == 0:
        try:
            results = pose_model.predict(source=image_np, conf=0.30, verbose=False)
            for r in results:
                boxes = r.boxes
                keypoints = r.keypoints
                if boxes is not None and keypoints is not None:
                    for i in range(len(boxes)):
                        box = boxes[i]
                        person_box = box.xyxy[0].cpu().numpy().astype(int).tolist()
                        box_conf = float(box.conf[0].cpu().numpy())

                        kps_xy = keypoints.xy[i].cpu().numpy()
                        kps_conf = keypoints.conf[i].cpu().numpy()

                        face_res = extract_face_box_from_keypoints(
                            kps=kps_xy,
                            confs=kps_conf,
                            person_box=person_box,
                            img_w=w,
                            img_h=h,
                        )
                        if face_res is None:
                            continue

                        face_box, face_kp_conf, landmarks_5 = face_res
                        fx1, fy1, fx2, fy2 = face_box

                        # 2.1 Verify Human Facial Anatomy
                        is_human, geom_reason = is_valid_human_face_geometry(landmarks_5, face_box, w, h)
                        if not is_human:
                            continue

                        # 2.2 Animal check
                        is_animal, animal_reason = is_animal_in_box(image_np, face_box)
                        if is_animal:
                            continue

                        # 2.3 Anti-Spoofing & Photo Filtering
                        face_crop_bgr = image_bgr[fy1:fy2, fx1:fx2]
                        is_spoof, spoof_reason = is_photo_or_spoof(face_crop_bgr, full_image_bgr=image_bgr, box=face_box)
                        if is_spoof:
                            logger.info(f"YOLO pose filtered spoof at [{fx1},{fy1},{fx2},{fy2}]: {spoof_reason}")
                            continue

                        final_conf = round(max(box_conf, face_kp_conf) * 100, 1)
                        detections.append({
                            "box": [fx1, fy1, fx2, fy2],
                            "confidence": final_conf,
                            "class_id": 0,
                            "class_name": "face",
                            "is_real_face": True,
                        })

            if len(detections) > 0:
                return detections
        except Exception as pe:
            logger.error(f"YOLO pose predict error: {pe}")

    # Return empty list if no real human face is found (NO fake dummy boxes!)
    return []
