from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import io
import pandas as pd
import numpy as np
import ollama
import json
import re


class DataIntakeAgent:
    """Loads participant data from multiple input types into a DataFrame."""

    def load_participants(self, csv_source) -> pd.DataFrame:
        try:
            if isinstance(csv_source, pd.DataFrame):
                return csv_source.copy()
            if isinstance(csv_source, (str, Path)):
                return pd.read_csv(csv_source)
            if hasattr(csv_source, "read"):
                return pd.read_csv(csv_source)
            if isinstance(csv_source, (bytes, bytearray)):
                return pd.read_csv(io.BytesIO(csv_source))
            if isinstance(csv_source, np.ndarray):
                return pd.DataFrame(csv_source)
            if isinstance(csv_source, (list, dict)):
                return pd.DataFrame(csv_source)
            raise TypeError(f"Unsupported csv_path type: {type(csv_source)}")
        except Exception as e:
            raise RuntimeError(f"Failed to load participants: {e}") from e


class TemplateIdentifierAgent:
    """Identifies the appropriate template or structure based on user intent."""

    def identify_template(self, prompt: str | None) -> str:
        """
        Determines the template style based on the user's prompt.
        Simple keyword matching for now, but could be expanded to use LLM.
        """
        if not prompt:
            return "modern"
        
        prompt_lower = prompt.lower()
        if "formal" in prompt_lower or "classic" in prompt_lower:
            return "formal"
        if "modern" in prompt_lower or "clean" in prompt_lower:
            return "modern"
        
        # Default fallback
        return "modern"


class TemplateAnalysisAgent:
    """Analyzes a Jinja2 template to identify required data fields."""

    def analyze_template(self, template_content: str) -> list[str]:
        """
        Parses the template to find all {{ variable }} placeholders.
        Returns a list of unique variable names that need to be populated by the user.
        Excludes system variables like 'layout', 'design', 'colors', 'fonts'.
        """
        # Regex to find {{ variable }} or {{ variable | filter }}
        # capturing the variable name at the start
        # Matches {{ my_var }} or {{ my_var|filter }} or {{ object.prop }}
        pattern = r"\{\{\s*([a-zA-Z0-9_]+)(\.[a-zA-Z0-9_]+)?\s*\|?.*?\s*\}\}"
        
        matches = re.findall(pattern, template_content)
        
        # Extract just the base variable name (e.g. 'colors' from 'colors.background')
        variables = set()
        for match in matches:
            var_name = match[0] # The first group is the base variable name
            variables.add(var_name)
            
        # Filter out system variables
        system_vars = {
            "layout", "design", "colors", "fonts", "styles", 
            "logo_path", "club_logo_path", "college_logo_path", 
            "signature_path", "qr_code_path", "font_path"
        }
        
        required_fields = [v for v in variables if v not in system_vars]
        return sorted(required_fields)


