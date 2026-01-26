from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import shutil
import json
import os
import traceback
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

# Define base paths
BASE_DIR = Path(__file__).parent.parent
ASSETS_DIR = BASE_DIR / "assets"
TEMPLATES_DIR = ASSETS_DIR / "templates"
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"

# Ensure directories exist
(ASSETS_DIR / "logos").mkdir(parents=True, exist_ok=True)
(ASSETS_DIR / "signatures").mkdir(parents=True, exist_ok=True)
(BASE_DIR / "temp_uploads").mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DATA_DIR.mkdir(parents=True, exist_ok=True)


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

        # Save logo
        logo_path = ASSETS_DIR / "logos" / logo.filename
        with open(logo_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)

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
        config["logo_path"] = str(logo_path)
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
        # Optionally clean up custom template after use
        # if custom_template_path and os.path.exists(custom_template_path):
        #     os.remove(custom_template_path)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Certificate Generator API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)