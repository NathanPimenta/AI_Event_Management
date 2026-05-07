import os
import requests
import zipfile
import io
import glob

class FontManager:
    def __init__(self, fonts_dir="poster_generator/fonts", api_key=None):
        self.fonts_dir = fonts_dir
        self.api_key = api_key or os.environ.get("GOOGLE_FONTS_API_KEY")
        if not os.path.exists(self.fonts_dir):
            os.makedirs(self.fonts_dir)

    def fetch_available_fonts(self, sort="popularity", limit=50):
        """
        Fetches a list of available font names from Google Fonts API.
        Returns a hardcoded top list if API key is invalid/missing to ensure continuity.
        """
        if not self.api_key:
            print("No Google Fonts API Key provided. Using fallback popular font list.")
            return [
                "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald", "Raleway", 
                "Nunito", "Merriweather", "Poppins", "Playfair Display", "Lobster", 
                "Pacifico", "Bebas Neue", "Anton", "Dancing Script"
            ]

        url = f"https://www.googleapis.com/webfonts/v1/webfonts?key={self.api_key}&sort={sort}"
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            fonts = [item['family'] for item in data.get('items', [])]
            return fonts[:limit]
        except Exception as e:
            print(f"Error fetching fonts from API: {e}. Using fallback.")
            return ["Roboto", "Open Sans", "Lobster", "Oswald", "Pacifico"]

    def get_font_path(self, font_name):
        """
        Returns the path to the font file. Downloads it if not present.
        """
        # 1. Check if font exists locally
        # We search recursively because the zip might contain subfolders
        # Normalize font name by removing spaces for file search if needed, but usually keeping them is safer for glob
        # Start with exact match
        search_pattern = os.path.join(self.fonts_dir, "**", f"*{font_name}*.ttf")
        found_fonts = glob.glob(search_pattern, recursive=True)
        
        # Also check for .otf
        if not found_fonts:
            search_pattern = os.path.join(self.fonts_dir, "**", f"*{font_name}*.otf")
            found_fonts = glob.glob(search_pattern, recursive=True)

        if found_fonts:
            # Filter somewhat to prefer "Regular" or "Bold" if multiple are found, otherwise just first
            regular_fonts = [f for f in found_fonts if "Regular" in f or "Bold" not in f and "Italic" not in f]
            if regular_fonts:
                return regular_fonts[0]
            return found_fonts[0]

        # 2. Download if not found
        return self._download_font(font_name) 
# ... rest of file ( _download_font implementation matches previous )


    def _download_font(self, font_name):
        print(f"Downloading font: {font_name}...")
        
        # Method 1: Use API if key is available (Preferred/Reliable)
        if self.api_key:
            try:
                # API seems to require exact casing, but let's try
                url = f"https://www.googleapis.com/webfonts/v1/webfonts?key={self.api_key}&family={font_name}"
                response = requests.get(url)
                if response.status_code == 200:
                    data = response.json()
                    items = data.get('items', [])
                    if items:
                        font_data = items[0]
                        files = font_data.get('files', {})
                        # Prefer regular, then 400, then whatever is there
                        font_url = files.get('regular') or files.get('400') or list(files.values())[0]
                        
                        # Download the ttf content
                        r = requests.get(font_url)
                        r.raise_for_status()
                        
                        output_path = os.path.join(self.fonts_dir, f"{font_name}.ttf")
                        with open(output_path, 'wb') as f:
                            f.write(r.content)
                            
                        print(f"Successfully downloaded {font_name} via API")
                        return output_path
            except Exception as e:
                print(f"API download failed for {font_name}: {e}. Falling back to zip download.")

        # Method 2: Fallback to google fonts download endpoint (Fragile)
        # Note: encoding space as + is standard for this url
        safe_font_name = font_name.replace(" ", "+")
        url = f"https://fonts.google.com/download?family={safe_font_name}"
        try:
            # Adding User-Agent usually fixes the "not a zip file" (HTML blocking) issue
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            # Check if likely a zip (PK header)
            if response.content[:2] != b'PK':
                print("Response is not a valid zip file.")
                return None

            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                z.extractall(self.fonts_dir)
            
            print(f"Successfully downloaded {font_name} via Zip")
            
            # recursive search again
            return self.get_font_path(font_name)
            
        except requests.exceptions.HTTPError as e:
            print(f"Error downloading font '{font_name}': {e}")
            return None
        except Exception as e:
            print(f"Unexpected error downloading font: {e}")
            return None

if __name__ == "__main__":
    fm = FontManager()
    path = fm.get_font_path("Roboto")
    print(f"Font path: {path}")
