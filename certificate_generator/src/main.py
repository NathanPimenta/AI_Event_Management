from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import shutil
import json
import os
try:
    from .generator import CertificateGenerator
except ImportError:
    from certificate_generator.src.generator import CertificateGenerator

app = FastAPI(title="Certificate Generator API")

# Define base paths
BASE_DIR = Path(__file__).parent.parent
ASSETS_DIR = BASE_DIR / "assets"

# Ensure asset directories exist
(ASSETS_DIR / "logos").mkdir(parents=True, exist_ok=True)
(ASSETS_DIR / "signatures").mkdir(parents=True, exist_ok=True)
(BASE_DIR / "temp_uploads").mkdir(parents=True, exist_ok=True)

@app.post("/certificates/generate")
async def generate_certificates_endpoint(
    config_json: str = Form(...),
    participants_csv: UploadFile = File(...),
    logo: UploadFile = File(...),
    signature: UploadFile = File(...),
    custom_template: UploadFile = File(None)
):
    """
    Endpoint to generate certificates.
    Accepts a multipart form with JSON config and file uploads.
    """
    try:
        # Parse the configuration JSON
        config = json.loads(config_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in config.")

    # --- Save uploaded files temporarily ---
    temp_dir = BASE_DIR / "temp_uploads"
    
    csv_path = temp_dir / participants_csv.filename
    with open(csv_path, "wb") as buffer:
        shutil.copyfileobj(participants_csv.file, buffer)

    logo_path = ASSETS_DIR / "logos" / logo.filename
    with open(logo_path, "wb") as buffer:
        shutil.copyfileobj(logo.file, buffer)

    signature_path = ASSETS_DIR / "signatures" / signature.filename
    with open(signature_path, "wb") as buffer:
        shutil.copyfileobj(signature.file, buffer)

    # --- Handle Custom Template ---
    custom_template_path = None
    if custom_template:
        custom_template_path = temp_dir / custom_template.filename
        with open(custom_template_path, "wb") as buffer:
            shutil.copyfileobj(custom_template.file, buffer)
        config["custom_template_path"] = custom_template_path

    # --- Update config with file paths ---
    config["csv_path"] = csv_path
    config["logo_path"] = logo_path
    config["signature_path"] = signature_path
    
    try:
        # --- Run the generator ---
        cert_generator = CertificateGenerator(config=config)
        generated_files = cert_generator.generate_all()

        if not generated_files:
            raise HTTPException(status_code=500, detail="Certificate generation failed. Check logs.")
            
    finally:
        # --- Clean up the uploaded CSV file ---
        if os.path.exists(csv_path):
            os.remove(csv_path)

    return JSONResponse(
        status_code=200,
        content={
            "message": f"Successfully generated {len(generated_files)} certificates.",
            "generated_files": [Path(f).name for f in generated_files]
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)