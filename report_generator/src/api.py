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

        # Resolve image paths to DATA_DIR with comprehensive validation
        def resolve_img(filename_base_names: list):
            """Given a list of base names (without extension), look for any matching image"""
            valid_extensions = ['.png', '.jpg', '.jpeg']
            for base_name in filename_base_names:
                for ext in valid_extensions:
                    filename = f"{base_name}{ext}"
                    path = DATA_DIR / filename
                    if path.exists():
                        result = str(path)
                        print(f"✅ Image found: {filename} → {result}")
                        return result
            # Try matching exactly what was passed in case it has an extension already
            for base_name in filename_base_names:
                if any(base_name.endswith(ext) for ext in valid_extensions):
                    path = DATA_DIR / base_name
                    if path.exists():
                        result = str(path)
                        print(f"✅ Image found: {base_name} → {result}")
                        return result
            print(f"⚠️  Image not found for any of: {filename_base_names}")
            return ""

        inst = payload.setdefault("institute", {})
        
        # Handle college logo - check multiple possible names
        college_logo = resolve_img(["college_logo", "logo"])
        inst["college_logo"] = college_logo
        print(f"College logo resolved to: {college_logo}")
        
        inst["club_logo"] = resolve_img(["club_logo"])

        images = payload.setdefault("images", {})
        
        # event photos - check for multiple photos uploaded by name
        resolved_photos = []
        valid_extensions = ['.png', '.jpg', '.jpeg']
        # Frontend can upload multiple photos by naming them photo1.png, photo2.jpg, etc.
        for i in range(1, 10):
            photo_base = f"photo{i}"
            found_photo = False
            for ext in valid_extensions:
                photo_name = f"{photo_base}{ext}"
                photo_path = DATA_DIR / photo_name
                if photo_path.exists():
                    full_path = str(photo_path)
                    resolved_photos.append(full_path)
                    print(f"✅ Photo {i} found: {full_path}")
                    found_photo = True
                    break
            
            # Also check report_image_X
            if not found_photo:
                report_img_base = f"report_image_{i}"
                for ext in valid_extensions:
                    photo_name = f"{report_img_base}{ext}"
                    photo_path = DATA_DIR / photo_name
                    if photo_path.exists():
                        full_path = str(photo_path)
                        resolved_photos.append(full_path)
                        print(f"✅ Photo {i} found (as report_image): {full_path}")
                        found_photo = True
                        break

        if not resolved_photos:
            print("⚠️  No photos found by standard naming convention")
            # check what the user may have sent in the payload
            for p in images.get("event_photos", []):
                if (DATA_DIR / p).exists():
                    resolved_photos.append(str(DATA_DIR / p))
        
        print(f"📸 Total photos resolved: {len(resolved_photos)}")
        images["event_photos"] = resolved_photos
        
        # Handle feedback and poster images - check multiple names
        feedback_img = resolve_img(["feedback_image", "snapshot", "feedback"])
        images["feedback_image"] = feedback_img
        
        poster_img = resolve_img(["poster_image", "poster"])
        images["poster_image"] = poster_img

        # Save payload to json
        unique_id = str(uuid.uuid4())[:8]
        report_data_path = DATA_DIR / f"report_data_{unique_id}.json"
        
        with open(report_data_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)

        output_docx = OUTPUT_DIR / f"event_report_{unique_id}.docx"
        
        # Call docx generation via src.main
        script_path = ROOT_DIR / "src" / "main.py"
        
        # We can pass custom arguments to the generation script
        # However, looking at src.main.py, it takes some effort to just pass JSON.
        # Wait, verify_docx.py uses EventReportGenerator from src.main directly.
        # Let's import it and run it.
        
        from src.main import EventReportGenerator, EventReportConfig
        
        config = EventReportConfig(
            event_name=payload.get("event_meta", {}).get("title", "Event"),
            event_type=payload.get("event_meta", {}).get("event_type", ""),
            department_name=payload.get("event_meta", {}).get("department_name", ""),
            event_title=payload.get("event_meta", {}).get("title", ""),
            event_date=payload.get("event_meta", {}).get("date", ""),
            event_time=payload.get("event_meta", {}).get("time", ""),
            event_venue=payload.get("event_meta", {}).get("venue", ""),
            target_audience=payload.get("participants", {}).get("target_audience", ""),
            dbit_students_count=str(payload.get("registration", {}).get("dbit_students", 0)),
            non_dbit_students_count=str(payload.get("registration", {}).get("non_dbit_students", 0)),
            resource_person_name=payload.get("organizers", {}).get("resource_person", ""),
            resource_person_org=payload.get("organizers", {}).get("resource_org", ""),
            organizing_body=payload.get("organizers", {}).get("organizing_body", ""),
            faculty_coordinator=payload.get("organizers", {}).get("faculty_coordinator", ""),
            detailed_description=payload.get("content", {}).get("detailed_report", ""),
            facebook_link=payload.get("social_media", {}).get("facebook", ""),
            instagram_link=payload.get("social_media", {}).get("instagram", ""),
            linkedin_link=payload.get("social_media", {}).get("linkedin", ""),
            approver_1_name=payload.get("signatories", {}).get("approved_name", ""),
            approver_1_post=payload.get("signatories", {}).get("approved_post", ""),
            preparer_1_name=payload.get("signatories", {}).get("prepared_name", ""),
            preparer_1_post=payload.get("signatories", {}).get("prepared_post", ""),
            # We must specify docx generation config
            report_filename=f"event_report_{unique_id}.docx",
            output_dir=OUTPUT_DIR
        )
        
        # Manually extract objectives and outcomes lists into config if possible.
        # EventReportConfig expects objective_1, objective_2, etc.
        objectives = payload.get("content", {}).get("objectives", [])
        if len(objectives) > 0: config.objective_1 = objectives[0]
        if len(objectives) > 1: config.objective_2 = objectives[1]
        if len(objectives) > 2: config.objective_3 = objectives[2]
        
        outcomes = payload.get("content", {}).get("outcomes", [])
        if len(outcomes) > 0: config.outcome_1 = outcomes[0]
        if len(outcomes) > 1: config.outcome_2 = outcomes[1]
        if len(outcomes) > 2: config.outcome_3 = outcomes[2]
        
        generator = EventReportGenerator(config)
        
        # Override data loading directly rather than relying on json dumps 
        # so that it uses the exact resolved payload.
        # But `EventReportGenerator.generate()` calls `self._load_event_data()` which reads from globals. 
        # Since it uses data_ingestor, it will reload whatever is in `data/`.
        # To make it use our JSON exactly, we should either bypass it or let it run normally since we saved `report_data_{id}.json`.
        # But wait, data_ingestor reads attendees.csv, feedback.csv, etc directly.
        # Let's just generate it (it will run AI analytics)
        success = generator.generate()

        if not success:
            raise HTTPException(status_code=500, detail="Report generation failed.")

        return {
            "message": "Report generated successfully",
            "pdf_url": f"/download-report/docx?filename=event_report_{unique_id}.docx"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report: {str(e)}"
        )

@app.get("/download-report/docx")
async def download_docx_report(filename: str):
    report_path = ROOT_DIR / "output" / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report file not found.")

    return FileResponse(
        path=report_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)