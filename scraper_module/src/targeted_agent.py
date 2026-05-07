"""Targeted agent that uses curated sources instead of random scraping."""

from typing import Dict, Any, List, Optional
import time
import json
import re
from .event_classifier import EnhancedEventClassifier
from .curated_sources import TargetedDiscoveryEngine
from .llm_extractor import LLMExtractor
from . import tools


class TargetedScraperAgent:
    """Targeted agent that uses curated sources and smart discovery."""
    
    def __init__(self):
        self.classifier = EnhancedEventClassifier()
        self.extractor = LLMExtractor()
    
    def run_targeted_scraper(self, event_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main targeted scraper workflow.
        """
        print(f"🎯 Targeted Scraper: {event_details.get('name')}")
        
        # Step 1: Enhanced classification with domain extraction
        print("🧠 Analyzing event...")
        classification = self.classifier.classify_event(event_details)
        
        print(f"✅ Event type: {classification.get('event_type')}")
        print(f"✅ Domain: {classification.get('primary_domain')}")
        print(f"✅ Roles needed: {classification.get('roles_to_find')}")
        
        # Step 2: Initialize targeted discovery engine
        discovery = TargetedDiscoveryEngine(
            event_type=classification.get('event_type', 'other'),
            domain=classification.get('primary_domain'),
            location=event_details.get('location')
        )
        
        # Step 3: Try to find event on curated platforms
        print("🔍 Searching curated platforms...")
        event_on_platform = discovery.find_event_on_curated_platforms(
            event_details.get('name')
        )
        
        results = {}
        metadata = {
            'event_name': event_details.get('name'),
            'classification': classification,
            'platform_found': event_on_platform.get('found', False),
            'platform_name': event_on_platform.get('platform'),
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'strategy': 'targeted_discovery'
        }
        
        # Step 4: For each role, use targeted discovery
        roles = classification.get('roles_to_find', [])
        
        for role in roles[:3]:  # Limit to 3 main roles
            print(f"🎯 Targeted discovery for {role}...")
            
            candidates = []
            
            # Strategy A: Check if event found on curated platform
            if event_on_platform.get('found'):
                print(f"   📍 Found on {event_on_platform.get('platform')}, extracting directly...")
                direct_candidates = self.extract_from_platform(
                    event_on_platform['platform'],
                    event_on_platform.get('data', {}),
                    role
                )
                candidates.extend(direct_candidates)
            
            # Strategy B: Find similar past events
            if len(candidates) < 5:  # If not enough from direct extraction
                print(f"   🔍 Looking for similar past events...")
                past_event_candidates = discovery.discover_role_candidates(role, limit=8)
                candidates.extend(past_event_candidates)
            
            # Strategy C: Use targeted search queries
            if len(candidates) < 5:
                print(f"   🔎 Using targeted search queries...")
                search_candidates = self.use_targeted_search(
                    event_details, classification, role, discovery
                )
                candidates.extend(search_candidates)
            
            # Deduplicate
            candidates = self.deduplicate_candidates(candidates)
            
            # Enrich with contact info if possible
            if candidates:
                candidates = self.enrich_candidates(candidates, role)
            
            results[role] = candidates
            print(f"   ✅ Found {len(candidates)} candidates for {role}")
        
        # Step 5: Generate recommendations
        recommendations = self.generate_recommendations(results, classification)
        
        return {
            'event_analysis': classification,
            'candidates': results,
            'recommendations': recommendations,
            'metadata': metadata
        }
    
    def extract_from_platform(self, platform: str, platform_data: Dict, role: str) -> List[Dict]:
        """Extract participants from specific platform."""
        candidates = []
        
        try:
            if platform == 'devpost' and role in ['judges', 'mentors', 'sponsors']:
                # Extract from Devpost hackathon data
                hackathon = platform_data
                
                if role == 'judges' and hackathon.get('judges'):
                    for judge in hackathon['judges']:
                        candidates.append({
                            'name': judge.get('name'),
                            'title': 'Judge',
                            'company': judge.get('affiliation'),
                            'source': 'devpost',
                            'profile_url': judge.get('url')
                        })
                
                elif role == 'sponsors' and hackathon.get('sponsors'):
                    for sponsor in hackathon['sponsors']:
                        candidates.append({
                            'name': sponsor.get('name'),
                            'title': 'Sponsor',
                            'company': sponsor.get('name'),
                            'source': 'devpost',
                            'website': sponsor.get('website')
                        })
        
        except Exception as e:
            print(f"⚠️ Error extracting from {platform}: {e}")
        
        return candidates
    
    def use_targeted_search(self, event_details: Dict, classification: Dict, 
                           role: str, discovery: TargetedDiscoveryEngine) -> List[Dict]:
        """Use targeted search queries."""
        candidates = []
        
        # Generate targeted queries
        queries = discovery.get_targeted_search_queries(role)
        
        for query in queries[:2]:  # Use top 2 queries
            try:
                print(f"   🔎 Query: {query}")
                search_results = tools.search_the_web.run(query)
                
                # Extract candidate names from search results
                extracted_names = self.extract_names_from_search(search_results, role)
                
                for name in extracted_names[:5]:  # Top 5 names per query
                    candidates.append({
                        'name': name,
                        'title': role.capitalize(),
                        'source': 'targeted_search',
                        'search_query': query,
                        'relevance_score': 0.6
                    })
                    
            except Exception as e:
                print(f"   ⚠️ Search failed: {e}")
                continue
        
        return candidates
    
    def extract_names_from_search(self, search_results: str, role: str) -> List[str]:
        """Extract potential names from search results."""
        names = []
        
        # Common patterns for names
        name_patterns = [
            r'(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',  # First Last
            r'[A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+',  # First M. Last
            r'(?:Dr\.|Mr\.|Ms\.|Mrs\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+'  # Titles
        ]
        
        for pattern in name_patterns:
            matches = re.findall(pattern, search_results)
            for match in matches:
                # Filter out common false positives
                if (len(match.split()) >= 2 and not any(keyword in match.lower() for keyword in 
                                                      ['event', 'conference', 'hackathon', 'workshop', 'competition', 'tutorial', 'day', 'search', 'contact', 'information', 'area', 'bay', 'services', 'cognitive', 'azure', 'google', 'gemini', 'lessons', 'judging', 'climate', 'tech', 'pitch', 'competition', 'global', 'achievement', 'awards', 'round', 'excited', 'cdz', 'expert', 'framer', 'the', 'exploring', 'stanford', 'san', 'francisco', 'chapter', 'webinar', 'keynote', 'speakers', 'artificial', 'intelligence', 'university', 'univesity', 'researchers', 'thought', 'leaders', 'famous'])):
                    names.append(match)
        
        return list(set(names))[:10]  # Return unique names, max 10
    
    def deduplicate_candidates(self, candidates: List[Dict]) -> List[Dict]:
        """Deduplicate candidates by name."""
        seen = set()
        unique = []
        
        for candidate in candidates:
            name = candidate.get('name', '').strip().lower()
            if name and name not in seen:
                seen.add(name)
                unique.append(candidate)
        
        return unique
    
    def enrich_candidates(self, candidates: List[Dict], role: str) -> List[Dict]:
        """Enrich candidates with additional info."""
        enriched = []
        
        for candidate in candidates[:10]:  # Enrich top 10
            try:
                name = candidate.get('name', '')
                
                # Try to find LinkedIn profile
                linkedin_query = f'site:linkedin.com/in/ "{name}"'
                search_result = tools.search_the_web.run(linkedin_query)
                
                # Extract LinkedIn URL
                linkedin_urls = re.findall(r'https://linkedin\.com/in/[^\s]+', search_result)
                if linkedin_urls:
                    candidate['linkedin_url'] = linkedin_urls[0]
                
                # Try to find email (simplified)
                if '@' in search_result:
                    emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', search_result)
                    if emails:
                        candidate['email'] = emails[0]
                
                enriched.append(candidate)
                
            except Exception as e:
                print(f"   ⚠️ Enrichment failed for {candidate.get('name')}: {e}")
                enriched.append(candidate)  # Add anyway
        
        return enriched
    
    def generate_recommendations(self, results: Dict[str, List], classification: Dict) -> Dict:
        """Generate recommendations based on results."""
        recommendations = {
            'high_priority': [],
            'outreach_strategy': {},
            'next_steps': []
        }
        
        # Identify high-priority candidates
        for role, candidates in results.items():
            if candidates:
                # Prioritize candidates with LinkedIn profiles
                high_priority = [c for c in candidates if c.get('linkedin_url')]
                if high_priority:
                    recommendations['high_priority'].extend(high_priority[:3])
        
        # Generate outreach strategy
        event_type = classification.get('event_type')
        if event_type == 'hackathon':
            recommendations['outreach_strategy'] = {
                'judges': 'Contact 4-6 weeks before event',
                'mentors': 'Start 2-3 weeks before, confirm 1 week before',
                'sponsors': 'Begin 8-12 weeks before, follow up monthly'
            }
        elif event_type == 'conference':
            recommendations['outreach_strategy'] = {
                'speakers': 'Contact 6-8 months before, CFP 4-6 months before',
                'sponsors': 'Start 9-12 months before, tiered approach'
            }
        
        # Next steps
        recommendations['next_steps'] = [
            'Review high-priority candidates',
            'Check LinkedIn profiles for relevance',
            'Prepare personalized outreach templates',
            'Schedule outreach in batches'
        ]
        
        return recommendations


# Integration with existing system
def run_targeted_agent(event_details: Dict[str, Any]) -> Dict[str, Any]:
    """Main function to run targeted agent."""
    agent = TargetedScraperAgent()
    return agent.run_targeted_scraper(event_details)