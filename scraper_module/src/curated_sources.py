"""Curated sources and targeted discovery for event roles."""

from typing import Dict, List, Any, Optional
import requests
from bs4 import BeautifulSoup
import re
import json
from datetime import datetime

# ========== CURATED SOURCE DATABASE ==========

CURATED_EVENT_PLATFORMS = {
    'hackathon': [
        {
            'name': 'Devpost',
            'url': 'https://devpost.com',
            'api_pattern': 'https://devpost.com/api/hackathons',
            'type': 'hackathon',
            'reliability': 0.9
        },
        {
            'name': 'MLH',
            'url': 'https://mlh.io',
            'search_url': 'https://mlh.io/seasons/2025/events',
            'type': 'hackathon',
            'reliability': 0.95
        },
        {
            'name': 'Hackathon.com',
            'url': 'https://hackathon.com',
            'search_pattern': 'https://www.hackathon.com/city/',
            'type': 'hackathon',
            'reliability': 0.85
        }
    ],
    'conference': [
        {
            'name': 'ConferenceAlert',
            'url': 'https://conferencealert.com',
            'search_url': 'https://conferencealert.com/search.php',
            'type': 'conference',
            'reliability': 0.8
        },
        {
            'name': 'Eventbrite Conferences',
            'url': 'https://www.eventbrite.com/d/conferences/',
            'type': 'conference',
            'reliability': 0.9
        },
        {
            'name': 'AllConferences',
            'url': 'https://www.allconferences.com',
            'type': 'conference',
            'reliability': 0.75
        }
    ],
    'workshop': [
        {
            'name': 'Meetup Workshops',
            'url': 'https://meetup.com',
            'api_url': 'https://api.meetup.com',
            'type': 'workshop',
            'reliability': 0.85
        },
        {
            'name': 'Eventbrite Workshops',
            'url': 'https://www.eventbrite.com/d/workshops/',
            'type': 'workshop',
            'reliability': 0.9
        }
    ]
}

CURATED_ROLE_DISCOVERY_SOURCES = {
    'speakers': [
        # Professional networks
        {
            'type': 'linkedin',
            'method': 'api_search',
            'query_template': 'title:("CTO" OR "Principal Engineer" OR "Director of Engineering" OR "Head of") AND industry:("Technology" OR "{domain}") AND location:("{location}")',
            'priority': 0.9
        },
        # Past event speakers
        {
            'type': 'past_events',
            'method': 'similar_event_analysis',
            'priority': 0.95
        },
        # Tech communities
        {
            'type': 'github',
            'method': 'top_contributors',
            'query_template': 'language:{tech_stack} sort:followers',
            'priority': 0.7
        },
        {
            'type': 'twitter',
            'method': 'industry_influencers',
            'query_template': '{domain} speakers OR conference speaker',
            'priority': 0.6
        }
    ],
    'judges': [
        # Venture Capital
        {
            'type': 'vc_partners',
            'method': 'crunchbase_search',
            'query_template': 'VC partners {domain} judging experience',
            'priority': 0.8
        },
        # Tech executives
        {
            'type': 'tech_executives',
            'method': 'linkedin_search',
            'query_template': '(title:"CTO" OR "VP Engineering" OR "Technical Director") AND past_judge:true',
            'priority': 0.75
        },
        # Past hackathon judges
        {
            'type': 'past_judges',
            'method': 'event_search',
            'query_template': 'hackathon judges 2024 {domain}',
            'priority': 0.9
        }
    ],
    'mentors': [
        # Tech company employees
        {
            'type': 'tech_companies',
            'method': 'company_employees',
            'companies': ['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix'],
            'priority': 0.7
        },
        # Startup mentors
        {
            'type': 'startup_mentors',
            'method': 'angellist_ycombinator',
            'priority': 0.8
        },
        # Open source maintainers
        {
            'type': 'opensource',
            'method': 'github_maintainers',
            'priority': 0.65
        }
    ],
    'sponsors': [
        # Companies with developer relations
        {
            'type': 'devrel_companies',
            'method': 'known_sponsors',
            'companies': ['Stripe', 'Twilio', 'AWS', 'Google Cloud', 'Microsoft Azure'],
            'priority': 0.9
        },
        # Companies in specific domain
        {
            'type': 'domain_companies',
            'method': 'crunchbase_domain',
            'priority': 0.8
        },
        # Local businesses
        {
            'type': 'local_businesses',
            'method': 'local_chamber',
            'priority': 0.6
        }
    ]
}