class DesignAgent:
    """Generates comprehensive design specifications (colors, fonts, styles)."""

    def generate_design(self, theme_prompt: str | None) -> dict:
        if not theme_prompt:
            return self._get_default_design()
            
        print(f"   - 🎨 DesignAgent: Dreaming up a design for '{theme_prompt}'...")
        try:
            prompt = f"""
            Create a CSS design system for a certificate based on this theme: '{theme_prompt}'.
            Return ONLY a valid JSON object with these keys:
            - "colors": object with "background", "text", "accent", "header", "border" (all hex codes)
            - "fonts": object with "header_family" (e.g. 'Playfair Display', serif), "body_family" (e.g. 'Roboto', sans-serif)
            - "styles": object with "border_width" (e.g. "2px"), "border_style" (e.g. "solid"), "shadow" (css box-shadow value)
            
            Ensure high contrast between background and text colors.
            Example:
            {{
                "colors": {{ "background": "#f0f0f0", "text": "#333333", "accent": "#bdc3c7", "header": "#2c3e50", "border": "#2c3e50" }},
                "fonts": {{ "header_family": "'Cinzel', serif", "body_family": "'Lato', sans-serif" }},
                "styles": {{ "border_width": "5px", "border_style": "double", "shadow": "0 4px 6px rgba(0,0,0,0.1)" }}
            }}
            """
            response = ollama.chat(
                model='llama3:8b',
                messages=[{'role': 'user', 'content': prompt}],
                options={'temperature': 0.7}
            )
            content = response.get('message', {}).get('content', '').strip()
            
            # Robust JSON extraction
            json_str = ""
            # 1. Try to find markdown code block first
            code_block_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if code_block_match:
                json_str = code_block_match.group(1)
            else:
                # 2. Fallback to finding the first { and last }
                start_idx = content.find('{')
                end_idx = content.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    json_str = content[start_idx : end_idx + 1]
            
            if json_str:
                try:
                    design_data = json.loads(json_str)
                    
                    # Ensure "colors" exists and has all required keys with valid values
                    defaults = self._get_default_design()
                    if "colors" not in design_data or not isinstance(design_data["colors"], dict):
                        design_data["colors"] = defaults["colors"]
                    else:
                        for k, v in defaults["colors"].items():
                            if k not in design_data["colors"] or not design_data["colors"][k]:
                                design_data["colors"][k] = v
                                
                    # Ensure "fonts" exists
                    if "fonts" not in design_data or not isinstance(design_data["fonts"], dict):
                         design_data["fonts"] = defaults["fonts"]
                    else:
                         for k, v in defaults["fonts"].items():
                             if k not in design_data["fonts"] or not design_data["fonts"][k]:
                                 design_data["fonts"][k] = v

                    # Ensure "styles" exists
                    if "styles" not in design_data or not isinstance(design_data["styles"], dict):
                         design_data["styles"] = defaults["styles"]
                    else:
                        for k, v in defaults["styles"].items():
                            if k not in design_data["styles"] or not design_data["styles"][k]:
                                design_data["styles"][k] = v
                     
                    return self._enforce_contrast(design_data)
                except json.JSONDecodeError:
                    print(f"   - ⚠️ DesignAgent: JSON decode error from LLM output. Using defaults.")
                    pass
            
            print(f"   - ⚠️ DesignAgent: Could not parse JSON. Raw: {content[:100]}...")
            return self._get_default_design()

        except Exception as e:
            print(f"   - ⚠️ DesignAgent: Failed to generate design: {e}")
            return self._get_default_design()

    def _get_default_design(self):
        return {
            "colors": { 
                "background": "#ffffff", 
                "text": "#333333", 
                "accent": "#000000", 
                "header": "#000000", 
                "border": "#444444" 
            },
            "fonts": { 
                "header_family": "serif", 
                "body_family": "sans-serif" 
            },
            "styles": {
                "border_width": "10px",
                "border_style": "solid",
                "shadow": "0 4px 6px rgba(0,0,0,0.1)"
            }
        }

    def _enforce_contrast(self, design: dict) -> dict:
        """Ensures that text is readable against the background."""
        colors = design.get("colors", {})
        # Ensure fallback for safety
        bg = colors.get("background") or "#ffffff"
        text = colors.get("text") or "#000000"
        header = colors.get("header") or "#000000"
        
        # Explicitly set them back to ensure no None values persist
        colors["background"] = bg
        colors["text"] = text
        colors["header"] = header

        if self._is_low_contrast(bg, text):
            print("   - 🔧 DesignAgent: Fixing low contrast for body text.")
            colors["text"] = self._get_contrasting_color(bg)
        
        if self._is_low_contrast(bg, header):
            print("   - 🔧 DesignAgent: Fixing low contrast for header text.")
            colors["header"] = self._get_contrasting_color(bg)
            
        design["colors"] = colors
        return design

    def _is_low_contrast(self, hex1, hex2):
        # precise contrast calculation is complex, let's use a simple luminance heuristic
        # or even simpler: check if both are dark or both are light
        l1 = self._get_luminance(hex1)
        l2 = self._get_luminance(hex2)
        return abs(l1 - l2) < 0.4 # Threshold for "too similar"

    def _get_luminance(self, hex_color):
        try:
            hex_color = str(hex_color).lstrip('#')
            if len(hex_color) == 3:
                hex_color = "".join([c*2 for c in hex_color])
            r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            # Relative luminance formula
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255
        except:
            return 0.5 # Fail safe

    def _get_contrasting_color(self, hex_color):
        if self._get_luminance(hex_color) > 0.5:
            return "#000000" # Dark text for light bg
        else:
            return "#ffffff" # Light text for dark bg


