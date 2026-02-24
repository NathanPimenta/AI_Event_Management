import os
import shutil
import uuid
import logging
from typing import List, Optional, Dict
from enum import Enum

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import torch
import numpy as np
import cv2
from PIL import Image

# Import existing modules
try:
    from src import intelligent_ingestor
    from src import image_scorer
    from src.pytorch_nima_model import NimaEfficientNet
except ImportError as e:
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from src import intelligent_ingestor
    from src import image_scorer
    from src.pytorch_nima_model import NimaEfficientNet

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Image Curator API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CURATED_DIR = os.path.join(BASE_DIR, "curated_output")
PYTORCH_NIMA_MODEL_PATH = os.path.join(BASE_DIR, "nima_efficientnet_b3_ava_4060.pth")

# Ensure output directory exists
os.makedirs(CURATED_DIR, exist_ok=True)

# Mount curated files to serve them
app.mount("/curated", StaticFiles(directory=CURATED_DIR), name="curated")

# Global Models Variable
MODELS = {}

# Job tracking
JOB_STATUS: Dict[str, dict] = {}

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

def load_models():
    """Load NIMA model only, as requested"""
    global MODELS
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")

    nima_model = None
    if os.path.exists(PYTORCH_NIMA_MODEL_PATH):
        try:
            nima_model = NimaEfficientNet(model_variant="efficientnet-b3")
            state_dict = torch.load(PYTORCH_NIMA_MODEL_PATH, map_location=device)
            
            # Handle DataParallel prefix
            if isinstance(state_dict, dict) and any(k.startswith("module.") for k in list(state_dict.keys())):
                state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
                
            nima_model.load_state_dict(state_dict)
            nima_model.to(device)
            nima_model.eval()
            logger.info("NIMA Model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load NIMA model: {e}")
    else:
        logger.warning(f"NIMA model file not found at {PYTORCH_NIMA_MODEL_PATH}")

    MODELS = {
        "nima_pt": nima_model,
        "device": device,
        "yolo": None, # Explicitly None as requested
        "clip": None, # Explicitly None as requested
        "clip_processor": None,
        "reel_type": "general" # Default
    }

# Load models on startup
@app.on_event("startup")
async def startup_event():
    load_models()

# Pydantic Models
class CurationRequest(BaseModel):
    drive_url: str
    num_images: int = 10

class CurationResponse(BaseModel):
    message: str
    curated_images: List[str]
    total_processed: int
    request_id: str

class JobStatusResponse(BaseModel):
    request_id: str
    status: str
    progress: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None

