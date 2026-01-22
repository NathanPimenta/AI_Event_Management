
import os
import sys

# Add project root
sys.path.append('/home/nathanpimenta/Projects/Planify-AI_Event_Management_System')

from scraper_module.src.gemini_scraper import GeminiScraper
from scraper_module.src.email_agent import FileLogTransport, send_outreach_batch

def test_flow():
    print("--- Testing Gemini Scraper Flow ---")
    
    # Check env
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        print("❌ GEMINI_API_KEY not found. Please add it to scraper_module/.env or export it.")
        # Proceeding might fail, but let's try to init class to see if it catches it
    
    try:
        scraper = GeminiScraper()
        print("✅ Scraper initialized")
        
        event = {
            "name": "Test Event 2025",
            "type": "conference",
            "location": "Virtual",
            "description": "A test event for AI agents."
        }
        
        print("🔍 Finding candidates (mock call implies real API usage)...")
        # limit count to 2 to save tokens
        candidates = scraper.find_candidates(event, "speakers", count=2)
        print(f"✅ Found {len(candidates)} candidates")
        
        transport = FileLogTransport("test_sent_emails.log")
        sent = send_outreach_batch(candidates, "Test Event 2025", transport)
        print(f"✅ Sent {sent} emails")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_flow()
