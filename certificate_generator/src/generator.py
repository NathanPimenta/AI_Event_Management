import os
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
import qrcode
from pathlib import Path
import uuid
import json
import re

from .agents import (
    DataIntakeAgent, 
    TemplateIdentifierAgent, 
    DesignAgent, 
    AssetsAgent, 
    LayoutAgent, 
    StructureAgent, 
    RenderAgent,
    RenderAgent,
    QualityControlAgent,
    TemplateAnalysisAgent
)

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
        
        # Agentic pipeline initialization
        self.data_agent = DataIntakeAgent()
        self.template_agent = TemplateIdentifierAgent()
        self.design_agent = DesignAgent() 
        self.assets_agent = AssetsAgent(self.assets_dir)
        self.layout_agent = LayoutAgent()
        self.structure_agent = StructureAgent()
        self.structure_agent = StructureAgent()
        self.qc_agent = QualityControlAgent() # New verification agent
        self.analysis_agent = TemplateAnalysisAgent() # New custom workflow agent
        
        # Look up template based on initial config or defaults
        initial_style = config.get('style', 'modern')
        self.template = self.env.get_template(f"{initial_style}.html")
        
        self.render_agent = RenderAgent(self.template, self._inject_fixed_logos, self._create_pdf)
        
        print("✅ CertificateGenerator initialized.")
        print(f"   - Outputting to: {self.output_dir}")

    def analyze_template_content(self, html_content: str) -> list[str]:
        """Analyzes a raw HTML string to find required fields."""
        return self.analysis_agent.analyze_template(html_content)

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
        base_url = str(self.assets_dir.resolve())
        HTML(string=html_content, base_url=base_url).write_pdf(
            output_path,
            stylesheets=[CSS(string='@page { size: A4 landscape; margin: 0; }')]
        )

    def _inject_fixed_logos(self, html_content: str, college_logo_path: str, club_logo_path: str, layout: dict = None) -> str:
        marker = 'data-fixed-logos="true"'
        if marker in html_content:
            return html_content

        if not college_logo_path and not club_logo_path:
            return html_content

        # Defaults if layout doesn't provide them
        top = "24px"
        side = "24px"
        
        if layout:
            top = layout.get("fixed_logo_top", "40px")
            side = layout.get("fixed_logo_side", "50px")

        # Dynamic styling based on LayoutAgent's output
        style_block = f"""
<style>
  .fixed-logo {{
    position: fixed;
    top: {top};
    width: 120px;
    height: auto;
    z-index: 999;
  }}
  .fixed-logo--college {{ left: {side}; }}
  .fixed-logo--club {{ right: {side}; }}
</style>
"""

        logo_tags = [f'<div {marker}>']
        if college_logo_path:
            logo_tags.append(
                f'<img src="file://{college_logo_path}" alt="College Logo" class="fixed-logo fixed-logo--college">'
            )
        if club_logo_path:
            logo_tags.append(
                f'<img src="file://{club_logo_path}" alt="Club Logo" class="fixed-logo fixed-logo--club">'
            )
        logo_tags.append("</div>")
        logo_markup = "".join(logo_tags)

        head_match = re.search(r"</head>", html_content, re.IGNORECASE)
        if head_match:
            html_content = (
                html_content[:head_match.start()] + style_block + html_content[head_match.start():]
            )
        else:
            html_content = style_block + html_content

        body_match = re.search(r"(<body[^>]*>)", html_content, re.IGNORECASE)
        if body_match:
            insert_pos = body_match.end()
            return html_content[:insert_pos] + logo_markup + html_content[insert_pos:]

        return logo_markup + html_content

    def generate_all(self) -> list:
        """Main method to generate all certificates."""
        csv_source = self.config.get("csv_path")

        # Helpful debug output
        print(f"   - CSV source type: {type(csv_source)}")

        try:
            participants_df = self.data_agent.load_participants(csv_source)
        except FileNotFoundError:
            print(f"❌ ERROR: Participants CSV not found at {self.config['csv_path']}")
            return []
        except Exception as e:
            print(f"❌ ERROR: Failed to load participants CSV: {e}")
            return []

        # --- AGENTIC PIPELINE EXECUTION ---
        prompt = self.config.get("ai_theme_prompt")
        
        # 1. Identify Template
        template_name = self.template_agent.identify_template(prompt) 
        if self.config.get("style"):
             template_name = self.config.get("style")
        
        print(f"   - 📋 Template Agent: Selected '{template_name}' template.")
        self.template = self.env.get_template(f"{template_name}.html")
        self.render_agent.template = self.template

        # 2. Generate Design
        design = self.design_agent.generate_design(prompt)

        # 3. Resolve Assets
        assets = self.assets_agent.resolve_paths(self.config)
        
        # 4. Calculate Layout
        layout = self.layout_agent.build_layout(self.config, design)

        generated_files = []
        print("🤖 Agentic pipeline: Data -> Template -> Design -> Assets -> Layout -> Structure -> QC -> Render")
        print(f"\n🚀 Starting certificate generation for {len(participants_df)} participants...")

        for index, participant in participants_df.iterrows():
            unique_id = str(uuid.uuid4())
            qr_data = f"https://communityhub.com/verify?id={unique_id}"
            qr_code_path = self.output_dir / f"qr_{unique_id}.png"
            absolute_qr_path = self._generate_qr_code(qr_data, qr_code_path)

            # Build initial context
            context = self.structure_agent.build_context(
                participant=participant,
                config=self.config,
                assets=assets,
                qr_code_path=absolute_qr_path,
                design=design, 
                layout=layout, 
            )

            # 5. Quality Control (Reinforcement)
            # The QC Agent inspects the context and might modify it (e.g. fix colors, layout)
            context = self.qc_agent.audit_context(context)

            name = context.get("name", "N/A")
            print(f"   -> Generating for: {name}")

            rendered_html = self.render_agent.render_html(context)
            
            pdf_filename = f"Certificate_{name.replace(' ', '_')}.pdf"
            pdf_output_path = self.output_dir / pdf_filename
            self.render_agent.render_pdf(rendered_html, pdf_output_path)
            
            generated_files.append(str(pdf_output_path))
            os.remove(qr_code_path)

        print(f"\n✅ Generation complete! {len(generated_files)} certificates created.")
        return generated_files

