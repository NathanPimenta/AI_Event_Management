import argparse
import json
import sys
from generator import create_poster

def main():
    parser = argparse.ArgumentParser(description="Generate an Insta-worthy poster.")
    parser.add_argument("--image", required=True, help="Path to the base image")
    parser.add_argument("--config", required=True, help="Path to the JSON configuration file containing text elements")
    parser.add_argument("--output", default="output_poster.png", help="Path to save the generated poster")

    args = parser.parse_args()

    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
    except Exception as e:
        print(f"Error loading config file: {e}")
        sys.exit(1)

    try:
        create_poster(args.image, args.output, config)
        print(f"Successfully generated poster at {args.output}")
    except Exception as e:
        print(f"Error generating poster: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
