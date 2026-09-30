"""Cut aligned mouth patches for the web mascot's talking animation.

The pose images were generated one by one, so a blink or a different mouth
never lines up with its base pose as a whole. The face does, once it's
registered: this aligns each variant to its base by the head (SIFT +
similarity transform), refines on the feature itself (ECC), matches colour to
the base, and writes a feathered RGBA patch plus its placement.

Output: frontend/public/mascot/patch/*.webp and frontend/lib/mascotPatches.json
Usage: python design/mascot/patches.py [--preview DIR]
Needs: pip install opencv-python-headless numpy pillow
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SRC = Path(__file__).parent
ROOT = SRC.parent.parent
OUT = ROOT / "frontend" / "public" / "mascot" / "patch"
MANIFEST = ROOT / "frontend" / "lib" / "mascotPatches.json"
HEAD = (330, 150, 850, 720)  # x0, y0, x1, y1 in source pixels; the face lives here in every pose
EXPORT_SCALE = 720 / 1145  # the web stills are 720px wide

# base pose -> variant -> ellipses (cx, cy, rx, ry) the patch covers, in base-image pixels.
# The *-blink images are winks with a different face, so they don't patch cleanly.
PATCHES = {
    "speak-open": {
        "speak-half": [(655, 445, 92, 62)],
        "speak-closed": [(655, 445, 92, 62)],
    },
}


def read(name):
    return cv2.imread(str(SRC / f"{name}.png"), cv2.IMREAD_COLOR)


def head_align(base, var):
    """Similarity transform taking var onto base, fitted on the head only."""
    x0, y0, x1, y1 = HEAD
    mask = np.zeros(base.shape[:2], np.uint8)
    mask[y0:y1, x0:x1] = 255
    sift = cv2.SIFT_create(4000)
    kb, db = sift.detectAndCompute(cv2.cvtColor(base, cv2.COLOR_BGR2GRAY), mask)
    kv, dv = sift.detectAndCompute(cv2.cvtColor(var, cv2.COLOR_BGR2GRAY), mask)
    pairs = cv2.BFMatcher().knnMatch(dv, db, k=2)
    good = [p for p, q in pairs if p.distance < 0.75 * q.distance]
    src = np.float32([kv[g.queryIdx].pt for g in good])
    dst = np.float32([kb[g.trainIdx].pt for g in good])
    m, _ = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3)
    return m


def refine(base, warped, box):
    """Small euclidean correction on the feature region itself (ECC)."""
    x0, y0, x1, y1 = box
    a = cv2.cvtColor(base[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY).astype(np.float32)
    b = cv2.cvtColor(warped[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY).astype(np.float32)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(a, b, warp, cv2.MOTION_EUCLIDEAN, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), None, 5)
    except cv2.error:
        return warped  # didn't converge; keep the head alignment
    full = np.eye(3, dtype=np.float32)
    full[:2] = warp
    shift = np.array([[1, 0, -x0], [0, 1, -y0], [0, 0, 1]], np.float32)
    m = np.linalg.inv(shift) @ full @ shift
    return cv2.warpAffine(warped, m[:2], (base.shape[1], base.shape[0]), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)


def feather_mask(shape, ellipses):
    m = np.zeros(shape[:2], np.float32)
    for cx, cy, rx, ry in ellipses:
        cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 1.0, -1)
    k = int(max(r for e in ellipses for r in e[2:]) * 0.6) | 1
    return np.clip(cv2.GaussianBlur(m, (k, k), 0) * 1.35, 0, 1)


def match_colour(base, patch, mask):
    """Match the patch's mean/std to the base under the mask's soft edge, per channel."""
    ring = (mask > 0.05) & (mask < 0.6)
    out = patch.astype(np.float32)
    for c in range(3):
        b, p = base[..., c][ring].astype(np.float32), out[..., c][ring]
        out[..., c] = (out[..., c] - p.mean()) * (b.std() / max(p.std(), 1e-3)) + b.mean()
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    preview = Path(sys.argv[sys.argv.index("--preview") + 1]) if "--preview" in sys.argv else None
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for base_name, variants in PATCHES.items():
        base = read(base_name)
        H, W = base.shape[:2]
        for var_name, ellipses in variants.items():
            var = read(var_name)
            warped = cv2.warpAffine(var, head_align(base, var), (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
            x0 = max(0, min(cx - rx for cx, _, rx, _ in ellipses) - 40)
            x1 = min(W, max(cx + rx for cx, _, rx, _ in ellipses) + 40)
            y0 = max(0, min(cy - ry for _, cy, _, ry in ellipses) - 40)
            y1 = min(H, max(cy + ry for _, cy, _, ry in ellipses) + 40)
            warped = refine(base, warped, (x0, y0, x1, y1))
            mask = feather_mask(base.shape, ellipses)
            warped = match_colour(base, warped, mask)

            rgba = cv2.cvtColor(warped, cv2.COLOR_BGR2RGBA)
            rgba[..., 3] = (mask * 255).astype(np.uint8)
            crop = rgba[y0:y1, x0:x1]
            size = (round((x1 - x0) * EXPORT_SCALE), round((y1 - y0) * EXPORT_SCALE))
            Image.fromarray(crop).resize(size, Image.LANCZOS).save(OUT / f"{var_name}.webp", "WEBP", quality=88, method=6)
            # placement as % of the frame, so it scales with the mascot
            manifest.setdefault(base_name, {})[var_name] = {
                "left": round(x0 / W * 100, 3),
                "top": round(y0 / H * 100, 3),
                "width": round((x1 - x0) / W * 100, 3),
                "height": round((y1 - y0) / H * 100, 3),
            }
            if preview:
                comp = (base * (1 - mask[..., None]) + warped * mask[..., None]).astype(np.uint8)
                hx0, hy0, hx1, hy1 = HEAD
                cv2.imwrite(str(preview / f"patch-{var_name}.png"), np.hstack([base[hy0:hy1, hx0:hx1], comp[hy0:hy1, hx0:hx1]]))
            print(f"{var_name:14} on {base_name:11} {(OUT / f'{var_name}.webp').stat().st_size // 1024} KB")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
