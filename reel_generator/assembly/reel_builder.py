"""Reel builder stub using MoviePy or ffmpeg."""
from typing import List, Dict


def build_reel(selected_images: List[Dict], output_path: str, image_display_time: float = 2.0, aspect_ratio: str = "9:16") -> str:
    """Assemble images into a reel and write to output_path.

    This is a placeholder that should call MoviePy to build the video.

    Returns:
        output_path
    """
    # TODO: implement MoviePy assembly + transitions
    with open(output_path, "wb") as f:
        f.write(b"")
    return output_path
