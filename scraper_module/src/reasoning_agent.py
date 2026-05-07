
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
        HEAVILY prioritizes location and domain context over everything else.
        Role-specific filtering for judges/speakers/mentors to avoid irrelevant results.
        """
        name = event_details.get("name", "")
        description = event_details.get("description", "")
        location = event_details.get("location", "")
        year = event_details.get("date", "")[:4] if event_details.get("date") else ""
        
        # Extract domain keywords from description
        domain_keywords = ""
        keywords = ["AI", "ML", "data science", "tech", "blockchain", "web3", "finance", "cloud", "DevOps", "sustainability", "fintech", "environment", "disaster"]
        for kw in keywords:
            if kw.lower() in description.lower():
                domain_keywords = kw
                break
        
        # Role-specific prefixes to get right type of people
        role_context = ""
        if role.lower() == "speakers":
            role_context = "tech speakers/conferences"
        elif role.lower() == "mentors":
            role_context = "startup/tech mentors (can also serve as judges/evaluators)"
        elif role.lower() == "sponsors":
            role_context = "companies/ organizations for sponsorships"
        
        prompt = f"""
        You are an expert talent scout. I need to find potential {role} for an event called "{name}".
        
        Event Context:
        - Description: "{description}"
        - Location: "{location}" (CRITICAL: ONLY search for people/resources IN THIS LOCATION)
        - Year: "{year}"
        - Domain: "{domain_keywords}" (if mentioned)
        - Role Context: {role_context}
        
        GOAL: Generate 5 highly specific search queries to find {role_context} who are BASED IN OR ASSOCIATED WITH "{location}".
        
        **CRITICAL INSTRUCTIONS:**
        1. EVERY query MUST include "{location}" or "{location}-based" to ensure location filtering.
        2. For "{role}" role: FOCUS on EVENT judges, COMPETITION judges, STARTUP judges - NOT court/legal judges
        3. PRIORITY: Location-specific queries > Event-specific queries
        4. Generate queries like:
           - "{location} {domain_keywords or 'tech'} {role}" (domain+location)
           - "{location} {domain_keywords or 'startup'} community {role}"
           - "{location} hackathon/competition {role}" (for judges specifically)
           - "{location} {domain_keywords} industry leaders"
           - "{location}-based {role} for events/conferences" (if applicable)
        5. DO NOT add generic "{role}" without domain context
        6. DO NOT generate court judges, legal judges, or government officials
        7. For each query, venue_location takes absolute priority
        
        Format: Return ONLY a JSON array of strings.
        DO NOT include any explanations, just the array.
        Example: ["{location} {domain_keywords} {role}", "{location} competition judges", "{location} {domain_keywords} leaders"]
        """
        
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                options={'temperature': 0.3}  # Lower temp for more consistent location filtering
            )
            content = response['message']['content']
            parsed = self._clean_and_parse_json(content)
            if isinstance(parsed, list):
                # Verify all queries include location
                verified = [q for q in parsed if location.lower() in q.lower()]
                if not verified:
                    # If LLM didn't include location, add it manually
                    verified = [f"{location} {q}" for q in parsed[:3]]
                return verified[:5]
            return [f"{location} {role}", f"{location}-based {role}", f"top {role} in {location}"] # Fallback
        except Exception as e:
            print(f"   ⚠️ Reasoner Error (Queries): {e}")
            return [f"{location} {role}", f"{location} based {role}"]

    def extract_from_html(self, html: str, role: str, url: str, location: str = "") -> List[Dict[str, Any]]:
        """
        Extracts candidates from HTML content using the LLM.
        Filters to only include people from the specified location and role-appropriate candidates.
        """
        # Truncate HTML to avoid context window issues
        # Remove scripts, styles to save tokens
        clean_text = self._simplify_html(html)
        
        location_instruction = f"LOCATION FILTER: Only include people who are BASED IN or ASSOCIATED WITH '{location}'. Do NOT include people from other countries/regions." if location else ""
        
        # Role-specific filtering
        role_filter = ""
        if role.lower() == "speakers":
            role_filter = "SPEAKER TYPE FILTER: EXCLUDE government officials, legal professionals. ONLY include tech speakers, researchers, entrepreneurs, innovators."
        elif role.lower() == "mentors":
            role_filter = "MENTOR TYPE FILTER: Include startup/tech mentors, advisors, and experts who can mentor or judge. EXCLUDE general consultants without tech experience."
        
        prompt = f"""
        Extract a list of {role} from the following text (scraped from {url}).
        
        Return a JSON ARRAY of objects with:
        - name
        - title (role/job)
        - company
        - bio (brief)
        - email (if found, else "Not Available")
        - location (if found)
        
        Rules:
        1. Only include REAL people explicitly listed as {role}.
        2. {location_instruction}
        3. {role_filter}
        4. If person's title contains "court", "legal", "magistrate", "justice", "government official" - EXCLUDE them (if judges role).
        5. If person's location is not from the specified location, EXCLUDE them.
        6. If no relevant people are found, return [].
        
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
