"""LLM-based data extraction from HTML."""

import ollama
import json
import re
from typing import List, Dict, Any
from bs4 import BeautifulSoup


class LLMExtractor:
    """Extract structured data from HTML using LLM."""
    
    def __init__(self, model_name: str = "llama3:8b"):
        self.model = model_name
    
    def _clean_html(self, html: str, max_chars: int = 15000) -> str:
        """Clean and truncate HTML for LLM processing."""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove scripts, styles, and other non-content
            for tag in soup(['script', 'style', 'meta', 'link', 'noscript']):
                tag.decompose()
            
            # Get text content
            text = soup.get_text(separator='\n', strip=True)
            
            # Truncate if too long
            if len(text) > max_chars:
                text = text[:max_chars] + "..."
            
            return text
        except:
            # Fallback: just truncate raw HTML
            return html[:max_chars]
    
    def _get_extraction_prompt(self, category: str, base_url: str) -> str:
        """Get category-specific extraction prompt."""
        
        if category in ["speakers", "judges", "mentors"]:
            return f"""You are an expert data extractor. Extract information about {category} from the text.

Return a JSON array of objects. Each object must have these fields:
- "name": Person's full name (required)
- "title": Job title/role
- "company": Company/organization name
- "bio": Brief biography or description
- "email": Email address (look for mailto: links or email patterns)
- "linkedin_url": LinkedIn profile URL (must contain 'linkedin.com')
- "photo_url": Profile photo URL (convert relative to absolute using base: {base_url})
- "other_contact_url": Any other relevant profile/contact URL

Rules:
1. Extract ONLY real people with names
2. For photo_url: if relative (e.g., '/images/pic.jpg'), prepend base URL
3. Use null for missing fields
4. Return ONLY the JSON array, no other text

Example:
[
    {{
        "name": "John Doe",
        "title": "CEO",
        "company": "Tech Corp",
        "bio": "Experienced tech leader",
        "email": "john@techcorp.com",
        "linkedin_url": "https://linkedin.com/in/johndoe",
        "photo_url": "{base_url}/images/john.jpg",
        "other_contact_url": "https://johndoe.com"
    }}
]
"""
        
        elif category == "sponsors":
            return f"""You are an expert data extractor. Extract sponsor/partner companies from the text.

Return a JSON array of objects. Each object must have:
- "company_name": Company name (required)
- "logo_url": Company logo URL (convert relative to absolute using base: {base_url})
- "website_url": Company website URL
- "sponsorship_tier": Tier level (e.g., 'Platinum', 'Gold', 'Silver') or null

Rules:
1. Extract ONLY actual company names
2. For logo_url: if relative, prepend base URL
3. Use null for missing fields
4. Return ONLY the JSON array

Example:
[
    {{
        "company_name": "TechCorp",
        "logo_url": "{base_url}/logos/techcorp.png",
        "website_url": "https://techcorp.com",
        "sponsorship_tier": "Gold"
    }}
]
"""
        
        return ""
    
    def extract_data(self, html: str, category: str, base_url: str) -> List[Dict[str, Any]]:
        """
        Extract structured data from HTML.
        
        Args:
            html: HTML content
            category: Type of data to extract (speakers, judges, mentors, sponsors)
            base_url: Base URL for resolving relative links
        
        Returns:
            List of extracted data objects
        """
        # Clean HTML
        cleaned = self._clean_html(html)
        
        if not cleaned or len(cleaned) < 50:
            print(f"      ⚠️ Insufficient content after cleaning")
            return []
        
        # Get prompt
        system_prompt = self._get_extraction_prompt(category, base_url)
        if not system_prompt:
            print(f"      ⚠️ No prompt for category: {category}")
            return []
        
        try:
            # Call LLM
            response = ollama.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract {category} from this content:\n\n{cleaned}"}
                ],
                options={'temperature': 0.0}  # Deterministic extraction
            )
            
            content = response.get('message', {}).get('content', '').strip()
            print(f"      📝 LLM response length: {len(content)} chars")
            print(f"      📝 LLM response preview: {content[:200]}...")
            
            # Extract JSON array
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if not json_match:
                print(f"      ⚠️ LLM didn't return JSON array")
                return []
            
            json_str = json_match.group(0)
            data = json.loads(json_str)
            
            if not isinstance(data, list):
                print(f"      ⚠️ LLM returned non-list data")
                return []
            
            # Filter out empty/invalid entries
            valid_data = []
            for item in data:
                if isinstance(item, dict):
                    # Check if has required field
                    if category in ["speakers", "judges", "mentors"]:
                        if item.get("name"):
                            valid_data.append(item)
                    elif category == "sponsors":
                        if item.get("company_name"):
                            valid_data.append(item)
            
            if valid_data:
                print(f"      ✅ Extracted {len(valid_data)} valid {category}")
            
            return valid_data
            
        except json.JSONDecodeError as e:
            print(f"      ⚠️ JSON parse error: {e}")
            return []
        except Exception as e:
            print(f"      ⚠️ Extraction error: {e}")
            return []