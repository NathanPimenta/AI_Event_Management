import sys
import logging
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

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

UPLOADS_DIR = ROOT_DIR / "static" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Only clear data/ on startup (non-image CSVs/JSONs); static/uploads persists across restarts
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
    
    # Use Flask server logic: save images to static/uploads/
    valid_image_exts = ['png', 'jpg', 'jpeg', 'gif', 'webp']
    if any(safe_name.lower().endswith(f".{ext}") for ext in valid_image_exts) or file_ext in valid_image_exts:
        upload_dir = ROOT_DIR / "static" / "uploads"
    else:
        upload_dir = DATA_DIR
        
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / safe_name
    
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

        # Resolve image paths to static/uploads/ with comprehensive validation
        def resolve_img(filename_base_names: list):
            """Given a list of base names (without extension), look for any matching image"""
            valid_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
            search_dir = UPLOADS_DIR

            # Try exact matches first (including extensions)
            for base_name in filename_base_names:
                if any(base_name.endswith(ext) for ext in valid_extensions):
                    path = search_dir / base_name
                    if path.exists():
                        result = str(path)
                        logger.info(f"✅ Image found (exact): {base_name} → {result}")
                        return result

            # Then try with extensions
            for base_name in filename_base_names:
                for ext in valid_extensions:
                    filename = f"{base_name}{ext}"
                    path = search_dir / filename
                    if path.exists():
                        result = str(path)
                        logger.info(f"✅ Image found: {filename} → {result}")
                        return result

            logger.warning(f"⚠️  Image not found for any of: {filename_base_names}")
            return ""

        inst = payload.setdefault("institute", {})
        
        # Hardcoded Left Logo (College Logo)
        college_logo = str(ROOT_DIR / "dbit_logo.png")
        if not os.path.exists(college_logo):
            # Fallback to the one in certificate_generator if not in report_generator root
            default_dbit = ROOT_DIR.parent / "certificate_generator" / "assets" / "logos" / "logo_original.png"
            if default_dbit.exists():
                college_logo = str(default_dbit)
        inst["college_logo"] = college_logo
        logger.info(f"Left logo (College) hardcoded to: {college_logo}")
        
        # User-uploaded Right Logo (Club Logo)
        club_logo = resolve_img(["club_logo", "logo"])
        if not club_logo:
            # Fallback to default dummy logo if nothing uploaded
            default_club = ROOT_DIR.parent / "certificate_generator" / "assets" / "logos" / "dummy_logo.png"
            if default_club.exists():
                club_logo = str(default_club)
        inst["club_logo"] = club_logo
        logger.info(f"Right logo (Club) resolved to: {club_logo}")

        images = payload.setdefault("images", {})
        
        # event photos - check for multiple photos uploaded by name
        resolved_photos = []
        valid_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
        # Frontend can upload multiple photos by naming them photo1.png, photo2.jpg, etc.
        for i in range(1, 10):
            photo_base = f"photo{i}"
            found_photo = False
            for ext in valid_extensions:
                photo_name = f"{photo_base}{ext}"
                photo_path = UPLOADS_DIR / photo_name
                if photo_path.exists():
                    full_path = str(photo_path)
                    resolved_photos.append(full_path)
                    logger.info(f"✅ Photo {i} found: {full_path}")
                    found_photo = True
                    break
            
            # Also check report_image_X
            if not found_photo:
                report_img_base = f"report_image_{i}"
                for ext in valid_extensions:
                    photo_name = f"{report_img_base}{ext}"
                    photo_path = UPLOADS_DIR / photo_name
                    if photo_path.exists():
                        full_path = str(photo_path)
                        resolved_photos.append(full_path)
                        logger.info(f"✅ Photo {i} found (as report_image): {full_path}")
                        found_photo = True
                        break

        # Also include snapshot image in event photos grid
        snapshot_img = resolve_img(["snapshot_image", "snapshot"])
        if snapshot_img and snapshot_img not in resolved_photos:
            resolved_photos.append(snapshot_img)
            logger.info(f"✅ Snapshot added to event photos: {snapshot_img}")

        if not resolved_photos:
            logger.warning("⚠️  No photos found by standard naming convention")
            for p in images.get("event_photos", []):
                if (UPLOADS_DIR / p).exists():
                    resolved_photos.append(str(UPLOADS_DIR / p))
                elif (DATA_DIR / p).exists():
                    resolved_photos.append(str(DATA_DIR / p))
        
        logger.info(f"📸 Total photos resolved: {len(resolved_photos)}")
        images["event_photos"] = resolved_photos
        
        # Handle feedback, snapshot and poster images
        feedback_img = resolve_img(["feedback_image", "feedback"])
        images["feedback_image"] = feedback_img
        images["snapshot_image"] = snapshot_img
        
        poster_img = resolve_img(["poster_image", "poster"])
        images["poster_image"] = poster_img

        # Save payload to json
        unique_id = str(uuid.uuid4())[:8]
        report_data_path = DATA_DIR / f"report_data_{unique_id}.json"
        
        with open(report_data_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)

        output_docx = OUTPUT_DIR / f"event_report_{unique_id}.docx"
        output_pdf = OUTPUT_DIR / f"event_report_{unique_id}.pdf"
        output_txt = OUTPUT_DIR / f"event_report_{unique_id}.txt"
        
        # ── Generate Analytics Charts from uploaded CSVs ─────────────────────
        ratings_chart_path = ""
        demographics_chart_path = ""
        try:
            sys.path.insert(0, str(ROOT_DIR / "src"))
            from src.quantitative_analyzer import EventAnalytics
            import pandas as pd

            analyzer_q = EventAnalytics()
            feedback_file = DATA_DIR / 'feedback.csv'
            attendees_file = DATA_DIR / 'attendees.csv'

            if feedback_file.exists():
                feedback_df = pd.read_csv(feedback_file)
                # If no session_name column, synthesize one so chart can render
                if 'session_name' not in feedback_df.columns:
                    feedback_df['session_name'] = 'Event Session'
                # Ensure a numeric rating column exists
                rating_col = next(
                    (c for c in feedback_df.columns
                     if c.lower() in ['rating', 'score', 'overall_rating', 'overall', 'stars']),
                    None
                )
                if rating_col and rating_col != 'rating':
                    feedback_df['rating'] = pd.to_numeric(feedback_df[rating_col], errors='coerce')
                elif 'rating' in feedback_df.columns:
                    feedback_df['rating'] = pd.to_numeric(feedback_df['rating'], errors='coerce')
                else:
                    feedback_df['rating'] = 4.0  # default if no rating column
                feedback_df = feedback_df.dropna(subset=['rating'])

                if not feedback_df.empty:
                    ratings_out = str(OUTPUT_DIR / f"session_ratings_{unique_id}.png")
                    try:
                        analyzer_q.create_session_ratings_chart(feedback_df, ratings_out)
                        ratings_chart_path = ratings_out
                        logger.info(f"✅ Session ratings chart saved: {ratings_out}")
                    except Exception as ce:
                        logger.warning(f"⚠️ Session ratings chart failed: {ce}")

            if attendees_file.exists():
                attendees_df = pd.read_csv(attendees_file)
                demographics_out = str(OUTPUT_DIR / f"participant_demographics_{unique_id}.png")
                try:
                    analyzer_q.create_participant_demographics_chart(attendees_df, demographics_out)
                    demographics_chart_path = demographics_out
                    logger.info(f"✅ Demographics chart saved: {demographics_out}")
                except Exception as ce:
                    logger.warning(f"⚠️ Demographics chart failed: {ce}")

        except Exception as qa_err:
            logger.warning(f"⚠️ Chart generation skipped: {qa_err}")
        # ─────────────────────────────────────────────────────────────

        # Build comprehensive data dictionary mapped for ReportLab format
        data = {
            # Event metadata
            'department': payload.get("event_meta", {}).get("department_name", ""),
            'event_type': payload.get("event_meta", {}).get("event_type", ""),
            'title': payload.get("event_meta", {}).get("title", ""),
            'date': payload.get("event_meta", {}).get("date", ""),
            'time': payload.get("event_meta", {}).get("time", ""),
            'venue': payload.get("event_meta", {}).get("venue", ""),
            
            # Participants
            'target_audience': payload.get("participants", {}).get("target_audience", ""),
            'total_participants': payload.get("participants", {}).get("total_participants", 0),
            'girl_participants': payload.get("participants", {}).get("girl_participants", 0),
            'boy_participants': payload.get("participants", {}).get("boy_participants", 0),
            'dbit_students': payload.get("registration", {}).get("dbit_students", 0),
            'non_dbit_students': payload.get("registration", {}).get("non_dbit_students", 0),
            
            # Organizers
            'resource_person': payload.get("organizers", {}).get("resource_person", ""),
            'resource_organization': payload.get("organizers", {}).get("resource_org", ""),
            'organizing_body': payload.get("organizers", {}).get("organizing_body", ""),
            'faculty_coordinator': payload.get("organizers", {}).get("faculty_coordinator", ""),
            
            # Content — AI-generate detailed report paragraph from user hints
            'objectives': payload.get("content", {}).get("objectives", []),
            'outcomes': payload.get("content", {}).get("outcomes", []),
            'detailed_report': payload.get("content", {}).get("detailed_report", ""),
            'snapshot_description': payload.get("content", {}).get("snapshot_description", ""),
            'feedback_text': payload.get("feedback", {}).get("feedback_text", ""),
            
            # Social media
            'social_media': payload.get("social_media", {}),
            'social_org_name': 'ACM-DBIT',
            
            # Signatories
            'approved_name': payload.get("signatories", {}).get("approved_name", ""),
            'approved_post': payload.get("signatories", {}).get("approved_post", ""),
            'prepared_name': payload.get("signatories", {}).get("prepared_name", ""),
            'prepared_post': payload.get("signatories", {}).get("prepared_post", ""),
            
            # Student list
            'students': payload.get("registration", {}).get("students", []),
            
            # Images
            'college_logo': inst.get("college_logo", ""),
            'club_logo': inst.get("club_logo", ""),
            'event_photos': images.get("event_photos", []),
            'feedback_images': [images.get("feedback_image")] if images.get("feedback_image") else [],
            'poster_image': images.get("poster_image", ""),
            # Analytics charts
            'ratings_chart': ratings_chart_path,
            'demographics_chart': demographics_chart_path,
        }
        
        # ── Ollama AI Generation ──────────────────────────────────────────────
        event_name = data.get('title') or data.get('event_type') or 'the event'
        try:
            from src.llm_analyzer import EventFeedbackAnalyzer, LLMConfig
            analyzer = EventFeedbackAnalyzer(LLMConfig(model_name="llama3:8b"))

            # 1) AI-generated detailed report from user's description pointers
            hints = payload.get("content", {}).get("detailed_description", "") \
                    or payload.get("content", {}).get("detailed_report", "")
            if hints and hints.strip():
                logger.info("🤖 Generating detailed report paragraph via Ollama...")
                data['detailed_report'] = analyzer.generate_detailed_report(hints, event_name)
                logger.info("✅ Detailed report generated")

            # 2) AI-generated feedback summary from uploaded feedback CSV
            feedback_comments = []
            feedback_file = DATA_DIR / 'feedback.csv'
            if feedback_file.exists():
                with open(feedback_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        # Look for any column that looks like free-text comments
                        for col_name in ['Comments', 'comments', 'Feedback', 'feedback',
                                         'Comment', 'comment', 'Review', 'review', 'Suggestions']:
                            val = row.get(col_name, '').strip()
                            if val:
                                feedback_comments.append(val)
                                break

            if feedback_comments:
                logger.info(f"🤖 Generating feedback summary from {len(feedback_comments)} comments via Ollama...")
                data['feedback_text'] = analyzer.generate_feedback_summary_text(feedback_comments, event_name)
                logger.info("✅ Feedback summary generated")
            elif not data.get('feedback_text'):
                data['feedback_text'] = "Feedback was collected from participants. Overall response was positive."

        except Exception as llm_err:
            logger.warning(f"⚠️ Ollama AI generation skipped: {llm_err}")
            # Fall back to the user-entered text if LLM fails
            if not data.get('detailed_report'):
                data['detailed_report'] = payload.get("content", {}).get("detailed_report", "") \
                                           or payload.get("content", {}).get("detailed_description", "")

        # ─────────────────────────────────────────────────────────────────────
        logger.info(f"   Output: {output_pdf}")
        logger.info(f"   College Logo: {'✅' if data['college_logo'] else '❌'}")
        logger.info(f"   Photos: {'✅ ' + str(len(data['event_photos'])) + ' images' if data['event_photos'] else '❌'}")
        logger.info(f"   Poster: {'✅' if data['poster_image'] else '❌'}")
        logger.info(f"   Feedback Image: {'✅' if data['feedback_images'] else '❌'}")
        
        # Generate Reports
        from src.reportlab_pdf_generator import generate_report_pdf
        from src.text_report_generator import TextReportGenerator
        
        try:
            generate_report_pdf(data, str(output_pdf))
            success_pdf = True
        except Exception as e:
            logger.error(f"ReportLab generation failed: {e}")
            success_pdf = False

        text_generator = TextReportGenerator()
        success_txt = text_generator.generate_report(data, output_txt)

        if not success_pdf and not success_txt:
            raise HTTPException(status_code=500, detail="Report generation failed.")

        # ── Cache Cleanup ──────────────────────────────────────────────────
        # Clear uploaded images after successful generation to prevent leak into next report
        try:
            for file in UPLOADS_DIR.glob('*'):
                if file.is_file():
                    file.unlink()
            logger.info("🧹 Uploads cache cleared successfully")
        except Exception as cleanup_err:
            logger.warning(f"⚠️ Failed to clear uploads cache: {cleanup_err}")
        # ───────────────────────────────────────────────────────────────────

        return {
            "message": "Report generated successfully",
            "pdf_url": f"/download-report/pdf?filename=event_report_{unique_id}.pdf",
            "txt_url": f"/download-report/txt?filename=event_report_{unique_id}.txt"
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
    """Download generated PDF report."""
    report_path = ROOT_DIR / "output" / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="PDF report file not found.")

    return FileResponse(
        path=report_path,
        media_type="application/pdf",
        filename=filename
    )

@app.get("/download-report/txt")
async def download_txt_report(filename: str):
    """Download generated strict TXT report."""
    report_path = ROOT_DIR / "output" / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="TXT report file not found.")

    return FileResponse(
        path=report_path,
        media_type="text/plain",
        filename=filename
    )

@app.get("/download-report/docx")
async def download_docx_report(filename: str):
    """Download generated DOCX report (legacy support)."""
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