class LayoutAgent:
    """Calculates layout metrics to ensure no overlap and proper sizing."""

    def build_layout(self, config: dict, design: dict) -> dict:
        """
        Determines layout properties. 
        """
        style = (config.get("style") or "modern").lower()
        
        # Base layout values
        # Increased values to keep logos away from borders (safe area)
        layout = {
            "logo_width": "110px",
            "logo_max_height": "64px",
            "content_top": "85px", # Pushed down
            "inner_pad": "60px",   # More padding
            "watermark_opacity": "0.06",
            "seal_text": "Awarded",
            "title_font_size": "2.5rem",
            "body_font_size": "1rem",
            # Fixed Logo positioning - "Lower and more inner"
            "fixed_logo_top": "40px", 
            "fixed_logo_side": "50px"
        }

        # Adjust based on style/template
        if style == "formal":
            layout.update({
                "logo_width": "120px",
                "content_top": "90px",
                "inner_pad": "70px",
                "watermark_opacity": "0.05",
                "seal_text": "Certified",
                "title_font_size": "3rem",
            })

        # Adjust based on DesignAgent output (if available)
        if design and "styles" in design:
            # If the design calls for a thick border, increase padding further
            border_width = design["styles"].get("border_width", "0px")
            if "px" in border_width:
                 try:
                    px_val = int(re.search(r'\d+', border_width).group())
                    if px_val > 15:
                        layout["inner_pad"] = "80px"
                        layout["fixed_logo_top"] = "60px"
                        layout["fixed_logo_side"] = "70px"
                 except:
                     pass

        # Check for user overrides
        overrides = config.get("layout")
        if isinstance(overrides, dict):
            layout.update({k: v for k, v in overrides.items() if v})

        return layout


@dataclass
class AssetPaths:
    club_logo_path: str | None
    college_logo_path: str | None
    signature_path: str | None
    font_path: str | None


class AssetsAgent:
    """Resolves asset paths for rendering."""

    def __init__(self, assets_dir: Path):
        self.assets_dir = assets_dir

    def resolve_paths(self, config: dict) -> AssetPaths:
        club_logo_path = config.get("club_logo_path") or config.get("logo_path")
        college_logo_path = config.get("college_logo_path")
        signature_path = config.get("signature_path")

        if club_logo_path:
            club_logo_path = str(Path(club_logo_path).resolve())

        if not college_logo_path:
            default_college = self.assets_dir / "logos" / "logo.png"
            if default_college.exists():
                college_logo_path = str(default_college.resolve())
        if not college_logo_path and club_logo_path:
            college_logo_path = club_logo_path
        if college_logo_path:
            college_logo_path = str(Path(college_logo_path).resolve())

        if signature_path:
            signature_path = str(Path(signature_path).resolve())

        font_path = str((self.assets_dir / "fonts" / "Merriweather-Regular.ttf").resolve())

        return AssetPaths(
            club_logo_path=club_logo_path,
            college_logo_path=college_logo_path,
            signature_path=signature_path,
            font_path=font_path,
        )


class QualityControlAgent:
    """Reinforcer type agent that checks the certificate before final generation."""
    
    def audit_context(self, context: dict) -> dict:
        """
        Inspects the render context for potential issues like low contrast,
        missing assets, or bad layout values. Returns a corrected context.
        """
        print("   - 🕵️ QualityControlAgent: Inspecting certificate parameters...")
        
        # 0. Ensure all color values are valid (not None)
        colors = context.get("colors", {})
        default_colors = {
            "background": "#ffffff",
            "text": "#333333",
            "accent": "#000000",
            "header": "#000000",
            "border": "#444444"
        }
        # Ensure defaults exist
        for key, default_val in default_colors.items():
            if key not in colors:
                colors[key] = default_val
        
        # Validate ALL values
        for key in list(colors.keys()):
            if colors[key] is None or str(colors[key]) == "None":
                fallback = default_colors.get(key, "#000000")
                print(f"     -> ⚠️ Color '{key}' was None. Using fallback: {fallback}")
                colors[key] = fallback
        context["colors"] = colors
        
        # 1. Double check contrast (Redundancy is good)
        bg = colors.get("background", "#ffffff")
        text = colors.get("text", "#000000")
        
        if self._is_same_color(bg, text):
             print("     -> 🚨 Issue discovered: Background and text color are too similar!")
             # Fix it
             if self._is_dark(bg):
                 colors["text"] = "#ffffff"
             else:
                 colors["text"] = "#000000"
             context["colors"] = colors

        # 2. Ensure fonts are valid
        fonts = context.get("fonts", {})
        default_fonts = {
            "header_family": "serif",
            "body_family": "sans-serif"
        }
        # Ensure defaults
        for key, default_val in default_fonts.items():
            if key not in fonts:
                fonts[key] = default_val
        # Validate all
        for key in list(fonts.keys()):
            if fonts[key] is None or str(fonts[key]) == "None":
                 fallback = default_fonts.get(key, "sans-serif")
                 print(f"     -> ⚠️ Font '{key}' was None. Using fallback: {fallback}")
                 fonts[key] = fallback
        context["fonts"] = fonts

        # 3. Ensure styles are valid
        styles = context.get("styles", {})
        default_styles = {
            "border_width": "10px",
            "border_style": "solid",
            "shadow": "0 4px 6px rgba(0,0,0,0.1)"
        }
        # Ensure defaults
        for key, default_val in default_styles.items():
            if key not in styles:
                styles[key] = default_val
        # Validate all
        for key in list(styles.keys()):
            if styles[key] is None or str(styles[key]) == "None":
                 fallback = default_styles.get(key, "solid")
                 print(f"     -> ⚠️ Style '{key}' was None. Using fallback: {fallback}")
                 styles[key] = fallback
        context["styles"] = styles

        # 4. Check layout safety
        layout = context.get("layout", {})
        default_layout = {
            "content_top": "80px",
            "inner_pad": "60px",
            "logo_width": "120px",
            "title_font_size": "3rem",
            "body_font_size": "1rem",
            "watermark_opacity": "0.05",
            "fixed_logo_top": "40px",
            "fixed_logo_side": "50px"
        }
        # Ensure defaults
        for key, default_val in default_layout.items():
            if key not in layout:
                layout[key] = default_val
        # Validate all
        for key in list(layout.keys()):
            if layout[key] is None or str(layout[key]) == "None":
                 fallback = default_layout.get(key, "0")
                 print(f"     -> ⚠️ Layout '{key}' was None. Using fallback: {fallback}")
                 layout[key] = fallback
        
        try:
            top_margin = int(re.search(r'\d+', layout.get("fixed_logo_top", "24px")).group())
            if top_margin < 30:
                 print("     -> 🚨 Issue discovered: Fixed logos might be too high. Adjusting.")
                 layout["fixed_logo_top"] = "40px"
        except:
            pass
            
        context["layout"] = layout
        print("   - ✅ QualityControlAgent: Audit passed (with fixes if needed).")
        return context

    def _is_dark(self, hex_color):
        return self._get_luminance(hex_color) < 0.5

    def _get_luminance(self, hex_color):
         # Copy of DesignAgent logic, or could accept DesignAgent instance
        try:
            hex_color = str(hex_color).lstrip('#')
            if len(hex_color) == 3: hex_color = "".join([c*2 for c in hex_color])
            r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255
        except:
            return 1 # Assume light if fail

    def _is_same_color(self, c1, c2):
        return abs(self._get_luminance(c1) - self._get_luminance(c2)) < 0.2


