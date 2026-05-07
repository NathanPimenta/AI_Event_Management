import argparse
import sys
import os
from dotenv import load_dotenv
from font_manager import FontManager
from ai_designer import AIDesigner
from generator import create_poster

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

def main():
    parser = argparse.ArgumentParser(description="Generate a smart AI-designed poster.")
    parser.add_argument("--image", required=True, help="Path to the base image")
    parser.add_argument("--content", required=True, help="Text content for the poster")
    parser.add_argument("--intent", required=True, help="Layout/Vibe instructions")
    parser.add_argument("--output", default="smart_poster.png", help="Path to save the generated poster")
    parser.add_argument("--api_key", help="Google Fonts API Key", default=None)
    parser.add_argument("--model", help="Ollama model to use", default="llama3:8b")

    args = parser.parse_args()

    # Load environment variables from .env file
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

    from PIL import Image

    # 1. Init Managers
    print("Initializing Font Manager...")
    font_manager = FontManager(api_key=args.api_key)
    fonts = font_manager.fetch_available_fonts()
    print(f"Fetched {len(fonts)} fonts for context.")

    # Get Image Dimensions
    try:
        with Image.open(args.image) as img:
            width, height = img.size
            print(f"Image Dimensions: {width}x{height}")
    except Exception as e:
        print(f"Error reading image: {e}")
        sys.exit(1)

    # 2. Call AI Designer
    print(f"Requesting design from AI ({args.model})...")
    designer = AIDesigner(model_name=args.model)
    design_config = designer.design_poster(args.content, args.intent, fonts, width=width, height=height)
    
    if not design_config:
        print("Failed to generate design configuration.")
        sys.exit(1)
        
    print("Design generated successfully.")
    
    # 3. Generate Poster
    print("Rendering poster...")
    try:
        create_poster(args.image, args.output, design_config)
        print(f"Smart Poster saved to {args.output}")
    except Exception as e:
        print(f"Error rendering poster: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
