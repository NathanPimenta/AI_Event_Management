import os
from PIL import Image, ImageDraw, ImageFont
from font_manager import FontManager

class PosterGenerator:
    def __init__(self, image_path):
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")
        self.image = Image.open(image_path).convert("RGBA")
        self.width, self.height = self.image.size
        self.font_manager = FontManager()

    def add_text(self, text, position, style_options):
        """
        Adds text to the poster with "Insta-worthy" styling options.
        
        Args:
            text (str): The text content.
            position (dict): {'x': val, 'y': val}
            style_options (dict): font, size, color, effect etc.
        """
        draw = ImageDraw.Draw(self.image)
        
        font_name = style_options.get('font', 'Roboto') # Default to Roboto
        font_size = style_options.get('size', 40)
        color = style_options.get('color', 'white')
        effect = style_options.get('effect', 'normal')
        align = style_options.get('align', 'center')

        # Load Font via FontManager
        font_path = self.font_manager.get_font_path(font_name)
        
        try:
            font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
             # Fallback if font_path is None (download failed)
            if not font_path:
                 print(f"Warning: Could not load or download font {font_name}, utilizing default.")
                 # Try a fallback that supports sizing if possible, otherwise load_default
                 try:
                     font = ImageFont.truetype("DejaVuSans.ttf", font_size)
                 except:
                     font = ImageFont.load_default()
        except IOError:
            print(f"Warning: Could not load font from {font_path}, utilizing default.")
            font = ImageFont.load_default()

        # Calculate text size for centering
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        x_val = position.get('x', 'center')
        y_val = position.get('y', 0)
        
        effective_x = x_val
        if x_val == "center":
            effective_x = (self.width - text_width) // 2
        else:
             effective_x = int(x_val)
             
        effective_y = int(y_val)
        
        # Draw Style Effects
        if effect == "shadow":
            shadow_color = "black"
            offset = max(2, font_size // 15)
            draw.text((effective_x + offset, effective_y + offset), text, font=font, fill=shadow_color, align=align)
        
        elif effect == "outline":
            outline_color = "black"
            stroke_width = max(1, font_size // 15)
            # Draw outline by drawing text in 4 directions
            for dx, dy in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
                draw.text((effective_x + dx * stroke_width, effective_y + dy * stroke_width), text, font=font, fill=outline_color, align=align)
            
        elif effect == "glow":
            # Simple glow effect
            glow_color = (255, 255, 255, 100) # White glow
            if color.lower() == "white" or color.lower() == "#ffffff":
                glow_color = (0, 0, 0, 100) # Black glow for white text
            
            # Using semi-transparent strokes for glow
            for i in range(1, 4):
                 draw.text((effective_x, effective_y), text, font=font, fill=glow_color, stroke_width=i*2, stroke_fill=glow_color, align=align)

        # Draw Main Text
        draw.text((effective_x, effective_y), text, font=font, fill=color, align=align)

    def save(self, output_path):
        self.image = self.image.convert("RGB") # Convert back to RGB for JPEG/PNG
        self.image.save(output_path)
        print(f"Poster saved to {output_path}")

# Example Integration function (Updated for new config)
def create_poster(image_path, output_path, config_data):
    """
    Wrapper to create a poster from a config dict.
    config_data: dict with keys: global_settings, layers
    """
    generator = PosterGenerator(image_path)
    
    # We could use global options here (like default font) but for now layer overrides are fine
    
    for layer in config_data.get('layers', []):
        if layer.get('type') == 'text':
            generator.add_text(
                text=layer.get('content', ''),
                position=layer.get('position', {'x': 'center', 'y': 0}),
                style_options=layer.get('style', {})
            )
    
    generator.save(output_path)