# ========== KNOWLEDGE BASE OF KNOWN SPEAKERS/JUDGES ==========

KNOWN_PROFESSIONALS_DB = {
    # This could be populated from previous successful extractions
    'tech_speakers': [
        {
            'name': 'John Doe',
            'linkedin': 'https://linkedin.com/in/johndoe',
            'expertise': ['AI', 'Machine Learning'],
            'past_events': ['PyCon 2024', 'AI Summit 2023'],
            'contact_quality': 'high'
        },
        # Add more as you discover them
    ],
    'hackathon_judges': [
        {
            'name': 'Jane Smith',
            'linkedin': 'https://linkedin.com/in/janesmith',
            'company': 'Tech Ventures VC',
            'past_judging': ['HackMIT 2024', 'Stanford Hackathon 2023'],
            'contact_quality': 'high'
        },
    ]
}

# ========== TARGETED DISCOVERY ENGINE ==========

class TargetedDiscoveryEngine:
    """Targeted discovery engine that uses curated sources instead of random search."""
    
    def __init__(self, event_type: str, domain: str = None, location: str = None):
        self.event_type = event_type
        self.domain = domain
        self.location = location
        self.extracted_keywords = []
        
    def extract_domain_keywords(self, description: str) -> List[str]:
        """Extract domain-specific keywords from event description."""
        from nltk.corpus import stopwords
        import nltk
        
        try:
            # Try to download stopwords if not present
            nltk.download('stopwords', quiet=True)
            stop_words = set(stopwords.words('english'))
        except:
            stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'a', 'an', 'the', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'being', 'been', 'be'}
        
        # Extract meaningful keywords
        words = re.findall(r'\b[a-zA-Z]{4,}\b', description.lower())
        keywords = [w for w in words if w not in stop_words]
        
        # Technical keywords to prioritize
        tech_keywords = ['python', 'javascript', 'react', 'ai', 'ml', 'blockchain', 'cloud', 'devops', 'cybersecurity', 'iot', 'vr', 'ar']
        tech_found = [kw for kw in tech_keywords if kw in keywords]
        
        return list(set(keywords[:10] + tech_found))
    
    def find_event_on_curated_platforms(self, event_name: str) -> Dict[str, Any]:
        """Find event on curated platforms first."""
        platforms = CURATED_EVENT_PLATFORMS.get(self.event_type, [])
        
        for platform in platforms:
            try:
                print(f"🔍 Searching on {platform['name']}...")
                
                if platform['name'] == 'Devpost':
                    # Try Devpost API
                    response = requests.get(
                        f"https://devpost.com/api/hackathons?search={event_name}",
                        headers={'User-Agent': 'Mozilla/5.0'}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('hackathons'):
                            return {
                                'platform': 'devpost',
                                'data': data['hackathons'][0],
                                'reliability': platform['reliability']
                            }
                
                elif platform['name'] == 'MLH':
                    # Scrape MLH events page
                    response = requests.get(platform['search_url'], headers={'User-Agent': 'Mozilla/5.0'})
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Look for event by name
                    for event_card in soup.find_all(class_=re.compile(r'event.*card', re.I)):
                        if event_name.lower() in event_card.text.lower():
                            return {
                                'platform': 'mlh',
                                'found': True,
                                'reliability': platform['reliability']
                            }
                
            except Exception as e:
                print(f"⚠️ Error searching {platform['name']}: {e}")
                continue
        
        return {'found': False}
    
    def find_similar_past_events(self, event_name: str, domain: str = None) -> List[Dict[str, Any]]:
        """Find similar past events to extract their participants."""
        # Build search queries for past events
        queries = []
        
        if domain:
            queries.append(f'{domain} conference 2024 speakers')
            queries.append(f'{domain} hackathon 2023 judges')
            queries.append(f'{domain} summit 2024 sponsors')
        
        queries.append(f'{event_name} 2024')
        queries.append(f'"{event_name}" past event')
        
        similar_events = []
        
        # Search for past events
        for query in queries[:3]:  # Limit to 3 queries
            try:
                # Use your existing search tool
                from .tools import search_the_web
                results = search_the_web.run(query)
                
                # Extract event URLs from results
                urls = re.findall(r'https?://[^\s<>"\'{}|\\^`\[\]()]*', results)
                event_urls = [url for url in urls if any(keyword in url.lower() for keyword in 
                                                        ['event', 'conference', 'hackathon', 'summit', 'workshop'])]
                
                for url in event_urls[:2]:  # Check first 2 URLs
                    try:
                        # Try to extract participants from past event
                        event_data = self.extract_participants_from_past_event(url)
                        if event_data:
                            similar_events.append(event_data)
                    except:
                        continue
                        
            except Exception as e:
                print(f"⚠️ Error searching similar events: {e}")
                continue
        
        return similar_events
    
    def extract_participants_from_past_event(self, url: str) -> Optional[Dict[str, Any]]:
        """Extract participants from a past event page."""
        try:
            response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for common sections
            participants = {
                'url': url,
                'speakers': [],
                'judges': [],
                'sponsors': [],
                'mentors': []
            }
            
            # Try to find speaker sections
            speaker_sections = soup.find_all(['section', 'div'], 
                                            class_=re.compile(r'speaker|presenter|keynote', re.I))
            
            for section in speaker_sections:
                # Extract names
                names = section.find_all(['h3', 'h4', 'span'], class_=re.compile(r'name|title', re.I))
                for name_elem in names:
                    name = name_elem.get_text(strip=True)
                    if name and len(name.split()) >= 2:  # Likely a person name
                        participants['speakers'].append({
                            'name': name,
                            'source_url': url,
                            'extracted_from': 'past_event'
                        })
            
            # Look for judges
            judge_sections = soup.find_all(text=re.compile(r'judges?|jury', re.I))
            for section in judge_sections:
                parent = section.find_parent(['div', 'section'])
                if parent:
                    names = parent.find_all(['h3', 'h4', 'li'])
                    for name_elem in names:
                        name = name_elem.get_text(strip=True)
                        if name and len(name.split()) >= 2:
                            participants['judges'].append({
                                'name': name,
                                'source_url': url,
                                'extracted_from': 'past_event'
                            })
            
            return participants if any(participants.values()) else None
            
        except Exception as e:
            print(f"⚠️ Error extracting from past event: {e}")
            return None
    
    def discover_role_candidates(self, role: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Discover candidates for a specific role using targeted methods."""
        strategies = CURATED_ROLE_DISCOVERY_SOURCES.get(role, [])
        candidates = []
        
        for strategy in strategies[:3]:  # Top 3 strategies per role
            try:
                if strategy['type'] == 'linkedin' and self.domain:
                    # LinkedIn API search (simplified - in reality would use Sales Navigator API)
                    linkedin_candidates = self.search_linkedin_profiles(
                        role=role,
                        domain=self.domain,
                        location=self.location
                    )
                    candidates.extend(linkedin_candidates)
                    
                elif strategy['type'] == 'past_events':
                    # Find similar past events
                    past_events = self.find_similar_past_events(
                        f"{self.domain} {role}" if self.domain else role,
                        self.domain
                    )
                    
                    for event in past_events:
                        if event.get(role):
                            candidates.extend(event[role])
                
                elif strategy['type'] == 'github' and self.extracted_keywords:
                    # GitHub search for top contributors
                    github_candidates = self.search_github_contributors(
                        tech_stack=self.extracted_keywords[0] if self.extracted_keywords else 'python'
                    )
                    candidates.extend(github_candidates)
                
            except Exception as e:
                print(f"⚠️ Strategy {strategy['type']} failed: {e}")
                continue
        
        # Deduplicate and limit
        seen_names = set()
        unique_candidates = []
        
        for candidate in candidates:
            name = candidate.get('name', '').strip().lower()
            if name and name not in seen_names and len(unique_candidates) < limit:
                seen_names.add(name)
                unique_candidates.append(candidate)
        
        return unique_candidates
    
    def search_linkedin_profiles(self, role: str, domain: str, location: str = None) -> List[Dict[str, Any]]:
        """Search LinkedIn for profiles matching role and domain."""
        from . import tools
        
        # Perform real web searches instead of simulated data
        candidates = []
        
        # Generate better search queries for real people
        search_queries = [
            f'{domain} researchers {location or ""}',
            f'{domain} conference speakers 2024',
            f'famous {domain} experts',
            f'{domain} thought leaders {location or ""}',
            f'{domain} professors university'
        ]
        
        for query in search_queries[:2]:  # Limit to 2 queries
            try:
                search_results = tools.search_the_web.run(query)
                
                # Extract potential names from search results
                names = self.extract_names_from_search(search_results)
                
                for name in names[:3]:  # Top 3 names per query
                    if name and len(name.split()) >= 2:  # Must have first and last name
                        candidate = {
                            'name': name,
                            'title': f'{domain.capitalize()} {role.capitalize()}',
                            'company': f'{domain.capitalize()} Company',  # Placeholder
                            'source': 'web_search',
                            'relevance_score': 0.7,
                            'search_query': query
                        }
                        candidates.append(candidate)
                        
            except Exception as e:
                print(f"⚠️ LinkedIn search failed for '{query}': {e}")
                continue
        
        # Remove duplicates
        seen_names = set()
        unique_candidates = []
        for c in candidates:
            name = c['name'].lower().strip()
            if name not in seen_names:
                seen_names.add(name)
                unique_candidates.append(c)
        
        return unique_candidates[:5]  # Return top 5
    
    def extract_names_from_search(self, search_results: str) -> List[str]:
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
                if (len(match.split()) >= 2 and 
                    not any(keyword.lower() in match.lower() for keyword in 
                           ['event', 'conference', 'hackathon', 'workshop', 'competition', 
                            'tutorial', 'day', 'search', 'contact', 'information', 'area', 
                            'bay', 'services', 'cognitive', 'azure', 'google', 'gemini',
                            'lessons', 'judging', 'climate', 'tech', 'pitch', 'competition',
                            'global', 'achievement', 'awards', 'round', 'excited', 'cdz',
                            'expert', 'framer', 'the', 'exploring', 'stanford', 'san', 'francisco',
                            'chapter', 'webinar', 'keynote', 'speakers', 'artificial', 'intelligence',
                            'university', 'univesity', 'researchers', 'thought', 'leaders', 'famous'])):
                    names.append(match)
        
        return list(set(names))[:10]  # Return unique names, max 10
    
    def search_github_contributors(self, tech_stack: str) -> List[Dict[str, Any]]:
        """Search GitHub for top contributors in a technology."""
        # In production, use GitHub API
        try:
            import requests
            
            # GitHub API search for users
            response = requests.get(
                f"https://api.github.com/search/users?q=language:{tech_stack}&sort=followers&per_page=5",
                headers={'Accept': 'application/vnd.github.v3+json'}
            )
            
            if response.status_code == 200:
                users = response.json().get('items', [])
                
                candidates = []
                for user in users:
                    candidates.append({
                        'name': user.get('login', ''),
                        'title': f'GitHub Contributor ({tech_stack})',
                        'company': 'Open Source',
                        'github_url': user.get('html_url', ''),
                        'source': 'github_api',
                        'relevance_score': 0.7
                    })
                
                return candidates
        except Exception as e:
            print(f"⚠️ GitHub API error: {e}")
        
        return []
    
    def get_targeted_search_queries(self, role: str) -> List[str]:
        """Generate targeted search queries for a role."""
        queries = []
        
        # High-value query patterns
        if role == 'speakers':
            domain_str = self.domain if self.domain else "tech"
            queries.append(f'{domain_str} conference speakers 2024')
            queries.append(f'famous {domain_str} researchers')
            queries.append(f'{domain_str} thought leaders')
            if self.location:
                queries.append(f'{domain_str} speakers "{self.location}"')
            if self.extracted_keywords:
                for keyword in self.extracted_keywords[:2]:
                    queries.append(f'{keyword} expert speaker')
        
        elif role == 'judges':
            domain_str = self.domain if self.domain else "tech"
            queries.append(f'{domain_str} hackathon judges names')
            queries.append(f'famous judges {domain_str} competitions')
            queries.append(f'VC judges {domain_str} startups')
            if self.location:
                queries.append(f'{domain_str} judges "{self.location}"')
        
        elif role == 'sponsors':
            if self.domain:
                queries.append(f'{self.domain} companies sponsor events')
                queries.append(f'tech sponsors {self.domain} conference')
            if self.location:
                queries.append(f'local sponsors {self.location} tech events')
        
        # Clean and filter empty queries
        return [q.strip() for q in queries if q and len(q.strip()) > 10]