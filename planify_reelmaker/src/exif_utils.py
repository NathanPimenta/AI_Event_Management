"""Utilities to extract EXIF timestamps from image files.

Tries to use `exiftool` (preferred), falling back to `exifread` (pure-Python) if available.
Returns a dict mapping file path -> datetime (or None if not found).
"""
from datetime import datetime
import subprocess
import json
import re
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


def _parse_exif_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    s = s.strip()
    # Replace leading date colons (YYYY:MM:DD) -> YYYY-MM-DD
    s2 = re.sub(r"^(\d{4}):(\d{2}):(\d{2})", r"\1-\2-\3", s)
    try:
        # Try ISO parsing (handles timezone if present)
        return datetime.fromisoformat(s2)
    except Exception:
        try:
            return datetime.strptime(s2[:19], "%Y-%m-%d %H:%M:%S")
        except Exception:
            logger.debug("Failed to parse EXIF date: %s", s)
            return None


def _run_exiftool(paths: List[str]) -> Optional[Dict[str, Optional[datetime]]]:
    if not paths:
        return {}
    cmd = ["exiftool", "-DateTimeOriginal", "-CreateDate", "-j"] + paths
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        arr = json.loads(proc.stdout)
        out = {}
        for e in arr:
            src = e.get("SourceFile")
            dt = e.get("DateTimeOriginal") or e.get("CreateDate")
            parsed = _parse_exif_date(dt)
            out[src] = parsed
        return out
    except FileNotFoundError:
        logger.debug("exiftool not found on PATH")
    except subprocess.CalledProcessError as e:
        logger.warning("exiftool failed: %s", e)
    except json.JSONDecodeError:
        logger.warning("Failed to decode exiftool JSON output.")
    return None


def _fallback_exifread(paths: List[str]) -> Dict[str, Optional[datetime]]:
    try:
        import exifread
    except Exception:
        logger.debug("exifread not installed")
        return {}

    out = {}
    for p in paths:
        try:
            with open(p, "rb") as fh:
                tags = exifread.process_file(fh, stop_tag="DateTimeOriginal")
                dt = None
                for tagname in ("EXIF DateTimeOriginal", "EXIF DateTimeDigitized", "Image DateTime"):
                    if tagname in tags:
                        dt = str(tags[tagname])
                        break
                parsed = _parse_exif_date(dt)
                out[p] = parsed
        except Exception as e:
            logger.debug("exifread error for %s: %s", p, e)
            out[p] = None
    return out


def get_timestamps(paths: List[str]) -> Dict[str, Optional[datetime]]:
    """Return a mapping path -> datetime (or None) for the given file paths.

    Tries exiftool first. If exiftool is not available or fails, falls back to exifread.
    """
    if not paths:
        return {}

    # Try exiftool
    exiftool_out = _run_exiftool(paths)
    if exiftool_out is not None:
        # Normalize keys: exiftool may return relative or absolute paths depending on invocation
        # We'll map using exact strings where possible, otherwise try basename matching
        out = {}
        for p in paths:
            if p in exiftool_out:
                out[p] = exiftool_out[p]
            else:
                # try basename match
                b = p.split("/")[-1]
                matched = None
                for k, v in exiftool_out.items():
                    if k.endswith(b):
                        matched = v
                        break
                out[p] = matched
        return out

    # Fallback to exifread
    fallback = _fallback_exifread(paths)
    return fallback
