from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from fastapi.responses import FileResponse
from src.main import run_pipeline, OUTPUT_VIDEO_PATH

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

@app.post("/generate-reel")
async def generate_reel(request: ReelRequest):
    try:
        final_video_path = run_pipeline(drive_folder_url=request.drive_link, clip_text=request.clip_text)
        
        if not final_video_path or not os.path.exists(final_video_path):
            raise Exception("Pipeline failed to produce video")
            
        filename = os.path.basename(final_video_path)
        return {"message": "Reel generated successfully", "video_filename": filename}
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
