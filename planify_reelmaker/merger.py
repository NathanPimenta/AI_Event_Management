from moviepy.editor import (
    VideoFileClip,
    CompositeVideoClip,
    vfx
)
 
# ---- Paths ----
GREENSCREEN_VIDEO = "/home/nathanpimenta/Projects/AI_Event_Management/planify_reelmaker/video/g_talking.mp4"   # foreground (with green background)
BACKGROUND_VIDEO  = "/home/nathanpimenta/Projects/AI_Event_Management/output/9.mp4"    # background video
OUTPUT_VIDEO      = "t1.mp4"

# ---- Load clips ----
fg = VideoFileClip(GREENSCREEN_VIDEO)
bg = VideoFileClip(BACKGROUND_VIDEO)

# ---- Resize foreground if needed ----
# fg = fg.resize(height=bg.h)  # optional

# ---- Remove green background (chroma key) ----
fg = fg.fx(
    vfx.mask_color,
    color=[0, 255, 0],  # green
    thr=200,             # tolerance (adjust if needed)
    s=20                 # smoothing (edge softness)
)

# ---- Position foreground ----
fg = fg.set_position(("center", "bottom"))

# ---- Match durations ----
fg = fg.set_duration(bg.duration)

# ---- Composite ----
final = CompositeVideoClip(
    [bg, fg],
    size=bg.size
)

# ---- Export ----
final.write_videofile(
    OUTPUT_VIDEO,
    codec="libx264",
    audio=False,
    fps=bg.fps
)