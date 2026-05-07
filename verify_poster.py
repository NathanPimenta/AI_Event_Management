import os
import glob
import json
import subprocess
import sys

def verify():
    # 1. Check for images
    images_dir = "poster_generator/images"
    images = glob.glob(os.path.join(images_dir, "*"))
    image_path = None
    
    # Filter for valid image extensions
    valid_exts = {'.jpg', '.jpeg', '.png', '.webp'}
    images = [img for img in images if os.path.splitext(img)[1].lower() in valid_exts]

    if not images:
        print(f"No images found in {images_dir}. Please add an image to run the verification.")
        print("You can run this script again after adding an image.")
        return False
    
    image_path = images[0]
    print(f"Using image: {image_path}")

    # 2. Run CLI
    config_path = "poster_generator/sample_config.json"
    output_path = "output_poster.png"
    
    cmd = [
        sys.executable, 
        "poster_generator/cli.py", 
        "--image", image_path, 
        "--config", config_path, 
        "--output", output_path
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print("Error running poster generator:")
        print(result.stderr)
        return False
    else:
        print(result.stdout)

    # 3. Verify output
    if os.path.exists(output_path):
        print(f"Verification Successful! Poster generated at {output_path}")
        return True
    else:
        print("Output file was not created.")
        return False

if __name__ == "__main__":
    verify()