# --- Local Testing Block ---
if __name__ == "__main__":
    print("🧪 Running Certificate Generator in local test mode...")

    # Create dummy assets for testing
    dummy_assets_dir = Path(__file__).parent.parent / "assets"
    (dummy_assets_dir / "logos").mkdir(parents=True, exist_ok=True)
    (dummy_assets_dir / "signatures").mkdir(parents=True, exist_ok=True)
    
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
        "style": "formal",  # Explicitly test formal template
        "event_name": "Interstellar Hackathon 2025",
        "event_date": "December 5, 2025",
        "institution_name": "Galactic Institute of Tech",
        "logo_path": dummy_logo_path,
        "signature_path": dummy_sig_path,
        "signature_name": "Cmdr. Shepard",
        "ai_theme_prompt": "cyberpunk" 
    }

    generator = CertificateGenerator(config=test_config)
    
    # Test Template Analysis
    print("\n📝 Testing Template Analysis...")
    dummy_template = """
    <html>
        <body>
            <h1>{{ event_name }}</h1>
            <p>Awarded to {{ student_name }} for {{ course_title }}</p>
            <div style="color: {{ colors.text }}">Signature: {{ signature_name }}</div>
        </body>
    </html>
    """
    required = generator.analyze_template_content(dummy_template)
    print(f"   - Detected fields: {required}")
    # expected: ['course_title', 'event_name', 'signature_name', 'student_name']
    # colors.text is a system var, should be excluded
    
    generator.generate_all()