def run_curation_pipeline(drive_url: str, num_images: int, request_id: str) -> List[str]:
    """
    Runs the curation pipeline: Ingest -> Filter -> Dedup -> Score -> Select Top N -> Save
    """
    session_dir = os.path.join(CURATED_DIR, request_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # 1. Ingestion (Download, Quality Check, Deduplication)
    logger.info(f"Starting ingestion for {drive_url}")
    
    if not drive_url or "drive.google.com" not in drive_url:
        logger.error("Invalid Google Drive URL")
        return []

    clean_media_objects = intelligent_ingestor.run_ingestion_pipeline(
        drive_folder_url=drive_url,
        max_files=None # Fetch all images (pagination handles large folders)
    )
    
    if not clean_media_objects:
        logger.warning("No media objects processed successfully.")
        return []

    # 2. Score Images
    logger.info(f"Scoring {len(clean_media_objects)} images...")
    scored_media = []
    
    # Weightings for this specific curator module (Focus on Aesthetics/NIMA)
    W_TECH = 0.4
    W_SEM = 0.0 # Ignore semantic since no YOLO/CLIP
    W_ENG = 0.6 # High weight on NIMA (Aesthetics)
    
    for idx, media in enumerate(clean_media_objects):
        try:
            is_original = media.get('is_original_image', True)
            scores = image_scorer.get_all_scores(media['array'], MODELS, is_original)
            
            # Custom Formula for Curator
            final_score = (W_TECH * scores.get('technical_score', 0.0)) + \
                          (W_ENG  * scores.get('engagement_score', 0.0))
            
            media_entry = {
                "name": media["name"],
                "array": media["array"],
                "final_score": final_score,
                "scores": scores
            }
            scored_media.append(media_entry)
            
            # Update progress
            progress_pct = int((idx + 1) / len(clean_media_objects) * 100)
            JOB_STATUS[request_id]["progress"] = f"Scoring: {progress_pct}%"
            
        except Exception as e:
            logger.error(f"Error scoring {media.get('name')}: {e}")

    # 3. Sort and Select Top N
    scored_media.sort(key=lambda x: x["final_score"], reverse=True)
    top_media = scored_media[:num_images]
    
    output_urls = []
    
    # 4. Save to Output Directory
    for idx, item in enumerate(top_media):
        try:
            original_name = item["name"]
            safe_name = f"{idx+1}_{original_name.replace(' ', '_')}"
            if not safe_name.lower().endswith(('.jpg', '.jpeg', '.png')):
                safe_name += ".jpg"
                
            save_path = os.path.join(session_dir, safe_name)
            
            image_array = item["array"]
            img_pil = Image.fromarray(image_array)
            img_pil.save(save_path, quality=90)
            
            relative_url = f"/curated/{request_id}/{safe_name}"
            output_urls.append(relative_url)
            
        except Exception as e:
            logger.error(f"Failed to save image {item.get('name')}: {e}")
            
    return output_urls

def background_curate_task(drive_url: str, num_images: int, request_id: str):
    """Background task to process curation asynchronously"""
    try:
        JOB_STATUS[request_id]["status"] = JobStatus.PROCESSING
        JOB_STATUS[request_id]["progress"] = "Fetching images from Drive..."
        
        curated_urls = run_curation_pipeline(
            drive_url, 
            num_images, 
            request_id
        )
        
        if not curated_urls:
            JOB_STATUS[request_id]["status"] = JobStatus.FAILED
            JOB_STATUS[request_id]["error"] = "No images could be curated. Check the Drive Link or permissions."
            return

        JOB_STATUS[request_id]["status"] = JobStatus.COMPLETED
        JOB_STATUS[request_id]["result"] = {
            "message": "Curation complete",
            "curated_images": curated_urls,
            "total_processed": len(curated_urls),
            "request_id": request_id
        }
        
    except Exception as e:
        logger.error(f"Curation failed: {e}")
        import traceback
        traceback.print_exc()
        JOB_STATUS[request_id]["status"] = JobStatus.FAILED
        JOB_STATUS[request_id]["error"] = str(e)

@app.post("/curate", response_model=dict)
async def curate_images(request: CurationRequest, background_tasks: BackgroundTasks):
    """
    Endpoint to curate images from a Google Drive folder (returns immediately with request_id).
    """
    request_id = str(uuid.uuid4())
    logger.info(f"Received curation request {request_id} for {request.drive_url}")
    
    # Initialize job status
    JOB_STATUS[request_id] = {
        "status": JobStatus.PENDING,
        "progress": "Queued",
        "result": None,
        "error": None
    }
    
    # Start background processing
    background_tasks.add_task(background_curate_task, request.drive_url, request.num_images, request_id)
    
    return {
        "request_id": request_id,
        "status": "processing",
        "message": "Curation started. Poll /status/{request_id} for progress."
    }

@app.get("/status/{request_id}", response_model=JobStatusResponse)
async def get_job_status(request_id: str):
    """
    Poll the status of a curation job.
    """
    if request_id not in JOB_STATUS:
        raise HTTPException(status_code=404, detail="Request ID not found")
    
    job = JOB_STATUS[request_id]
    
    if job["status"] == JobStatus.COMPLETED:
        return JobStatusResponse(
            request_id=request_id,
            status=job["status"],
            result=job["result"]
        )
    elif job["status"] == JobStatus.FAILED:
        return JobStatusResponse(
            request_id=request_id,
            status=job["status"],
            error=job["error"]
        )
    else:
        return JobStatusResponse(
            request_id=request_id,
            status=job["status"],
            progress=job.get("progress")
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8005)
