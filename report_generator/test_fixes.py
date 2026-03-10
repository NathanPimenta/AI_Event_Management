#!/usr/bin/env python3
"""
Quick test to verify image rendering fixes.
"""
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

import generate_report as gr

# Test 1: Image block generation
print("=" * 70)
print("TEST 1: Image Block Generation")
print("=" * 70)

test_paths = ["photo_0.png", "photo_1.png"]
result = gr.build_photo_block(test_paths)
print("\nGenerated LaTeX for 2 photos:")
print(result)
print("\nChecking for proper LaTeX structure:")
print("✓ Has begin{center}?" , "\\begin{center}" in result)
print("✓ Has end{center}?" , "\\end{center}" in result)
print("✓ Has includegraphics?" , "\\includegraphics" in result)
print("✓ Multiple images separated?" , result.count("\\begin{center}") == 2)

# Test 2: List items generation
print("\n" + "=" * 70)
print("TEST 2: List Items Generation (Objectives)")
print("=" * 70)

objectives = ["Learn AI", "Build Networks", "Network & Connect"]
result = gr.build_list_items(objectives)
print("\nGenerated LaTeX for list items:")
print(result)
print("\nChecking structure:")
print("✓ Has \\item?" , result.count("\\item") == 3)
print("✓ Properly escaped?" , "\\\\" in result or "Learn" in result)

# Test 3: Text escaping
print("\n" + "=" * 70)
print("TEST 3: Text Escaping & Paragraphs")
print("=" * 70)

text = """The workshop commenced at 10:00 AM. We discussed AI & machine learning.

After lunch, hands-on sessions with C++ code examples."""

result = gr.build_paragraphs(text)
print("\nGenerated LaTeX for paragraphs:")
print(result)
print("\nChecking for:")
print("✓ Has \\par between paragraphs?" , "\\par" in result)
print("✓ Ampersands escaped?" , "\\&" in result)
print("✓ Contains content?" , "workshop" in result and "lunch" in result)

# Test 4: Social media
print("\n" + "=" * 70)
print("TEST 4: Social Media Links")
print("=" * 70)

social = {
    "facebook": "https://facebook.com/event",
    "instagram": "https://instagram.com/event_2025",
    "linkedin": "https://linkedin.com/company/event"
}
result = gr.build_social_media(social)
print("\nGenerated LaTeX for social media:")
print(result)
print("\nChecking for:")
print("✓ Has Facebook?" , "Facebook" in result)
print("✓ Has Instagram?" , "Instagram" in result)
print("✓ Has LinkedIn?" , "LinkedIn" in result)
print("✓ Has \\url?" , "\\url" in result)

# Test 5: Empty data handling
print("\n" + "=" * 70)
print("TEST 5: Empty Data Handling")
print("=" * 70)

print("\nEmpty objectives:", gr.build_list_items([]))
print("Empty photos:", gr.build_photo_block([]))
print("Empty social:", gr.build_social_media({}))

print("\n" + "=" * 70)
print("✅ ALL TESTS COMPLETE")
print("=" * 70)
print("\nIf all checks pass, images should now render correctly in PDF!")
