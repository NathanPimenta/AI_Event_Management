import json
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate

class AIDesigner:
    def __init__(self, model_name="llama3"):
        self.llm = OllamaLLM(model=model_name)
    
    def design_poster(self, content_text, structure_intent, available_fonts, width=1080, height=1350):
        """
        Generates a poster configuration JSON based on content, intent, and available fonts.
        """
        
        system_prompt = f"""
        You are an award-winning graphic designer specializing in viral, Instagram-worthy event posters with a keen eye for modern aesthetics and visual impact.
        
        Canvas Specifications:
        - Width: {width}px (Standard Instagram portrait)
        - Height: {height}px
        - Aspect Ratio: 4:5 (Optimized for social media)
        
        CRITICAL: Output ONLY valid JSON. No markdown, no explanations, no preamble.

        Available Fonts: {{fonts}}

        JSON Schema (STRICT):
        {{{{
            "layers": [
                {{{{
                    "type": "text",
                    "content": "Display text",
                    "position": {{{{ "x": "center" | integer (0-{width}), "y": integer (0-{height}) }}}},
                    "style": {{{{
                        "font": "Font name from available list",
                        "size": integer,
                        "color": "#HEXCODE or color name",
                        "effect": "normal" | "shadow" | "outline" | "glow"
                    }}}}
                }}}}
            ]
        }}}}

        DESIGN PHILOSOPHY - "Scroll-Stopping" Impact:
        
        1. TYPOGRAPHY HIERARCHY (The Golden Rule):
           - PRIMARY (Event Name): 120-180px - MASSIVE, commanding attention
             • Use bold, display fonts with personality
             • Position: Upper third (Y: 150-400) for immediate impact
           
           - SECONDARY (Tagline/Subtitle): 40-70px - Supporting context
             • Complementary font or lighter weight of primary
             • Position: Just below primary (Y-spacing: 20-40px)
           
           - TERTIARY (Details): 28-45px - Readable information
             • Clean, legible sans-serif or serif
             • Position: Mid-canvas (Y: 600-900) organized in visual blocks
           
           - MICRO (Fine Print): 20-32px - Contact/secondary info
             • Same as tertiary but smaller
             • Position: Bottom quarter (Y: {height - 250} to {height - 100})

        2. SPATIAL COMPOSITION (Use Every Pixel Intentionally):
           - Top Margin: Start text at Y≥100 (breathing room)
           - Bottom Margin: End text at Y≤{height - 80}
           - Vertical Rhythm: Space elements 60-120px apart for clarity
           - Rule of Thirds: Place key elements at Y≈{int(height/3)} or Y≈{int(2*height/3)}
           - Symmetry vs Asymmetry: Center align (x: "center") for formal/elegant, offset for dynamic/edgy

        3. FONT PAIRING STRATEGIES:
           - **Contrast Pairing**: Bold display + Light sans-serif (e.g., Impact + Helvetica)
           - **Harmony Pairing**: Same family, different weights (e.g., Montserrat Bold + Regular)
           - **Personality Match**:
             • Corporate/Tech: Futura, Helvetica, Gotham, Roboto
             • Creative/Artsy: Bebas Neue, Playfair Display, Pacifico
             • Energetic/Youth: Poppins, Raleway, Oswald
             • Elegant/Upscale: Didot, Bodoni, Cinzel, Cormorant
             • Playful/Fun: Fredoka, Righteous, Archivo Black

        4. COLOR PSYCHOLOGY (High-Impact Choices):
           - **Neon/Vibrant**: #FF006E, #00F5FF, #FFBE0B, #8338EC (parties, music, youth events)
           - **Luxe/Premium**: #FFD700, #C0C0C0, #FFFFFF, #1A1A1A (VIP, galas, upscale)
           - **Bold/Energetic**: #FF4500, #00FF00, #FF1493, #FFFF00 (sports, festivals)
           - **Minimal/Modern**: #FFFFFF, #000000, #F5F5F5, #333333 (corporate, art exhibitions)
           - **Gradient-Ready**: Use multiple colors across layers for depth
           - Contrast Rule: Light text (#FFFFFF, #FFFACD) on dark concepts, dark text (#000000, #1A1A1A) on light

        5. VISUAL EFFECTS (Strategic Enhancement):
           - "glow": Use for neon/night event vibes, makes text pop on dark themes
           - "outline": Perfect for text over complex backgrounds, adds dimension
           - "shadow": Creates depth, use for daytime/bright posters
           - "normal": Clean look for minimalist/professional designs
           - Effect Color Harmony: Match effect intensity to font size (bigger = bolder effect)

        6. ADVANCED LAYOUT TECHNIQUES:
           - **Z-Pattern**: Eye flows top-left → top-right → middle-left → bottom-right
           - **F-Pattern**: For text-heavy content, arrange info in descending importance
           - **Center Burst**: Main text centered (x: "center"), supporting info radiates out
           - **Asymmetric Dynamic**: Offset main title (x: 100-200), balance with elements on opposite side
           - **Vertical Stacking**: All centered, vary font sizes dramatically for rhythm

        7. CONTENT BREAKDOWN STRATEGY:
           Parse the content into:
           - HERO: The ONE thing that should make someone stop scrolling (event name)
           - HOOK: Why should they care? (tagline, unique value)
           - INFO: Essential details (date, time, location)
           - ACTION: How to engage (contact, registration)

        8. QUALITY CHECKLIST (Before returning JSON):
           ✓ Does the main title occupy >25% of vertical space?
           ✓ Are there at least 3 distinct font sizes creating hierarchy?
           ✓ Is the bottom 20% of the canvas utilized (not empty)?
           ✓ Do colors have sufficient contrast (not muddy)?
           ✓ Would this stop a scroll at thumbnail size?
           ✓ Is every layer positioned with intentional Y-coordinate (not clustered)?

        EXECUTION STEPS:
        1. Identify the event type/vibe from content
        2. Select 2-3 complementary fonts that match the vibe
        3. Determine color palette based on mood
        4. Map content to hierarchy (Hero → Hook → Info → Action)
        5. Position elements using canvas height strategically
        6. Assign appropriate effects for visual impact
        7. Output clean JSON only
        """
        
        user_prompt = """
        RAW CONTENT:
        {content}

        LAYOUT INTENT/SPECIAL INSTRUCTIONS:
        {intent}
        
        TASK: Transform the above into a scroll-stopping poster design. Analyze the content's vibe, select fonts that amplify it, create dramatic size contrast, use the full canvas height intelligently, and choose colors that pop. Return ONLY the JSON configuration.
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", user_prompt)
        ])
        
        chain = prompt | self.llm
        
        fonts_str = ", ".join(available_fonts)
        
        try:
            response = chain.invoke({
                "fonts": fonts_str,
                "content": content_text,
                "intent": structure_intent
            })
            
            # Aggressive cleaning of response
            clean_response = response.strip()
            
            # Remove markdown code blocks
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            elif clean_response.startswith("```"):
                clean_response = clean_response[3:]
            
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            
            # Remove any leading/trailing whitespace again
            clean_response = clean_response.strip()
            
            # Fix common truncation issues
            # If response ends with ] but not }, it's likely missing the closing brace
            if clean_response.endswith("]") and not clean_response.endswith("}"):
                clean_response += "\n}"
            
            # Parse and validate JSON
            design_config = json.loads(clean_response)
            
            # Optional: Validate the structure
            if "layers" not in design_config:
                raise ValueError("Invalid JSON structure: missing 'layers' key")
            
            return design_config
            
        except Exception as e:
            print(f"❌ Error in AI Designer: {e}. Using fallback mock design.")
            # Fallback mock design
            return {
                "layers": [
                    {
                        "text": content_text.split('\n')[0] if content_text else "Event Title",
                        "position": {"x": "center", "y": 200},
                        "style": {
                            "font": available_fonts[0] if available_fonts else "Roboto",
                            "size": 80,
                            "color": "#FFFFFF",
                            "effect": "glow"
                        }
                    },
                    {
                        "text": "\n".join(content_text.split('\n')[1:]) if len(content_text.split('\n')) > 1 else "Event Details",
                        "position": {"x": "center", "y": 600},
                        "style": {
                            "font": available_fonts[1] if len(available_fonts) > 1 else "Open Sans",
                            "size": 40,
                            "color": "#FFFFFF",
                            "effect": "normal"
                        }
                    }
                ]
            }


# Example usage demonstrating improved prompting:
if __name__ == "__main__":
    designer = AIDesigner()
    
    # Example with rich content
    content = """
    SUMMER MUSIC FEST 2024
    3 Days of Non-Stop Beats
    June 15-17
    Sunset Beach Arena
    Featuring: DJ Nova, The Wavelengths, Electric Pulse
    Tickets: www.summerfest.com
    """
    
    intent = """
    Create a vibrant, energetic poster that screams summer party vibes.
    Use bold, attention-grabbing fonts for the festival name.
    Make it feel like a must-attend event with neon colors and dynamic layout.
    """
    
    fonts = ["Bebas Neue", "Montserrat", "Poppins", "Playfair Display", "Roboto"]
    
    result = designer.design_poster(content, intent, fonts)
    
    if result:
        print("✅ Generated Design:")
        print(json.dumps(result, indent=2))