class StructureAgent:
    """Builds the per-certificate render context."""

    def build_context(
        self,
        participant: dict,
        config: dict,
        assets: AssetPaths,
        qr_code_path: str,
        design: dict,
        layout: dict,
    ) -> dict:
        name = participant.get("name", "N/A")
        achievement = participant.get("achievement_type", "Participation")
        
        colors = design.get("colors", {})
        fonts = design.get("fonts", {})
        styles = design.get("styles", {})

        return {
            "name": name,
            "event_name": config["event_name"],
            "event_date": config["event_date"],
            "institution_name": config["institution_name"],
            "achievement_type": achievement,
            "club_logo_path": assets.club_logo_path,
            "college_logo_path": assets.college_logo_path,
            "logo_path": assets.club_logo_path, 
            "signature_path": assets.signature_path,
            "signature_name": config["signature_name"],
            "qr_code_path": qr_code_path,
            "font_path": assets.font_path,
            
            "design": design,
            "colors": colors,
            "fonts": fonts,
            "styles": styles,
            "layout": layout,
        }


class RenderAgent:
    """Renders the HTML and PDF output."""

    def __init__(self, template, inject_fixed_logos_fn, create_pdf_fn):
        self.template = template
        self._inject_fixed_logos = inject_fixed_logos_fn
        self._create_pdf = create_pdf_fn

    def _sanitize_html(self, html_str: str) -> str:
        """
        Cleans up rendered HTML to prevent weasyprint errors.
        Removes any 'None' values that might appear in CSS properties.
        """
        # Replace any occurrence of "None" as a CSS value with a safe default
        html_str = re.sub(r':\s*None\s*([;}\n])', r': #000000\1', html_str)  # color: None -> color: #000000
        # Also handle CSS variables with None values
        html_str = re.sub(r'(--[\w-]+):\s*None\s*;', r'\1: #000000;', html_str)
        return html_str

    def render_html(self, context: dict) -> str:
        # 1. Render template
        raw_html = self.template.render(context)
        
        # 2. Sanitize against None values
        sanitized_html = self._sanitize_html(raw_html)
        
        # 3. Inject Logos
        final_html = self._inject_fixed_logos(
            sanitized_html,
            context.get("college_logo_path"),
            context.get("club_logo_path"),
            context.get("layout", {})
        )
        return final_html

    def render_pdf(self, html_content: str, output_path: Path) -> None:
        self._create_pdf(html_content, output_path)
