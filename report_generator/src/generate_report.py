#!/usr/bin/env python3
"""
DBIT Event Report Generator
============================
Fills report_template.tex with data from a JSON file and compiles to PDF.

Usage:
    python generate_report.py --data report_data.json --output report.pdf

Requirements:
    pip install Pillow          # optional: for nicer fallback logos
    XeLaTeX (TeX Live / MikTeX)
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# ─── LaTeX escaping ───────────────────────────────────────────────────────────

def escape_latex(text: str) -> str:
    if not text:
        return ""
    text = str(text)
    for char, escaped in [
        ('\\', r'\textbackslash{}'), ('&', r'\&'), ('%', r'\%'),
        ('$', r'\$'), ('#', r'\#'), ('^', r'\^{}'), ('_', r'\_'),
        ('{', r'\{'), ('}', r'\}'), ('~', r'\textasciitilde{}'),
    ]:
        text = text.replace(char, escaped)
    return text


# ─── Block builders ───────────────────────────────────────────────────────────

def build_list_items(items: list) -> str:
    """Build LaTeX list items with proper escaping and filtering."""
    if not items:
        return "  \\item No information provided"
    
    clean_items = []
    for item in items:
        if item and str(item).strip():
            clean_items.append(escape_latex(str(item).strip()))
    
    if not clean_items:
        return "  \\item No information provided"
    
    return "\n".join(f"  \\item {item}" for item in clean_items)


def build_student_table(students: list) -> str:
    rows = []
    for i, s in enumerate(students, 1):
        rows.append(
            f"{i} & {escape_latex(str(s.get('name','')))} & "
            f"{escape_latex(str(s.get('branch','')))} \\\\ \\hline"
        )
    return "\n".join(rows)


def build_paragraphs(text: str) -> str:
    """Convert multi-line text into spaced LaTeX paragraphs with proper formatting."""
    if not text:
        return ""
    text = str(text).strip()
    # Split on double newlines first
    paras = re.split(r'\n{2,}', text)
    # For each paragraph, join lines and escape
    escaped = []
    for p in paras:
        # Clean up the paragraph text
        clean_p = " ".join(line.strip() for line in p.strip().splitlines() if line.strip())
        if clean_p:
            escaped.append(escape_latex(clean_p))
    return "\n\n\\par\n\n".join(escaped) if escaped else ""


def image_block(path: str, width: str = "0.70") -> str:
    """Generate LaTeX includegraphics block with proper environment."""
    if not path or not str(path).strip():
        return ""
    # Ensure path is clean and properly formatted for LaTeX
    path = str(path).strip()
    # Use center environment instead of centering command for better scoping
    return f"\\begin{{center}}\n\\includegraphics[width={width}\\textwidth]{{{path}}}\n\\end{{center}}"


def build_photo_block(paths: list) -> str:
    """Build photo block with proper spacing between images."""
    if not paths:
        return ""
    # Filter out empty paths and create image blocks
    blocks = []
    for p in paths:
        if p and str(p).strip():
            block = image_block(p)
            if block:
                blocks.append(block)
    
    if not blocks:
        return ""
    
    # Join blocks with vspace for better separation
    return "\n\\vspace{0.5cm}\n".join(blocks)


def optional_image(path: str) -> str:
    """Insert image only if path is valid and non-empty."""
    if not path or not str(path).strip():
        return ""
    # Ensure path doesn't have problematic characters before passing to LaTeX
    path = str(path).strip()
    if not Path(path).exists():
        print(f"  [WARNING] Image not found for inclusion: {path}")
        return ""
    return image_block(path)


def build_social_media(social: dict) -> str:
    lines = []
    for key, label in [("facebook","Facebook"),("instagram","Instagram"),("linkedin","LinkedIn")]:
        url = social.get(key, "").strip()
        if url:
            # Escape problematic LaTeX chars but preserve URL
            safe_url = url.replace("_", "\\_").replace("#", "\\#")
            lines.append(f"{label}: \\url{{{safe_url}}}")
    if not lines:
        return "No social media links provided"
    return " \\\\\n".join(lines)


# ─── Image handling ───────────────────────────────────────────────────────────

def make_fallback_logo(dest: Path, label: str = "LOGO"):
    """Generate a white placeholder PNG when no real logo is provided."""
    try:
        from PIL import Image, ImageDraw
        print(f"    ✨ Creating fallback logo with Pillow: {label}")
        img = Image.new("RGB", (200, 200), "white")
        d = ImageDraw.Draw(img)
        d.ellipse([10, 10, 190, 190], outline="navy", width=4)
        d.text((60, 85), label[:6], fill="navy")
        img.save(str(dest))
    except ImportError as e:
        print(f"    ⚠️  Pillow not available ({e}), using base64 fallback")
        import base64
        # Minimal valid 1x1 white PNG
        dest.write_bytes(base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
        ))
    except Exception as e:
        print(f"    ❌ Error creating fallback logo: {e}")
        import base64
        # Fallback fallback
        dest.write_bytes(base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
        ))


def copy_images_to_workdir(data: dict, workdir: Path) -> dict:
    """
    Copy all referenced images into the XeLaTeX workdir.
    Missing / blank images get a generated white placeholder.
    Returns a deep copy of data with all paths replaced by local filenames.
    """
    import copy
    data = copy.deepcopy(data)

    def _resolve(src_str: str, local_name: str, label: str = "LOGO") -> str:
        dest = workdir / local_name
        if not src_str or not str(src_str).strip():
            print(f"  [PLACEHOLDER] No source for {local_name}, creating fallback")
            make_fallback_logo(dest, label)
            return local_name
        src = Path(src_str)
        if not src.exists():
            print(f"  [WARNING] Not found: {src_str} — placeholder used for {local_name}")
            make_fallback_logo(dest, label)
            return local_name
        try:
            shutil.copy2(src, dest)
            print(f"  [OK] Copied {src_str} → {local_name}")
            return local_name
        except Exception as e:
            print(f"  [ERROR] Failed to copy {src_str}: {e}. Using placeholder.")
            make_fallback_logo(dest, label)
            return local_name

    inst   = data.setdefault("institute", {})
    images = data.setdefault("images", {})

    inst["college_logo"] = _resolve(inst.get("college_logo",""), "college_logo.png", "DBIT")
    inst["club_logo"]    = _resolve(inst.get("club_logo",""),    "club_logo.png",    "CLUB")

    photos = images.get("event_photos", [])
    resolved_photos = []
    for i, p in enumerate(photos):
        if p and str(p).strip():
            resolved_photos.append(_resolve(p, f"photo_{i}.png", f"Photo {i+1}"))
    
    images["event_photos"] = resolved_photos
    print(f"  [PHOTOS] Resolved {len(resolved_photos)} photos")

    if images.get("feedback_image"):
        images["feedback_image"] = _resolve(images["feedback_image"], "feedback.png", "Feedback")
    else:
        images["feedback_image"] = ""
        
    if images.get("poster_image"):
        images["poster_image"]   = _resolve(images["poster_image"],   "poster.png",   "Poster")
    else:
        images["poster_image"] = ""

    return data


# ─── Template filling ─────────────────────────────────────────────────────────

def fill_template(template_path: Path, data: dict) -> str:
    tmpl     = template_path.read_text(encoding="utf-8")
    inst     = data.get("institute",    {})
    meta     = data.get("event_meta",   {})
    parts    = data.get("participants", {})
    orgs     = data.get("organizers",   {})
    content  = data.get("content",      {})
    images   = data.get("images",       {})
    feedback = data.get("feedback",     {})
    social   = data.get("social_media", {})
    reg      = data.get("registration", {})
    sigs     = data.get("signatories",  {})
    e        = escape_latex

    # Debug logging for image paths
    photos_list = images.get("event_photos", [])
    print(f"\n📊 [TEMPLATE] Event photos: {len(photos_list)} items")
    for i, p in enumerate(photos_list):
        print(f"   Photo {i}: {p}")
    print(f"   Feedback image: {images.get('feedback_image', '(none)')}")
    print(f"   Poster image: {images.get('poster_image', '(none)')}\n")

    subs = {
        "VAR_COLLEGE_LOGO":          inst.get("college_logo", "college_logo.png"),
        "VAR_CLUB_LOGO":             inst.get("club_logo",    "club_logo.png"),
        "VAR_DEPARTMENT_NAME":       e(meta.get("department_name",    "")),
        "VAR_EVENT_TYPE":            e(meta.get("event_type",         "")),
        "VAR_TITLE":                 e(meta.get("title",              "")),
        "VAR_DATE":                  e(meta.get("date",               "")),
        "VAR_TIME":                  e(meta.get("time",               "")),
        "VAR_VENUE":                 e(meta.get("venue",              "")),
        "VAR_TARGET_AUDIENCE":       e(parts.get("target_audience",   "")),
        "VAR_TOTAL_PARTICIPANTS":    e(parts.get("total_participants", "")),
        "VAR_GIRL_PARTICIPANTS":     e(parts.get("girl_participants",  "")),
        "VAR_BOY_PARTICIPANTS":      e(parts.get("boy_participants",   "")),
        "VAR_RESOURCE_PERSON":       e(orgs.get("resource_person",    "")),
        "VAR_RESOURCE_ORGANIZATION": e(orgs.get("resource_org",       "")),
        "VAR_ORGANIZING_BODY":       e(orgs.get("organizing_body",    "")),
        "VAR_FACULTY_COORDINATOR":   e(orgs.get("faculty_coordinator","")),
        "VAR_OBJECTIVES":            build_list_items(content.get("objectives",         [])),
        "VAR_OUTCOMES":              build_list_items(content.get("outcomes",           [])),
        "VAR_DETAILED_REPORT":       build_paragraphs(content.get("detailed_report",    "")),
        "VAR_SNAPSHOT_DESCRIPTION":  build_paragraphs(content.get("snapshot_description","")),
        "VAR_EVENT_PHOTOS":          build_photo_block(images.get("event_photos",       [])),
        "VAR_FEEDBACK_IMAGE":        optional_image(images.get("feedback_image",        "")),
        "VAR_POSTER_IMAGE":          optional_image(images.get("poster_image",          "")),
        "VAR_FEEDBACK_TEXT":         build_paragraphs(feedback.get("feedback_text",     "")),
        "VAR_SOCIAL_MEDIA":          build_social_media(social),
        "VAR_DBIT_STUDENTS":         e(reg.get("dbit_students",                         "")),
        "VAR_NON_DBIT_STUDENTS":     e(reg.get("non_dbit_students",                     "")),
        "VAR_STUDENT_TABLE_ROWS":    build_student_table(reg.get("students",            [])),
        "VAR_PREPARED_NAME":         e(sigs.get("prepared_name",                        "")),
        "VAR_PREPARED_POST":         e(sigs.get("prepared_post",                        "")),
        "VAR_APPROVED_NAME":         e(sigs.get("approved_name",                        "")),
        "VAR_APPROVED_POST":         e(sigs.get("approved_post",                        "")),
    }

    for var, val in subs.items():
        tmpl = tmpl.replace(var, val)

    remaining = re.findall(r"VAR_\w+", tmpl)
    if remaining:
        print(f"  [WARNING] Unfilled placeholders: {set(remaining)}")
    return tmpl


# ─── Compilation ──────────────────────────────────────────────────────────────

def compile_latex(tex_source: str, output_pdf: Path, workdir: Path):
    tex_path = workdir / "report.tex"
    tex_path.write_text(tex_source, encoding="utf-8")

    for run in range(1, 3):
        print(f"  XeLaTeX pass {run}/2 ...")
        result = subprocess.run(
            ["xelatex", "-interaction=nonstopmode", "-halt-on-error", "report.tex"],
            cwd=workdir, capture_output=True, text=True,
        )
        if result.returncode != 0:
            log = workdir / "report.log"
            print("\n[ERROR] XeLaTeX failed. Last 40 log lines:")
            if log.exists():
                print("\n".join(log.read_text(errors="replace").splitlines()[-40:]))
            else:
                print(result.stdout[-2000:])
            sys.exit(1)

    compiled = workdir / "report.pdf"
    if not compiled.exists():
        print("[ERROR] No PDF produced.")
        sys.exit(1)

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(compiled, output_pdf)
    print(f"\n✅  Report saved → {output_pdf}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DBIT Event Report Generator")
    parser.add_argument("--data",     required=True,  help="Path to report_data.json")
    parser.add_argument("--template",
                        default=str(Path(__file__).parent / "report_template.tex"),
                        help="Path to report_template.tex")
    parser.add_argument("--output",   default="output/report.pdf", help="Output PDF path")
    parser.add_argument("--keep-tmp", action="store_true", help="Keep build dir for debugging")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"[ERROR] Data file not found: {data_path}"); sys.exit(1)
    print(f"📄 Loading: {data_path}")
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)

    template_path = Path(args.template)
    if not template_path.exists():
        print(f"[ERROR] Template not found: {template_path}"); sys.exit(1)

    output_pdf = Path(args.output)

    with tempfile.TemporaryDirectory(prefix="dbit_report_") as tmpdir:
        workdir = Path(tmpdir)
        print(f"🔧 Build dir: {workdir}")
        shutil.copy2(template_path, workdir / "report_template.tex")

        print("🖼️  Preparing images ...")
        data = copy_images_to_workdir(data, workdir)

        print("✏️  Filling template ...")
        filled = fill_template(workdir / "report_template.tex", data)

        print("⚙️  Compiling ...")
        compile_latex(filled, output_pdf, workdir)

        if args.keep_tmp:
            debug_dir = Path("build_debug")
            shutil.copytree(tmpdir, debug_dir, dirs_exist_ok=True)
            print(f"   Build files kept → {debug_dir}/")


if __name__ == "__main__":
    main()
