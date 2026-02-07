import sys
import numpy as np
from rembg import remove
from PIL import Image
from moviepy.editor import VideoFileClip


def process_video(input_path, output_path):
    print(f"[INFO] Processing: {input_path} -> {output_path}")

    # Load video (no audio needed)
    clip = VideoFileClip(input_path, audio=False)

    # -------------------------------------------------
    # 1. Dimension safeguard (VP9 + alpha needs even dims)
    # -------------------------------------------------
    w, h = clip.size
    new_w = w if w % 2 == 0 else w - 1
    new_h = h if h % 2 == 0 else h - 1

    if (new_w, new_h) != (w, h):
        print(f"[INFO] Resizing {w}x{h} → {new_w}x{new_h}")
        clip = clip.resize(newsize=(new_w, new_h))

    # -------------------------------------------------
    # 2. Frame-wise background removal
    # -------------------------------------------------
    def remove_bg(frame):
        """
        frame: RGB numpy array (H, W, 3)
        returns: RGBA numpy array (H, W, 4)
        """

        # Convert to PIL (cleans weird stride/layout issues)
        pil_img = Image.fromarray(frame, mode="RGB")

        # rembg → RGBA PIL Image
        out = remove(pil_img)

        # Back to numpy
        arr = np.array(out)

        # IMPORTANT: force contiguous memory (fixes diagonal artifacts)
        return np.ascontiguousarray(arr)

    # Apply background removal
    new_clip = clip.fl_image(remove_bg)

    # -------------------------------------------------
    # 3. Export with alpha channel
    # -------------------------------------------------
    new_clip.write_videofile(
        output_path,
        codec="libvpx-vp9",
        fps=clip.fps,
        audio=False,
        preset="ultrafast",
        ffmpeg_params=[
            "-pix_fmt", "yuva420p",
            "-auto-alt-ref", "0"   # prevents VP9 alpha bugs
        ],
        logger="bar"
    )

    print("[DONE] Transparent video generated successfully")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg_video.py <input_video> <output.webm>")
        sys.exit(1)

    process_video(sys.argv[1], sys.argv[2])
