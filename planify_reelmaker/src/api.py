from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
from fastapi.responses import FileResponse
from .main import run_pipeline, run_slideshow_pipeline, OUTPUT_VIDEO_PATH
from typing import List, Dict

app = FastAPI(title="Planify Reelmaker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ReelRequest(BaseModel):
    drive_link: str
    clip_text: str

class SlideshowRequest(BaseModel):
    drive_link: str

class CaptionData(BaseModel):
    image_index: int
    caption: str

class ReelWithCaptionsRequest(BaseModel):
    image_paths: List[str]
    captions: List[str]  # One caption per image
    use_chat_overlay: bool = False

@app.post("/generate-reel")
async def generate_reel(request: ReelRequest):
    try:
        result = run_pipeline(drive_folder_url=request.drive_link, clip_text=request.clip_text)
        
        if not result:
            raise Exception("Pipeline failed to produce results")
        
        # Handle new dict format
        if isinstance(result, dict):
            final_video_path = result.get("video_path")
            image_paths = result.get("image_paths", [])
        else:
            # Backward compatibility
            final_video_path = result
            image_paths = []
        
        if not final_video_path or not os.path.exists(final_video_path):
            raise Exception("Pipeline failed to produce video")
            
        filename = os.path.basename(final_video_path)
        
        # Convert full paths to just filenames for the frontend
        # The frontend will use these with the /image/{filename} endpoint
        image_filenames = [os.path.basename(path) for path in image_paths]
        
        return {
            "message": "Reel generated successfully",
            "video_filename": filename,
            "images": image_filenames
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download-reel/{filename}")
async def download_reel(filename: str):
    file_path = os.path.join("output", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="video/mp4", filename=filename)
    # Check parent output if it runs from root
    parent_file_path = os.path.join("..", "output", filename)
    if os.path.exists(parent_file_path):
        return FileResponse(parent_file_path, media_type="video/mp4", filename=filename)
        
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/generate-slideshow")
async def generate_slideshow(request: SlideshowRequest):
    """
    Generate a slideshow from images in Google Drive.
    Returns a list of image filenames that can be displayed in the frontend.
    """
    try:
        image_paths = run_slideshow_pipeline(drive_folder_url=request.drive_link)
        
        if not image_paths:
            raise Exception("Pipeline failed to generate slideshow")
        
        # Convert full paths to just filenames for the frontend
        # The frontend will use these with the /image/{filename} endpoint
        image_filenames = [os.path.basename(path) for path in image_paths]
        
        return {
            "message": "Slideshow generated successfully",
            "images": image_filenames,
            "count": len(image_filenames)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/image/{filename}")
async def get_image(filename: str):
    """
    Download an image from the slideshow.
    """
    # Handle case where filename might include path separators
    # Extract just the filename if it's a full path
    import os.path as osp
    base_filename = osp.basename(filename)
    
    # Try multiple locations - serve from served_images first (where slideshow images are saved)
    possible_paths = [
        os.path.join("served_images", base_filename),
        os.path.join("temp_images", base_filename),
        os.path.join("output", base_filename),
        os.path.join("..", "served_images", base_filename),
        os.path.join("..", "temp_images", base_filename),
        os.path.join("..", "output", base_filename),
        os.path.join("planify_reelmaker", "served_images", base_filename),
        os.path.join("planify_reelmaker", "temp_images", base_filename),
        os.path.join("planify_reelmaker", "output", base_filename),
        # Also try the full path as given
        filename,
    ]
    
    print(f"[DEBUG] Looking for image: {filename}")
    print(f"[DEBUG] Base filename: {base_filename}")
    
    for file_path in possible_paths:
        if os.path.exists(file_path):
            print(f"[DEBUG] Found image at: {file_path}")
            return FileResponse(file_path, media_type="image/jpeg")
        else:
            print(f"[DEBUG] Not found: {file_path}")
    
    print(f"[DEBUG] Image not found in any location")
    raise HTTPException(status_code=404, detail=f"Image not found: {base_filename}")

@app.post("/generate-reel-with-captions")
async def generate_reel_with_captions(request: ReelWithCaptionsRequest):
    """
    Generate a reel with captions from image paths and caption text.
    """
    try:
        if len(request.image_paths) != len(request.captions):
            raise ValueError("Number of images must match number of captions")
        
        # Resolve the actual file paths from basenames
        resolved_image_paths = []
        for basename in request.image_paths:
            base_filename = os.path.basename(basename)
            
            # Try multiple locations - check served_images first (where slideshow images are)
            possible_paths = [
                os.path.join("served_images", base_filename),
                os.path.join("temp_images", base_filename),
                os.path.join("output", base_filename),
                os.path.join("planify_reelmaker", "served_images", base_filename),
                os.path.join("planify_reelmaker", "temp_images", base_filename),
                os.path.join("planify_reelmaker", "output", base_filename),
                basename,
            ]
            
            found = False
            for file_path in possible_paths:
                if os.path.exists(file_path):
                    resolved_image_paths.append(os.path.abspath(file_path))
                    found = True
                    break
            
            if not found:
                print(f"[DEBUG] Could not find image: {base_filename} in any location")
                raise FileNotFoundError(f"Image file not found: {base_filename}")
        
        # Create a mapping of image paths to captions using indices
        captions_map = {
            resolved_image_paths[i]: request.captions[i]
            for i in range(len(resolved_image_paths))
        }
        
        from .video_generator import create_reel_with_captions
        
        final_video_path = create_reel_with_captions(
            image_paths=resolved_image_paths,
            captions_map=captions_map,
            music_path="assets/background_music.mp3",
            output_path=OUTPUT_VIDEO_PATH,
            use_chat_bubble=request.use_chat_overlay  # Use chat bubble style captions if requested
        )
        
        if not final_video_path or not os.path.exists(final_video_path):
            raise Exception("Failed to generate reel with captions")
            
        filename = os.path.basename(final_video_path)
        return {"message": "Reel with captions generated successfully", "video_filename": filename}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
