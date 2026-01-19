
import os
import json
import google.generativeai as genai
from typing import List, Dict, Any
from dotenv import load_dotenv
from pathlib import Path

# Explicitly load .env from scraper_module/ directory
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    # Fallback to standard search if file not found there
    load_dotenv()

class GeminiScraper:
    """
    Uses Google Gemini API to 'scrape' (generate) candidate leads for events.
    """
    
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            # Check if we can find it in the run environment
            print(f"   ⚠️ Warning: GEMINI_API_KEY not found in {env_path}")
        
        if not api_key:
             raise ValueError("GEMINI_API_KEY not found. Please check scraper_module/.env")
        
        genai.configure(api_key=api_key)
        # Use gemini-2.0-flash as requested
        self.model = genai.GenerativeModel('gemini-2.0-flash')

        
    def find_candidates(self, event_details: Dict[str, Any], role: str, count: int = 10) -> List[Dict[str, Any]]:
        """
        Finds candidates for a specific role at an event using Gemini.
        """
        event_name = event_details.get("name", "Unknown Event")
        event_type = event_details.get("type", "event")
        location = event_details.get("location", "Unknown Location")
        description = event_details.get("description", "")
        
        print(f"   🤖 Gemini Scraper: Searching for {count} {role} for {event_name}...")
        
        prompt = f"""
        You are an expert event recruiter. I need you to find potential candidates for the role of "{role}" for the following event:
        
        Event: {event_name}
        Type: {event_type}
        Location: {location}
        Description: {description}
        
        Task: Identify {count} real people who would be suitable {role} for this event. 
        Focus on experts in the relevant field.
        
        You MUST return the result as a Valid JSON Array. Do not include markdown formatting (like ```json).
        Each item in the array must have these fields:
        - name: Full name
        - title: Current job title
        - company: Current organization
        - bio: A brief 1-sentence bio explaining why they fit this event
        - email: A plausible professional email address (or "Not Available")
        - linkedin: LinkedIn profile URL (or "Not Available")
        
        Ensure the people are real and relevant to the event domain.
        """
        
        try:
            response = self.model.generate_content(prompt)
            content = response.text.strip()
            
            # loose cleanup if gemini adds markdown
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            try:
                data = json.loads(content)
            except json.JSONDecodeError as je:
                print(f"   ⚠️ Gemini JSON Parse Error: {je}")
                print(f"   ⚠️ Raw Content: {content[:500]}...") # Print first 500 chars to debug
                return []
            
            if isinstance(data, list):
                print(f"   ✅ Gemini found {len(data)} candidates")
                return data
            else:
                print(f"   ⚠️ Gemini returned unexpected format: {type(data)}")
                return []
                
        except Exception as e:
            print(f"   ⚠️ Gemini API error: {e}")
            return []

if __name__ == "__main__":
    # Test run
    try:
        scraper = GeminiScraper()
        details = {"name": "PyCon India 2025", "type": "conference", "location": "Bangalore"}
        results = scraper.find_candidates(details, "speakers", count=2)
        print(json.dumps(results, indent=2))
    except Exception as e:
        print(f"Error: {e}")
