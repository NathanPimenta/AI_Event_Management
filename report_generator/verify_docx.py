import sys
from pathlib import Path

# Add src to python path to allow imports within src modules to work
src_path = Path(__file__).parent / "src"
sys.path.append(str(src_path))

from src.main import EventReportGenerator, EventReportConfig

def run_test():
    # Ensure template exists
    template_path = Path('dummy_template.docx').resolve()
    if not template_path.exists():
        print("Template not found!")
        return

    config = EventReportConfig(
        event_name="Test Event 2025",
        event_type="Workshop",
        institution_name="DBIT",
        custom_template_path=template_path,
        output_dir=Path('output_test').resolve()
    )
    
    # Ensure output dir exists
    config.output_dir.mkdir(exist_ok=True)
    
    generator = EventReportGenerator(config)
    try:
        success = generator.generate()
    except Exception as e:
        print(f"Test FAILED: Report generation raised an exception: {e}")
        return
    
    if success:
        print("Test PASSED: Report generated.")
    else:
        print("Test FAILED: Report generation returned False.")

if __name__ == "__main__":
    run_test()
