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

try:
    from weasyprint import HTML, CSS
except ImportError as e:
    raise ImportError(
        "Missing dependency 'weasyprint'. It has system dependencies (cairo/pango). Install via `pip install -r report_generator/requirements.txt` and refer to WeasyPrint docs if installation fails."
    ) from e

# Add the src directory to Python path
sys.path.append(str(Path(__file__).parent))

from data_ingestor import load_data
from main import EventReportGenerator, EventReportConfig
from docx_generator import MissingTemplateAsset, MissingTemplatePlaceholder

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
    use_custom_template: bool = False  # Added mapping for frontend request

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
    'custom_template.tex': {'type': 'tex', 'required': False},  # Added template support
    'custom_template.docx': {'type': 'docx', 'required': False},
    'poster.png': {'type': 'image', 'required': False}, # Normalized name for uploads
    'snapshot.png': {'type': 'image', 'required': False} # Normalized name for uploads
}

@app.post("/upload/{file_type}")
async def upload_file(file_type: str, file: UploadFile = File(...)):
    """
    Handle file uploads for different data types. Accepts the predefined required files
    or common image extensions for template assets (png/jpg/gif).
    """
    # Basic sanitization: only accept a simple filename (no paths)
    safe_name = Path(file_type).name
    if safe_name != file_type or ".." in file_type or "/" in file_type:
        raise HTTPException(status_code=400, detail=f"Invalid file name: {file_type}")

    # Determine file extension
    file_ext = file.filename.split('.')[-1].lower() if file.filename and '.' in file.filename else ''

    allowed_exts = {'csv', 'json', 'tex', 'docx', 'png', 'jpg', 'jpeg', 'gif'}

    if file_type in REQUIRED_FILES:
        expected_type = REQUIRED_FILES[file_type]['type']
        if expected_type == 'image':
             if file_ext not in ['png', 'jpg', 'jpeg']:
                 raise HTTPException(status_code=400, detail=f"Invalid image format. Expected png/jpg/jpeg, got {file_ext}")
        elif file_ext != expected_type:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file extension. Expected {expected_type}, got {file_ext}"
            )
    else:
        # Accept image uploads or other supported extensions
        if file_ext not in allowed_exts:
            raise HTTPException(status_code=400, detail=f"Unsupported file extension: {file_ext}")

    # Determine safe filename for saving
    save_name = safe_name
    
    # Check if this is a known image type like 'poster.png' or 'snapshot.png'
    # The frontend might send 'poster' or 'poster.jpg' -> we want to normalize logically if possible, 
    # OR we just rely on the frontend sending 'poster.png' as the path param even if the file is jpg.
    # Current frontend sends logical name as path param.
    # But let's respect the extension from the actual uploaded file for images to be safe.
    
    if file_type in ['poster.png', 'snapshot.png']:
         actual_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'png'
         # Force save as poster.png or snapshot.png regardless of extension? 
         # Or save as poster.jpg and update main.py to look for both?
         # Simpler: Save as the requested logical name (e.g. poster.png) but we must Ensure it is a valid image.
         # The 'type': 'image' check above ensures extension is valid.
         # Let's save as the `file_type` provided in URL for consistency with MAIN.PY expectations.
         pass

    # Save the uploaded file
    file_path = DATA_DIR / save_name
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return {"message": f"Successfully uploaded {safe_name}"}

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
        
        # Check for custom template
        custom_template_path = None
        if request.use_custom_template:
            potential_path_tex = DATA_DIR / "custom_template.tex"
            potential_path_docx = DATA_DIR / "custom_template.docx"
            
            if potential_path_docx.exists():
                 custom_template_path = potential_path_docx
            elif potential_path_tex.exists():
                custom_template_path = potential_path_tex

        config = EventReportConfig(
            event_name=request.event_name,
            event_type=request.event_type,
            institution_name=request.institution_name,
            ollama_model=request.ollama_model,
            generate_ai_recommendations=request.generate_ai_recommendations,
            report_filename=report_filename,
            custom_template_path=custom_template_path
        )
        
        generator = EventReportGenerator(config)
        try:
            success = generator.generate()
        except MissingTemplateAsset as e:
            # Return helpful payload describing the missing assets and directives
            def suggest_filename(marker: str, idx: int) -> str:
                m = marker.lower()
                if 'logo' in m:
                    return 'logo.png'
                if 'poster' in m:
                    return 'poster.png'
                if 'snapshot' in m:
                    return 'snapshot.png'
                if 'feedback' in m or 'ratings' in m:
                    return 'ratings_chart.png'
                return f'report_image_{idx + 1}.png'

            details = [{
                'marker': m['marker'],
                'directives': m.get('directives', {}),
                'suggested_filename': suggest_filename(m['marker'], i)
            } for i, m in enumerate(e.missing_assets)]
            raise HTTPException(status_code=400, detail={
                'error': 'missing_template_assets',
                'missing_assets': details
            })
        except MissingTemplatePlaceholder as e:
            raise HTTPException(status_code=400, detail={
                'error': 'missing_placeholders',
                'placeholders': e.missing_placeholders
            })

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
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report: {str(e)}"
        )

@app.get("/download-report/pdf")
async def download_pdf_report(filename: str):
    """
    Converts a specified markdown report to a PDF and serves it for download.
    """
    if not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Invalid filename format.")
        
    report_path = ROOT_DIR / "output" / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found.")

    with open(report_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Convert Markdown to HTML
    html_content = markdown2.markdown(md_content, extras=["fenced-code-blocks", "tables"])
    
    # Simple CSS for styling the PDF
    pdf_css = """
    @page { size: A4; margin: 2cm; }
    body { font-family: 'Helvetica', sans-serif; line-height: 1.6; color: #333; }
    h1, h2, h3 { color: #0d1117; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
    h1 { font-size: 24pt; }
    h2 { font-size: 18pt; }
    img { max-width: 100%; height: auto; border-radius: 5px; margin: 1em 0; }
    ul { padding-left: 20px; }
    """
    
    # Convert HTML to PDF in memory - fix for relative image paths if any
    pdf_file = HTML(string=html_content, base_url=str(ROOT_DIR / "output")).write_pdf(stylesheets=[CSS(string=pdf_css)])
    
    pdf_stream = io.BytesIO(pdf_file)
    
    pdf_filename = filename.replace('.md', '.pdf')
    
    return StreamingResponse(
        pdf_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={pdf_filename}"}
    )

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
    # Changed port to 8003 to match frontend
    uvicorn.run(app, host="127.0.0.1", port=8003)