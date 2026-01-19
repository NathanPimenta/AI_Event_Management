
import ollama
import json
import re
from typing import List, Dict, Any

class ReasoningAgent:
    """
    Uses a local LLM (Ollama) to reason about events, plan search queries,
    and extract structured data from raw HTML.
    """
    
    def __init__(self, model: str = "llama3:8b"):
        self.model = model
        # Check if model is available/pullable? 
        # For now assume user has it or we default to a standard one if missing?
        # We'll just trust the configured model.

    def generate_search_queries(self, event_details: Dict[str, Any], role: str) -> List[str]:
        """
        Generates targeted search queries to find real web pages for this role.
        Prioritizes location and domain context over just the event name.
        """
        name = event_details.get("name", "")
        description = event_details.get("description", "")
        location = event_details.get("location", "")
        year = event_details.get("date", "")[:4] if event_details.get("date") else ""
        
        prompt = f"""
        You are an expert talent scout. I need to find potential {role} for an event called "{name}".
        
        Event Context:
        - Description: "{description}"
        - Location: "{location}"
        - Year: "{year}"
        
        GOAL: Generate 5 diverse search queries to find people with relevant profiles.
        
        STRATEGY:
        1. If it's a famous event, look for the official "{name} {year} {role}" list.
        2. CRITICAL: Look for experts in the EVENT'S DOMAIN/TOPIC in the specific LOCATION.
           (e.g., if description mentions "AI", look for "AI experts in {location}").
        3. Look for similar past events or meetups in {location}.
        4. Focus on "top", "best", "directory", "speakers list" keywords.
        
        Format: Return ONLY a JSON array of strings.
        Example: ["{name} {year} {role}", "Top {role} in {location} for [Domain]", "{location} [Domain] community leaders"]
        """
        
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                options={'temperature': 0.4}
            )
            content = response['message']['content']
            parsed = self._clean_and_parse_json(content)
            if isinstance(parsed, list):
                return parsed[:5]
            return [f"{name} {role}", f"{role} in {location}"] # Fallback
        except Exception as e:
            print(f"   ⚠️ Reasoner Error (Queries): {e}")
            return [f"{name} {role}", f"{location} {role}"]

    def extract_from_html(self, html: str, role: str, url: str) -> List[Dict[str, Any]]:
        """
        Extracts candidates from HTML content using the LLM.
        """
        # Truncate HTML to avoid context window issues
        # Remove scripts, styles to save tokens
        clean_text = self._simplify_html(html)
        
        prompt = f"""
        Extract a list of {role} from the following text (scraped from {url}).
        
        Return a JSON ARRAY of objects with:
        - name
        - title (role/job)
        - company
        - bio (brief)
        - email (if found, else "Not Available")
        
        If no relevant people are found, return [].
        Only include REAL people explicitly listed as {role}.
        
        Text Content:
        {clean_text[:12000]} 
        """
        
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                options={'temperature': 0.1}
            )
            content = response['message']['content']
            parsed = self._clean_and_parse_json(content)
            if isinstance(parsed, list):
                return parsed
            return []
        except Exception as e:
            print(f"   ⚠️ Reasoner Error (Extraction): {e}")
            return []

    def _clean_and_parse_json(self, text: str) -> Any:
        """Helper to parse JSON from LLM output."""
        try:
            # Find JSON block
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            # Try finding object if array failed
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return None
        except:
            return None

    def _simplify_html(self, html: str) -> str:
        """Crude HTML simplifier."""
        # This could be better with BS4 but we want to depend on reasoning_agent logic
        text = re.sub(r'<script.*?>.*?</script>', '', html, flags=re.DOTALL)
        text = re.sub(r'<style.*?>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text
