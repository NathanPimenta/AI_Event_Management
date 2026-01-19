import sys
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import shutil
import os
from typing import List, Optional
import json
import uuid
import io

from pydantic import BaseModel
try:
    import markdown2
except ImportError as e:
    raise ImportError(
        "Missing dependency 'markdown2'. Install project requirements: `pip install -r report_generator/requirements.txt`"
    ) from e

# WeasyPrint Handling: It relies on system libraries (Pango/Cairo) which might be missing.
# We catch both ImportError (missing package) and OSError (missing system libs).
try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError) as e:
    print(f"⚠️ PDF generation unavailable: {e}")
    WEASYPRINT_AVAILABLE = False
    HTML = None
    CSS = None

# Add the src directory to Python path
sys.path.append(str(Path(__file__).parent))

from data_ingestor import load_data
from main import EventReportGenerator, EventReportConfig

app = FastAPI(title="Event Report Generator API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the root directory for serving static files
ROOT_DIR = Path(__file__).parent.parent
app.mount("/static", StaticFiles(directory=str(ROOT_DIR)), name="static")

# Pydantic request model for report generation
class ReportRequest(BaseModel):
    event_name: str
    event_type: str
    institution_name: str
    ollama_model: str = "llama3:8b"
    generate_ai_recommendations: bool = True

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the frontend HTML file"""
    html_file = ROOT_DIR / "index.html"
    if html_file.exists():
        with open(html_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    return {"message": "Frontend file not found"}

@app.get("/api")
async def root():
    """
    Root endpoint - provides API information and available endpoints
    """
    return {
        "title": "Event Report Generator API",
        "version": "1.0.0",
        "description": "API for generating event reports from uploaded data files",
        "endpoints": {
            "GET /": "This documentation",
            "GET /files-status": "Check status of required file uploads",
            "POST /upload/{file_type}": "Upload a specific file type (attendees.csv, feedback.csv, etc.)",
            "POST /generate-report": "Generate event report from uploaded files",
            "GET /download-report/pdf?filename=<name.md>": "Download generated report as PDF"
        },
        "required_files": {
            name: info for name, info in REQUIRED_FILES.items()
        }
    }

# Create data directory if it doesn't exist
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Clear data directory on startup
for file in DATA_DIR.glob('*'):
    if file.is_file():
        file.unlink()

REQUIRED_FILES = {
    'attendees.csv': {'type': 'csv', 'required': True},
    'feedback.csv': {'type': 'csv', 'required': True},
    'crowd_analytics.json': {'type': 'json', 'required': False},
    'social_mentions.json': {'type': 'json', 'required': False},
    'custom_template.txt': {'type': 'txt', 'required': False}
}

@app.post("/upload/{file_type}")
async def upload_file(file_type: str, file: UploadFile = File(...)):
    """
    Handle file uploads for different data types
    """
    if file_type not in REQUIRED_FILES:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file_type}")
    
    # Validate file extension
    expected_type = REQUIRED_FILES[file_type]['type']
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext != expected_type:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file extension. Expected {expected_type}, got {file_ext}"
        )
    
    # Save the uploaded file
    file_path = DATA_DIR / file_type
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    return {"message": f"Successfully uploaded {file_type}"}

@app.post("/generate-report")
async def generate_event_report(request: ReportRequest):
    """
    Generate event report after files are uploaded
    """
    # Check if required files exist
    missing_files = []
    for file_name, info in REQUIRED_FILES.items():
        if info['required'] and not (DATA_DIR / file_name).exists():
            missing_files.append(file_name)
    
    if missing_files:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required files: {', '.join(missing_files)}"
        )
    
    try:
        data = load_data()
        if not data:
            raise HTTPException(status_code=500, detail="Failed to load data files")
        
        # Generate a unique suffix for the report filename
        unique_id = str(uuid.uuid4())[:8]
        report_filename = f"event_report_{unique_id}.md"

        config = EventReportConfig(
            event_name=request.event_name,
            event_type=request.event_type,
            institution_name=request.institution_name,
            ollama_model=request.ollama_model,
            generate_ai_recommendations=request.generate_ai_recommendations,
            report_filename=report_filename,
            custom_template_path=DATA_DIR / "custom_template.txt" if (DATA_DIR / "custom_template.txt").exists() else None
        )
        
        generator = EventReportGenerator(config)
        success = generator.generate()
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to generate report")
        
        # Read the generated report content
        report_path = Path(config.report_path)
        if report_path.exists():
            with open(report_path, 'r', encoding='utf-8') as f:
                report_content = f.read()
        else:
            report_content = "Report file not found"
        
        return {
            "message": "Report generated successfully",
            "report_path": str(config.report_path),
            "report_filename": report_filename,
            "content": report_content
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report: {str(e)}"
        )

from src.doc_generator import ReportToDocxConverter

@app.get("/download-report/docx")
async def download_docx_report(filename: str):
    """
    Converts a specified markdown report to DOCX and serves it for download.
    """
    if not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Invalid filename format.")
        
    report_path = ROOT_DIR / "output" / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found.")

    try:
        converter = ReportToDocxConverter(report_path, ROOT_DIR / "output")
        docx_path = converter.convert()
        
        return FileResponse(
            docx_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=docx_path.name
        )
    except Exception as e:
        print(f"Error generating DOCX: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate DOCX: {str(e)}")

# Legacy PDF endpoint (disabled)
@app.get("/download-report/pdf")
async def download_pdf_report(filename: str):
    raise HTTPException(status_code=501, detail="PDF generation is deprecated. Please use DOCX download.")

@app.get("/files-status")
async def get_files_status():
    """
    Get status of required file uploads
    """
    status = {}
    for file_name, info in REQUIRED_FILES.items():
        status[file_name] = {
            "uploaded": (DATA_DIR / file_name).exists(),
            "required": info['required']
        }
    return status

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)