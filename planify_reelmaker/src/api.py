from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import FileResponse
import os
import json
from typing import List

app = FastAPI(title="Planify Reelmaker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SlideshowRequest(BaseModel):
    drive_link: str

class CaptionReelRequest(BaseModel):
    image_paths: List[str]
    captions: List[str]

@app.post("/generate-slideshow")
async def generate_slideshow(request: SlideshowRequest):
    try:
        from src.main import generate_slideshow_images
        images = generate_slideshow_images(request.drive_link)
        
        if not images:
            raise Exception("No images found")
        
        return {"images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-reel-with-captions")
async def generate_reel_with_captions(request: CaptionReelRequest):
    try:
        from src.main import generate_reel_from_images_with_captions
        video_filename = generate_reel_from_images_with_captions(
            request.image_paths, 
            request.captions
        )
        
        if not video_filename or not os.path.exists(video_filename):
            raise Exception("Failed to generate reel")
        
        return {"video_filename": os.path.basename(video_filename)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/image/{filename}")
async def get_image(filename: str):
    # Try multiple paths
    paths_to_try = [
        os.path.join("temp_images", filename),
        filename,
        os.path.join("output", filename),
    ]
    
    for file_path in paths_to_try:
        if os.path.exists(file_path):
            return FileResponse(file_path)
    
    raise HTTPException(status_code=404, detail="Image not found")

@app.get("/download-reel/{filename}")
async def download_reel(filename: str):
    paths_to_try = [
        os.path.join("output", filename),
        os.path.join("..", "output", filename),
        filename,
    ]
    
    for file_path in paths_to_try:
        if os.path.exists(file_path):
            return FileResponse(file_path, media_type="video/mp4", filename=filename)
    
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
