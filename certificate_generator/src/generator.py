import os
import io
import pandas as pd
import numpy as np
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
import qrcode
from pathlib import Path
import uuid
import json
import ollama  # <-- Import ollama
import re  # <-- Make sure this import is at the top of the file

class CertificateGenerator:
    """
    Generates certificates from a CSV file using an HTML template,
    with support for multiple styles and AI-powered color theming.
    """
    def __init__(self, config: dict):
        self.config = config
        self.base_dir = Path(__file__).resolve().parent.parent
        self.output_dir = self.base_dir / "output" / "certificates"
        self.assets_dir = self.base_dir / "assets"
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.env = Environment(loader=FileSystemLoader(self.assets_dir / "templates"))
        self.template = self.env.get_template(f"{config.get('style', 'modern')}.html")
        
        print("✅ CertificateGenerator initialized.")
        print(f"   - Style: {config.get('style', 'modern')}")
        print(f"   - Outputting to: {self.output_dir}")

    def _get_ai_palette(self, theme_prompt: str) -> dict:
        """
        Calls an LLM to generate a color palette.
        This version robustly extracts the JSON from the LLM's response.
        """
        print(f"   - 🧠 Querying AI for color palette with theme: '{theme_prompt}'...")
        try:
            prompt = f"""
            Based on the theme '{theme_prompt}', generate a professional color palette for an event certificate.
            Return ONLY a valid JSON object with four keys: "background", "text", "accent", "header".
            Use hex color codes. Example: {{"background": "#FFFFFF", "text": "#000000", ...}}
            """
            response = ollama.chat(
                model='llama3:8b',
                messages=[{'role': 'user', 'content': prompt}],
                options={'temperature': 0.5}
            )
            content = response.get('message', {}).get('content', '').strip()

            # --- THIS IS THE CRUCIAL FIX ---
            # Use regex to find the JSON block, even if it's wrapped in text.
            # It looks for a string that starts with { and ends with }, ignoring whitespace and newlines.
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            
            if not json_match:
                # This helps in debugging if the LLM returns something completely unexpected
                print(f"   - ⚠️ AI did not return a recognizable JSON object. Response was: '{content}'")
                return {}

            # Extract the matched JSON string and parse it
            json_string = json_match.group(0)
            palette = json.loads(json_string)
            
            # Basic validation to ensure the keys we need are present
            if not all(k in palette for k in ["background", "text", "accent", "header"]):
                print(f"   - ⚠️ AI returned JSON but is missing required keys. Got: {palette}")
                return {}

            print(f"   - ✅ AI returned palette: {palette}")
            return palette

        except Exception as e:
            print(f"   - ⚠️ AI color generation failed: {e}. Using default colors.")
            return {}  # Fall back to defaults

    def _generate_qr_code(self, data: str, filename: Path) -> str:
        """Generates a QR code and saves it."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(filename)
        return str(filename.resolve())

    def _create_pdf(self, html_content: str, output_path: Path):
        """Converts HTML content to a PDF file."""
        # WeasyPrint requires absolute paths for local resources like images
        base_url = str(self.assets_dir.resolve())
        HTML(string=html_content, base_url=base_url).write_pdf(
            output_path,
            stylesheets=[CSS(string='@page { size: A4 landscape; margin: 0; }')]
        )

    def generate_all(self) -> list:
        """Main method to generate all certificates.

        Accepts several `csv_path` types in `self.config`:
        - str / Path -> treated as file path
        - file-like object -> read via pandas
        - bytes/bytearray -> read from BytesIO
        - numpy.ndarray / list / dict -> converted to DataFrame directly
        - pandas.DataFrame -> used as-is
        """
        csv_source = self.config.get("csv_path")

        # Helpful debug output
        print(f"   - CSV source type: {type(csv_source)}")

        try:
            if isinstance(csv_source, pd.DataFrame):
                participants_df = csv_source.copy()
            elif isinstance(csv_source, (str, Path)):
                participants_df = pd.read_csv(csv_source)
            elif hasattr(csv_source, "read"):
                # file-like object
                participants_df = pd.read_csv(csv_source)
            elif isinstance(csv_source, (bytes, bytearray)):
                participants_df = pd.read_csv(io.BytesIO(csv_source))
            elif isinstance(csv_source, np.ndarray):
                participants_df = pd.DataFrame(csv_source)
            elif isinstance(csv_source, (list, dict)):
                participants_df = pd.DataFrame(csv_source)
            else:
                raise TypeError(f"Unsupported csv_path type: {type(csv_source)}")
        except FileNotFoundError:
            print(f"❌ ERROR: Participants CSV not found at {self.config['csv_path']}")
            return []
        except Exception as e:
            print(f"❌ ERROR: Failed to load participants CSV: {e}")
            return []

        # --- AI Color Generation ---
        colors = {}
        if self.config.get("ai_theme_prompt"):
            colors = self._get_ai_palette(self.config["ai_theme_prompt"])

        generated_files = []
        print(f"\n🚀 Starting certificate generation for {len(participants_df)} participants...")

        for index, participant in participants_df.iterrows():
            name = participant.get("name", "N/A")
            achievement = participant.get("achievement_type", "Participation")
            
            print(f"   -> Generating for: {name}")

            unique_id = str(uuid.uuid4())
            qr_data = f"https://communityhub.com/verify?id={unique_id}"
            qr_code_path = self.output_dir / f"qr_{unique_id}.png"
            absolute_qr_path = self._generate_qr_code(qr_data, qr_code_path)

            context = {
                "name": name,
                "event_name": self.config["event_name"],
                "event_date": self.config["event_date"],
                "institution_name": self.config["institution_name"],
                "achievement_type": achievement,
                "logo_path": str(Path(self.config["logo_path"]).resolve()),
                "signature_path": str(Path(self.config["signature_path"]).resolve()),
                "signature_name": self.config["signature_name"],
                "qr_code_path": absolute_qr_path,
                "font_path": str((self.assets_dir / "fonts" / "Merriweather-Regular.ttf").resolve()),  # For formal template
                "colors": colors  # Pass the color palette to the template
            }

            rendered_html = self.template.render(context)
            
            pdf_filename = f"Certificate_{name.replace(' ', '_')}.pdf"
            pdf_output_path = self.output_dir / pdf_filename
            self._create_pdf(rendered_html, pdf_output_path)
            
            generated_files.append(str(pdf_output_path))
            os.remove(qr_code_path)

        print(f"\n✅ Generation complete! {len(generated_files)} certificates created.")
        return generated_files

# --- Local Testing Block (updated) ---
if __name__ == "__main__":
    print("🧪 Running Certificate Generator in local test mode...")

    # Create dummy assets for testing
    dummy_assets_dir = Path(__file__).parent.parent / "assets"
    (dummy_assets_dir / "logos").mkdir(exist_ok=True)
    (dummy_assets_dir / "signatures").mkdir(exist_ok=True)
    
    dummy_logo_path = dummy_assets_dir / "logos" / "dummy_logo.png"
    dummy_sig_path = dummy_assets_dir / "signatures" / "dummy_sig.png"
    
    # Simple way to create blank images if they don't exist
    from PIL import Image
    if not dummy_logo_path.exists():
        Image.new('RGB', (100, 50), color='red').save(dummy_logo_path)
    if not dummy_sig_path.exists():
        Image.new('RGB', (150, 60), color='blue').save(dummy_sig_path)

    # Configuration for the test run
    test_config = {
        "csv_path": Path(__file__).resolve().parent.parent / "participants.csv",
        "style": "formal",  # <-- Change this to "formal" to test the new design!
        "event_name": "Classical Computing Symposium",
        "event_date": "December 5, 2025",
        "institution_name": "Institute of Technology",
        "logo_path": dummy_logo_path,
        "signature_path": dummy_sig_path,
        "signature_name": "Prof. Eleanor Vance, Dean",
        "ai_theme_prompt": "A prestigious academic award with gold and navy blue colors"  # <-- Add an AI prompt!
    }

    generator = CertificateGenerator(config=test_config)
    generator.generate_all()