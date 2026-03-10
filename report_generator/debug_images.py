#!/usr/bin/env python3
"""
Debug script for tracing image handling through the report generation pipeline.
This script validates that images are being properly detected, resolved, and passed
through the entire generation chain.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Ensure src is in path
sys.path.insert(0, str(Path(__file__).parent / "src"))

import generate_report as gr


def print_section(title):
    """Print a formatted section header."""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")


def test_image_resolution(data_file: Path):
    """Test the image resolution pipeline."""
    print_section("🔍 IMAGE RESOLUTION TEST")
    
    if not data_file.exists():
        print(f"❌ Data file not found: {data_file}")
        return False
    
    print(f"📂 Loading data from: {data_file}")
    with open(data_file, "r") as f:
        data = json.load(f)
    
    print("\n📊 Original data structure:")
    print(f"   - institute.college_logo: {data.get('institute', {}).get('college_logo', '(missing)')}")
    print(f"   - institute.club_logo: {data.get('institute', {}).get('club_logo', '(missing)')}")
    
    images = data.get('images', {})
    photos = images.get('event_photos', [])
    print(f"   - images.event_photos: {len(photos)} items")
    for i, p in enumerate(photos):
        print(f"     [{i}] {p}")
    print(f"   - images.feedback_image: {images.get('feedback_image', '(missing)')}")
    print(f"   - images.poster_image: {images.get('poster_image', '(missing)')}")
    
    # Test copy_images_to_workdir
    print_section("📋 TESTING copy_images_to_workdir()")
    
    import tempfile
    with tempfile.TemporaryDirectory(prefix="report_debug_") as tmpdir:
        workdir = Path(tmpdir)
        print(f"📁 Temporary workdir: {workdir}")
        
        data_copy = gr.copy_images_to_workdir(data, workdir)
        
        print("\n✅ After copy_images_to_workdir:")
        print(f"   - institute.college_logo: {data_copy.get('institute', {}).get('college_logo', '(missing)')}")
        print(f"   - institute.club_logo: {data_copy.get('institute', {}).get('club_logo', '(missing)')}")
        
        images_copy = data_copy.get('images', {})
        photos_copy = images_copy.get('event_photos', [])
        print(f"   - images.event_photos: {len(photos_copy)} items")
        for i, p in enumerate(photos_copy):
            print(f"     [{i}] {p}")
        print(f"   - images.feedback_image: {images_copy.get('feedback_image', '(missing)')}")
        print(f"   - images.poster_image: {images_copy.get('poster_image', '(missing)')}")
        
        # Check what files were actually created
        print("\n📂 Files created in workdir:")
        for file in sorted(workdir.glob("*")):
            print(f"   - {file.name} ({file.stat().st_size} bytes)")
        
        # Test LaTeX generation
        print_section("📝 TESTING LaTeX GENERATION")
        
        photo_block = gr.build_photo_block(photos_copy)
        print(f"build_photo_block() output (~{len(photo_block)} chars):")
        print("---START---")
        print(photo_block[:500] if len(photo_block) > 500 else photo_block)
        if len(photo_block) > 500:
            print(f"... ({len(photo_block) - 500} more chars)")
        print("---END---\n")
        
        feedback_block = gr.optional_image(images_copy.get('feedback_image', ''))
        print(f"optional_image(feedback) output (~{len(feedback_block)} chars):")
        print("---START---")
        print(feedback_block if feedback_block else "(empty)")
        print("---END---\n")
        
        poster_block = gr.optional_image(images_copy.get('poster_image', ''))
        print(f"optional_image(poster) output (~{len(poster_block)} chars):")
        print("---START---")
        print(poster_block if poster_block else "(empty)")
        print("---END---\n")
    
    return True


def test_file_uploads(data_dir: Path):
    """Test what files are in the data directory."""
    print_section("📂 CHECKING DATA DIRECTORY")
    
    if not data_dir.exists():
        print(f"⚠️  Data directory does not exist: {data_dir}")
        return False
    
    print(f"📂 Contents of {data_dir}:")
    files = list(data_dir.glob("*"))
    if not files:
        print("   (empty)")
    else:
        for file in sorted(files):
            size = file.stat().st_size
            print(f"   - {file.name} ({size} bytes)")
    
    # Look for typical image patterns
    print("\n🔍 Image file patterns:")
    for pattern in ["*.png", "*.jpg", "*.jpeg"]:
        matches = list(data_dir.glob(pattern))
        if matches:
            print(f"   {pattern}: {len(matches)} files")
            for f in matches[:5]:
                print(f"     - {f.name}")
    
    return True


def test_json_payload(json_file: Path = None):
    """Test JSON payload structure."""
    print_section("🔍 JSON PAYLOAD STRUCTURE TEST")
    
    if json_file is None:
        # Look for recent report data files
        data_dir = Path(__file__).parent / "data"
        if data_dir.exists():
            jsons = list(data_dir.glob("report_data_*.json"))
            if jsons:
                json_file = sorted(jsons)[-1]  # Most recent
    
    if json_file is None or not json_file.exists():
        print("ℹ️  No JSON payload found to test")
        return False
    
    print(f"📄 Using: {json_file}")
    with open(json_file, "r") as f:
        payload = json.load(f)
    
    print("\n✅ Payload structure:")
    for key in ["institute", "event_meta", "participants", "images", "content"]:
        if key in payload:
            val = payload[key]
            if isinstance(val, dict):
                print(f"   {key}: {{dict}} {len(val)} keys")
            elif isinstance(val, list):
                print(f"   {key}: [list] {len(val)} items")
            else:
                print(f"   {key}: {type(val).__name__}")
    
    # Deep dive into images
    if "images" in payload:
        print("\n📊 Images in payload:")
        imgs = payload["images"]
        for k, v in imgs.items():
            if isinstance(v, list):
                print(f"   {k}: [list] {len(v)} items")
                for i, item in enumerate(v[:3]):
                    print(f"     [{i}] type={type(item).__name__} value={str(item)[:60]}")
                if len(v) > 3:
                    print(f"     ... and {len(v)-3} more")
            else:
                print(f"   {k}: type={type(v).__name__} value={str(v)[:60]}")
    
    return True


def main():
    """Run all debug tests."""
    root = Path(__file__).parent
    data_dir = root / "data"
    output_dir = root / "output"
    
    print("\n" + "="*70)
    print("   🔧 REPORT GENERATOR IMAGE DEBUG SUITE")
    print("="*70)
    print(f"⏰ Timestamp: {datetime.now().isoformat()}\n")
    
    # Test 1: Check file uploads
    test_file_uploads(data_dir)
    
    # Test 2: Check JSON payload
    test_json_payload()
    
    # Test 3: Full pipeline test
    sample_json = root / "report_data_sample.json"
    if sample_json.exists():
        print("\n📌 Testing with sample data...")
        test_image_resolution(sample_json)
    
    # Test 4: Look for recent generated reports
    recent_jsons = list(data_dir.glob("report_data_*.json"))
    if recent_jsons:
        latest = sorted(recent_jsons)[-1]
        print(f"\n📌 Testing with latest uploaded data: {latest.name}")
        test_image_resolution(latest)
    
    print_section("✅ DEBUG TEST COMPLETE")
    print("💡 Tips for debugging:")
    print("   1. Check if images are actually uploaded to data/")
    print("   2. Look for warnings/errors in the [PLACEHOLDER] sections")
    print("   3. Verify LaTeX blocks contain proper \\includegraphics commands")
    print("   4. Check if file patterns match what the API expects")
    print()


if __name__ == "__main__":
    main()
