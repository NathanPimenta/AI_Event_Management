from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pathlib import Path
import shutil
import json
import os
import traceback
import uuid
from typing import Optional
import numpy as np
from PIL import Image
from .generator import CertificateGenerator

app = FastAPI(title="Certificate Generator API")

# Add CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount assets directory for static file access (downloading templates)
# This allows accessing http://localhost:8000/assets/templates/modern.html
BASE_DIR = Path(__file__).parent.parent
ASSETS_DIR = BASE_DIR / "assets"
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

TEMPLATES_DIR = ASSETS_DIR / "templates"
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"
COLLEGE_LOGO_DEFAULT = ASSETS_DIR / "logos" / "logo.png"

# Ensure directories exist
(ASSETS_DIR / "logos").mkdir(parents=True, exist_ok=True)
(ASSETS_DIR / "signatures").mkdir(parents=True, exist_ok=True)
(BASE_DIR / "temp_uploads").mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_college_logo_path() -> Optional[Path]:
    if COLLEGE_LOGO_DEFAULT.exists():
        return COLLEGE_LOGO_DEFAULT
    logo_dir = ASSETS_DIR / "logos"
    if not logo_dir.exists():
        return None
    candidates = sorted(
        p for p in logo_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".svg"}
    )
    return candidates[0] if candidates else None


def _save_logo_with_transparency(file_obj, output_path: Path) -> None:
    try:
        file_obj.seek(0)
    except Exception:
        pass

    try:
        img = Image.open(file_obj).convert("RGBA")
        data = np.array(img)
        r = data[..., 0].astype(np.int16)
        g = data[..., 1].astype(np.int16)
        b = data[..., 2].astype(np.int16)

        # Simple green-screen removal for logos with solid green backgrounds.
        mask = (g > 120) & (g > r + 30) & (g > b + 30)
        data[..., 3][mask] = 0

        Image.fromarray(data).save(output_path, format="PNG")
    except Exception:
        try:
            file_obj.seek(0)
        except Exception:
            pass
        with open(output_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)


@app.post("/certificates/generate")
async def generate_certificates_endpoint(
    config_json: str = Form(...),
    participants_csv: UploadFile = File(...),
    logo: UploadFile = File(...),
    signature: UploadFile = File(...),
    custom_template: UploadFile = File(None)  # Optional custom Jinja2 template
):
    """
    Endpoint to generate certificates.
    Accepts a multipart form with JSON config and file uploads.
    Optionally accepts a custom Jinja2 HTML template.
    """
    csv_path = None
    custom_template_path = None
    club_logo_path = None
    processed_college_logo_path = None
    
    try:
        # Parse the configuration JSON
        try:
            config = json.loads(config_json)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in config: {str(e)}")

        # --- Save uploaded files ---
        temp_dir = BASE_DIR / "temp_uploads"
        
        # Save CSV
        csv_path = temp_dir / participants_csv.filename
        with open(csv_path, "wb") as buffer:
            shutil.copyfileobj(participants_csv.file, buffer)

        # Save club logo (uploaded)
        club_logo_path = temp_dir / f"club_logo_{uuid.uuid4().hex}.png"
        _save_logo_with_transparency(logo.file, club_logo_path)

        college_logo_path = _resolve_college_logo_path()
        if not college_logo_path:
            raise HTTPException(
                status_code=500,
                detail="College logo not found in assets/logos. Please add it and try again."
            )
        processed_college_logo_path = temp_dir / f"college_logo_{uuid.uuid4().hex}.png"
        with open(college_logo_path, "rb") as buffer:
            _save_logo_with_transparency(buffer, processed_college_logo_path)
        college_logo_path = processed_college_logo_path

        # Save signature
        signature_path = ASSETS_DIR / "signatures" / signature.filename
        with open(signature_path, "wb") as buffer:
            shutil.copyfileobj(signature.file, buffer)

        # Handle custom template if provided
        if custom_template and custom_template.filename:
            custom_template_path = TEMPLATES_DIR / "custom_uploaded.html"
            with open(custom_template_path, "wb") as buffer:
                shutil.copyfileobj(custom_template.file, buffer)
            config["style"] = "custom_uploaded"  # Use the uploaded template

        # --- Update config with file paths ---
        config["csv_path"] = str(csv_path)
        config["logo_path"] = str(club_logo_path)
        config["club_logo_path"] = str(club_logo_path)
        config["college_logo_path"] = str(college_logo_path)
        config["signature_path"] = str(signature_path)
        
        # --- Run the generator ---
        cert_generator = CertificateGenerator(config=config)
        generated_files = cert_generator.generate_all()

        if not generated_files:
            raise HTTPException(status_code=500, detail="Certificate generation failed. No files were created. Check server logs.")
        
        return JSONResponse(
            status_code=200,
            content={
                "message": f"Successfully generated {len(generated_files)} certificates.",
                "generated_files": [Path(f).name for f in generated_files]
            }
        )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error during certificate generation: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    finally:
        # --- Clean up temporary files ---
        if csv_path and os.path.exists(csv_path):
            os.remove(csv_path)
        if club_logo_path and os.path.exists(club_logo_path):
            os.remove(club_logo_path)
        if processed_college_logo_path and os.path.exists(processed_college_logo_path):
            os.remove(processed_college_logo_path)
        # Optionally clean up custom template after use
        # if custom_template_path and os.path.exists(custom_template_path):
        #     os.remove(custom_template_path)


