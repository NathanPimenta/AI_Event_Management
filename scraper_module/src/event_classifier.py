"""Enhanced event classifier with domain extraction."""

import ollama
import json
import re
from typing import Dict, Any, List

class EnhancedEventClassifier:
    """Classifies events and extracts domain expertise."""
    
    def __init__(self, model_name: str = "llama3:8b"):
        self.model = model_name
    
    def classify_event(self, event_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhanced classification with domain extraction.
        """
        name = event_details.get('name', '')
        event_type = event_details.get('type', '').lower()
        description = event_details.get('description', '')
        location = event_details.get('location', '')
        
        prompt = f"""Analyze this event and extract:
1. Event type (hackathon, conference, competition, workshop, meetup, summit)
2. Required roles (speakers, judges, mentors, sponsors, exhibitors)
3. Domain/expertise area (e.g., AI, Web3, Cybersecurity, Cloud Computing)
4. Target audience
5. Technical stack/tools mentioned

Event Name: {name}
Event Type: {event_type}
Location: {location}
Description: {description}

Respond with ONLY JSON:
{{
    "event_type": "string",
    "primary_domain": "string",
    "secondary_domains": ["string"],
    "technical_stack": ["string"],
    "target_audience": ["string"],
    "roles_to_find": ["speakers", "judges", "mentors", "sponsors"],
    "estimated_size": "small|medium|large",
    "venue_requirements": ["string"],
    "budget_tier": "low|medium|high"
}}
"""
        
        try:
            response = ollama.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an event planning expert. Return only JSON."},
                    {"role": "user", "content": prompt}
                ],
                options={'temperature': 0.1}
            )
            
            content = response.get('message', {}).get('content', '').strip()
            
            # Extract JSON
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(0))
                
                # Add computed fields
                result['search_keywords'] = self._extract_search_keywords(
                    name, description, result.get('primary_domain', '')
                )
                
                return result
            
            return self._fallback_classification(name, event_type, description)
            
        except Exception as e:
            print(f"Classification error: {e}")
            return self._fallback_classification(name, event_type, description)
    
    def _extract_search_keywords(self, name: str, description: str, domain: str) -> List[str]:
        """Extract keywords for targeted searching."""
        keywords = []
        
        # Add domain
        if domain:
            keywords.append(domain)
        
        # Extract from name
        name_words = re.findall(r'[A-Z][a-z]+|[a-z]+', name)
        keywords.extend([w.lower() for w in name_words if len(w) > 3][:3])
        
        # Extract from description
        stopwords = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'}
        desc_words = re.findall(r'\b[a-zA-Z]{4,}\b', description.lower())
        keywords.extend([w for w in desc_words[:5] if w not in stopwords])
        
        return list(set(keywords))[:8]
    
    def _fallback_classification(self, name: str, event_type: str, description: str) -> Dict[str, Any]:
        """Fallback classification."""
        text = f"{name} {event_type} {description}".lower()
        
        classification = {
            "event_type": "other",
            "primary_domain": "technology",
            "secondary_domains": [],
            "technical_stack": [],
            "target_audience": ["developers", "students"],
            "roles_to_find": ["speakers", "sponsors"],
            "estimated_size": "medium",
            "venue_requirements": [],
            "budget_tier": "medium",
            "search_keywords": ["tech", "conference"]
        }
        
        # Determine event type
        if any(kw in text for kw in ['hackathon', 'hack', 'coding']):
            classification['event_type'] = 'hackathon'
            classification['roles_to_find'] = ['judges', 'mentors', 'sponsors', 'speakers']
        elif any(kw in text for kw in ['conference', 'conf', 'summit']):
            classification['event_type'] = 'conference'
            classification['roles_to_find'] = ['speakers', 'sponsors', 'exhibitors']
        elif any(kw in text for kw in ['workshop', 'training', 'bootcamp']):
            classification['event_type'] = 'workshop'
            classification['roles_to_find'] = ['instructors', 'speakers']
        
        # Extract domain
        domains = ['ai', 'machine learning', 'web3', 'blockchain', 'cybersecurity', 
                  'cloud', 'devops', 'iot', 'vr', 'ar', 'data science']
        for domain in domains:
            if domain in text:
                classification['primary_domain'] = domain
                break
        
        return classification