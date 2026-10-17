import os
import time
import cv2
import numpy as np
from PIL import Image

def process():
    start = time.time()
    cap = cv2.VideoCapture('video3.mp4')
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    frame_duration = int(round(1000.0 / fps))
    print(f'Starting processing video3.mp4 ({total_frames} frames at {fps:.1f} FPS)...')

    target_bgr = np.array([44, 215, 247], dtype=np.float32)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5))

    frames = []
    count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        count += 1

        # Resize to 640x360 (optimal web quality)
        small = cv2.resize(frame, (640, 360), interpolation=cv2.INTER_AREA)

        # Distance to yellow chroma in BGR
        diff = small.astype(np.float32) - target_bgr
        dist = np.sqrt(np.sum(diff**2, axis=2))

        # Smooth alpha feathering
        alpha = np.clip((dist - 35.0) / 35.0, 0.0, 1.0)

        # Edge choke to eliminate yellow outline
        alpha_eroded = cv2.erode(alpha, kernel, iterations=1)
        alpha_final = np.minimum(alpha, alpha_eroded * 0.7 + alpha * 0.3)
        alpha_final = np.clip(np.power(alpha_final, 1.3), 0.0, 1.0)

        # Remove thin floor line at bottom (in 360p height, y > 328)
        fg_binary = (dist > 35).astype(np.uint8)
        fg_vert = cv2.morphologyEx(fg_binary, cv2.MORPH_OPEN, vert_kernel)
        is_floor_line = (fg_binary == 1) & (fg_vert == 0) & (np.arange(small.shape[0])[:, None] > 328)
        alpha_final[is_floor_line] = 0.0

        # Color despill on semi-transparent edge pixels
        b = small[:, :, 0].astype(np.float32)
        g = small[:, :, 1].astype(np.float32)
        r = small[:, :, 2].astype(np.float32)

        edge_mask = (alpha_final > 0.0) & (alpha_final < 0.96)
        excess_yellow = np.maximum(0.0, np.minimum(r, g) - b)
        new_r = np.where(edge_mask, np.maximum(0.0, r - excess_yellow * alpha_final), r)
        new_g = np.where(edge_mask, np.maximum(0.0, g - excess_yellow * alpha_final), g)
        new_b = b.copy()

        res = np.stack([new_b, new_g, new_r], axis=2)

        rgba = cv2.cvtColor(np.clip(res, 0, 255).astype(np.uint8), cv2.COLOR_BGR2RGBA)
        rgba[:, :, 3] = (alpha_final * 255).astype(np.uint8)

        frames.append(Image.fromarray(rgba))

        if count % 60 == 0:
            print(f'Processed {count}/{total_frames} frames...')

    cap.release()
    print(f'Processed all {count} frames in {time.time()-start:.2f}s. Encoding video3.webp...')

    save_start = time.time()
    frames[0].save(
        'video3.webp',
        save_all=True,
        append_images=frames[1:],
        duration=frame_duration,
        loop=0,
        quality=78,
        method=4
    )
    sz = os.path.getsize('video3.webp') / (1024 * 1024)
    print(f'Done in {time.time()-save_start:.2f}s! video3.webp size: {sz:.2f} MB')

if __name__ == '__main__':
    process()