@app.post("/templates/analyze")
async def analyze_template_endpoint(
    template_file: UploadFile = File(...)
):
    """
    Analyzes an uploaded Jinja2 HTML template and returns a list of variables
    that need to be provided in the CSV or config.
    """
    try:
        content = (await template_file.read()).decode("utf-8")
        # Reuse the logic via a temporary generator instance or directly importing the agent
        # For cleanliness, let's use the generator's method we just added
        temp_gen = CertificateGenerator(config={})
        required_fields = temp_gen.analyze_template_content(content)
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "Template analyzed successfully.",
                "required_fields": required_fields
            }
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to analyze template: {str(e)}")


@app.post("/certificates/generate-custom")
async def generate_custom_certificates_endpoint(
    config_json: str = Form(...),
    participants_csv: UploadFile = File(...),
    template_file: UploadFile = File(...),
    mapping_json: str = Form(...), # Maps template_field -> csv_column
    logo: UploadFile = File(None),
    signature: UploadFile = File(None)
):
    """
    Generates certificates using a custom uploaded template and column mapping.
    """
    csv_path = None
    custom_template_path = None
    
    try:
        config = json.loads(config_json)
        mapping = json.loads(mapping_json)
        
        # --- Save uploaded files ---
        temp_dir = BASE_DIR / "temp_uploads"
        
        # Save CSV
        csv_path = temp_dir / f"participants_{uuid.uuid4().hex}.csv"
        with open(csv_path, "wb") as buffer:
            shutil.copyfileobj(participants_csv.file, buffer)

        # Save Custom Template
        custom_template_path = TEMPLATES_DIR / "custom_uploaded.html"
        with open(custom_template_path, "wb") as buffer:
            shutil.copyfileobj(template_file.file, buffer)
            
        # Handle assets (logos/sigs) - reusing logic from standard endpoint if provided
        if logo:
            club_logo_path = temp_dir / f"club_logo_{uuid.uuid4().hex}.png"
            _save_logo_with_transparency(logo.file, club_logo_path)
            config["club_logo_path"] = str(club_logo_path)
            
        if signature:
            signature_path = ASSETS_DIR / "signatures" / f"sig_{uuid.uuid4().hex}.png"
            with open(signature_path, "wb") as buffer:
                shutil.copyfileobj(signature.file, buffer)
            config["signature_path"] = str(signature_path)

        # --- Resolve Mapping ---
        # We need to preprocess the CSV based on the mapping
        # Load CSV into DataFrame
        import pandas as pd
        df = pd.read_csv(csv_path)
        
        # Renaissance mapping: Rename CSV columns to match template fields
        # Mapping format: { "template_var": "csv_column_name" }
        rename_map = {v: k for k, v in mapping.items() if v in df.columns}
        
        # Create a new DataFrame with mapped columns
        # Note: We might want to keep original columns too, but for simplicity, let's just ensure required fields are present
        for template_var, csv_col in mapping.items():
            if csv_col in df.columns:
                df[template_var] = df[csv_col]
            elif csv_col.startswith("FIXED:"): # Allow fixed values like "FIXED:Workshop 2025"
                fixed_val = csv_col.split("FIXED:", 1)[1]
                df[template_var] = fixed_val
        
        # Save the transformed CSV back to disk to be used by the generator
        # Or pass DataFrame directly if generator supported it. Generator takes 'csv_path' in config.
        # Let's overwrite the temp CSV with transformed data
        df.to_csv(csv_path, index=False)
        
        config["csv_path"] = str(csv_path)
        config["style"] = "custom_uploaded" 
        
        # --- Run Generator ---
        cert_generator = CertificateGenerator(config=config)
        generated_files = cert_generator.generate_all()
        
        return JSONResponse(
            status_code=200,
            content={
                "message": f"Successfully generated {len(generated_files)} custom certificates.",
                "generated_files": [Path(f).name for f in generated_files]
            }
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    finally:
        if csv_path and os.path.exists(csv_path):
            os.remove(csv_path)
        # Clean up other temp files...

@app.get("/templates/download/{filename}")
async def download_template_endpoint(filename: str):
    """
    Downloads a template file from the assets/templates directory.
    """
    # Basic security check
    if ".." in filename or "/" in filename:
         print(f"❌ Invalid filename attempt: {filename}")
         raise HTTPException(status_code=400, detail="Invalid filename")
         
    file_path = TEMPLATES_DIR / filename
    print(f"📥 Download request for: {filename}")
    print(f"   -> Resolving to: {file_path.absolute()}")
    
    if not file_path.exists():
        print(f"❌ Template not found at: {file_path}")
        raise HTTPException(status_code=404, detail="Template not found")
    
    return FileResponse(
        path=file_path, 
        filename=filename, 
        media_type='application/octet-stream'
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)
