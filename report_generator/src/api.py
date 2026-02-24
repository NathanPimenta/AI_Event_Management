import sys
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import shutil
import os
import json
import uuid
import subprocess
import csv

# Add the src directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

app = FastAPI(title="Event Report Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT_DIR = Path(__file__).parent.parent
app.mount("/static", StaticFiles(directory=str(ROOT_DIR)), name="static")

DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR = ROOT_DIR / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Clear data directory on startup
for file in DATA_DIR.glob('*'):
    if file.is_file():
        file.unlink()

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    html_file = ROOT_DIR / "index.html"
    if html_file.exists():
        with open(html_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    return {"message": "Frontend file not found"}

@app.post("/upload/{file_type}")
async def upload_file(file_type: str, file: UploadFile = File(...)):
    safe_name = Path(file_type).name
    file_ext = file.filename.split('.')[-1].lower() if file.filename and '.' in file.filename else ''
    
    file_path = DATA_DIR / safe_name
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    return {"message": f"Successfully uploaded {safe_name}"}

@app.post("/generate-report")
async def generate_event_report(payload: dict):
    try:
        # Load attendees from CSV if exists
        attendees_file = DATA_DIR / 'attendees.csv'
        students = []
        if attendees_file.exists():
            with open(attendees_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Look for name and branch columns (case insensitive, approximate)
                    name = row.get('Name') or row.get('name') or row.get('Student Name') or list(row.values())[0] if row else ""
                    branch = row.get('Branch') or row.get('branch') or row.get('Department') or (list(row.values())[1] if len(row) > 1 else "")
                    students.append({"name": name, "branch": branch})
        
        # Inject students into payload
        if "registration" not in payload:
            payload["registration"] = {}
        payload["registration"]["students"] = students

        # Resolve image paths to DATA_DIR
        def resolve_img(filename):
            if filename and (DATA_DIR / filename).exists():
                return str(DATA_DIR / filename)
            return ""

        inst = payload.setdefault("institute", {})
        inst["college_logo"] = resolve_img("college_logo.png")
        inst["club_logo"] = resolve_img("club_logo.png")

        images = payload.setdefault("images", {})
        
        # event photos - arbitrary number
        resolved_photos = []
        # Frontend can upload multiple photos by naming them photo1.png, photo2.png, etc.
        for i in range(1, 10):
            photo_name = f"photo{i}.png"
            if (DATA_DIR / photo_name).exists():
                resolved_photos.append(str(DATA_DIR / photo_name))
        
        if not resolved_photos:
            # check what the user sent
            for p in images.get("event_photos", []):
                if (DATA_DIR / p).exists():
                    resolved_photos.append(str(DATA_DIR / p))
                
        images["event_photos"] = resolved_photos
        images["feedback_image"] = resolve_img("feedback_image.png")
        images["poster_image"] = resolve_img("poster_image.png")

        # Save payload to json
        unique_id = str(uuid.uuid4())[:8]
        report_data_path = DATA_DIR / f"report_data_{unique_id}.json"
        
        with open(report_data_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)

        output_pdf = OUTPUT_DIR / f"event_report_{unique_id}.pdf"
        
        # Call generate_report.py
        script_path = ROOT_DIR / "src" / "generate_report.py"
        
        process = subprocess.run(
            [sys.executable, str(script_path), "--data", str(report_data_path), "--output", str(output_pdf)],
            capture_output=True, text=True
        )

        if process.returncode != 0:
            print("=== LaTeX Error ===")
            print(process.stdout)
            print(process.stderr)
            raise HTTPException(status_code=500, detail="LaTeX compilation failed. Required packages might be missing.")

        return {
            "message": "Report generated successfully",
            "pdf_url": f"/download-report/pdf?filename=event_report_{unique_id}.pdf"
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
    report_path = ROOT_DIR / "output" / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found.")

    return FileResponse(
        path=report_path,
        media_type="application/pdf",
        filename=filename
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)