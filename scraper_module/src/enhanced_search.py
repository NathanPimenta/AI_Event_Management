"""Enhanced search and extraction strategies for better candidate discovery."""

import re
from typing import List, Dict, Any
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup


def is_valid_url(url: str) -> bool:
    """Validate that a URL is properly formed and has a valid domain."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # Must have a domain
        if not domain:
            return False
        
        # Remove port if present
        domain = domain.split(':')[0]
        
        # Domain must have at least one dot (e.g., example.com)
        if '.' not in domain:
            return False
        
        # Domain parts must be valid
        parts = domain.split('.')
        if len(parts) < 2:
            return False
        
        # Last part (TLD) must be at least 2 characters
        tld = parts[-1]
        if len(tld) < 2:
            return False
        
        # Known valid TLDs (including short ones)
        valid_short_tlds = ['io', 'co', 'ai', 'tv', 'me', 'us', 'uk', 'in', 'de', 'fr', 'it', 'es']
        
        # If TLD is 2 chars, must be in valid list or numeric (like .com)
        if len(tld) == 2:
            if tld not in valid_short_tlds and not tld.isdigit():
                # Allow country codes (two letters)
                if not tld.isalpha():
                    return False
        
        # Domain must not contain spaces or invalid chars
        if ' ' in domain or len(domain) < 4:
            return False
        
        # Each part must start with alphanumeric
        for part in parts:
            if not part or not part[0].isalnum():
                return False
        
        return True
    except Exception:
        return False


def extract_urls_enhanced(text: str, min_confidence: float = 0.3) -> List[Dict[str, Any]]:
    """
    Enhanced URL extraction with confidence scoring.
    Returns list of dicts with 'url', 'confidence', 'domain'.
    Handles various formats from search engines.
    """
    # Multiple URL patterns to catch different formats
    patterns = [
        # Standard URLs with protocol
        r'https?://(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:[/\?#][^\s<>"{}|\\^`\[\]()]*)?',
        # URLs in markdown links
        r'\[([^\]]+)\]\((https?://[^\)]+)\)',
        # URLs with explicit tags
        r'(?:URL:|Link:|href=|src=)["\s]*(https?://[^\s"<>]+)',
    ]
    
    urls_found = {}  # Use dict to track URL -> confidence
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            # Handle tuple results from groups
            url = match[1] if isinstance(match, tuple) and len(match) > 1 else match
            if isinstance(url, tuple):
                url = url[0]
            
            # Clean up trailing punctuation and invalid chars
            url = re.sub(r'[.,;:!?)\]]+$', '', url)
            # Remove trailing slashes if path is empty
            if url.endswith('/') and url.count('/') == 3:  # Only remove if it's just domain/
                url = url.rstrip('/')
            
            # Validate URL
            if is_valid_url(url):
                if url not in urls_found:
                    urls_found[url] = 0.5  # Base confidence
    
    # Also try to extract from common search result formats
    # Look for patterns like "Title\nURL\nDescription"
    lines = text.split('\n')
    for i, line in enumerate(lines):
        line = line.strip()
        if line.startswith(('http://', 'https://')):
            # Clean the line
            line = re.sub(r'[.,;:!?)\]]+$', '', line)
            if is_valid_url(line):
                if line not in urls_found:
                    urls_found[line] = 0.6  # Slightly higher for line-separated URLs
    
    scored_urls = []
    for url, base_confidence in urls_found.items():
        try:
            parsed = urlparse(url)
            confidence = base_confidence
            
            # Boost confidence for certain domains
            domain = parsed.netloc.lower()
            
            # High-value domains
            if 'linkedin.com' in domain:
                confidence += 0.3
            elif any(keyword in domain for keyword in ['github.com', 'twitter.com', 'x.com']):
                confidence += 0.2
            
            # Event-related domains
            if any(keyword in domain for keyword in ['speaker', 'judge', 'mentor', 'sponsor', 'event', 'conference', 'summit']):
                confidence += 0.2
            
            # Professional domains
            if any(keyword in domain for keyword in ['profile', 'bio', 'about', 'team']):
                confidence += 0.15
            
            # Penalize certain domains
            if any(keyword in domain for keyword in ['facebook.com', 'instagram.com', 'youtube.com', 'tiktok.com']):
                confidence -= 0.3
            
            # Check path for relevant keywords
            path = parsed.path.lower()
            path_keywords = ['speaker', 'judge', 'mentor', 'sponsor', 'team', 'about', 'people', 'staff', 'bio']
            if any(keyword in path for keyword in path_keywords):
                confidence += 0.15
            
            # Penalize very long or suspicious URLs
            if len(url) > 200 or url.count('/') > 10:
                confidence -= 0.1
            
            scored_urls.append({
                'url': url,
                'confidence': min(max(confidence, 0.0), 1.0),  # Clamp between 0 and 1
                'domain': domain
            })
        except Exception as e:
            print(f"   ⚠️ Failed to score URL {url}: {e}")
            continue
    
    # Sort by confidence (highest first)
    scored_urls.sort(key=lambda x: x['confidence'], reverse=True)
    
    # Filter by minimum confidence
    filtered_urls = [u for u in scored_urls if u['confidence'] >= min_confidence]
    
    return filtered_urls


def build_diverse_search_queries(event_details: Dict[str, Any], role: str) -> List[str]:
    """
    Build diverse search queries targeting different sources:
    - LinkedIn profiles
    - Past event pages
    - Industry directories
    - Company websites
    - Personal websites
    """
    name = event_details.get("name", "")
    event_type = event_details.get("type", "").lower()
    location = event_details.get("location", "")
    description = event_details.get("description", "")
    date = event_details.get("date", "")
    
    # Extract year if present
    year = ""
    if date:
        year_match = re.search(r'20\d{2}', date)
        if year_match:
            year = year_match.group(0)
    else:
        # Try to find year in name
        year_match = re.search(r'20\d{2}', name)
        if year_match:
            year = year_match.group(0)
    
    # Extract domain keywords from description
    domain_keywords = []
    if description:
        words = description.lower().split()
        # More comprehensive skip words
        skip_words = {
            'the', 'event', 'is', 'where', 'students', 'form', 'groups', 'among',
            'themselves', 'and', 'learn', 'how', 'to', 'develop', 'using', 'like',
            'etc', 'will', 'can', 'this', 'that', 'with', 'from', 'for', 'are',
            'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
            'did', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of',
            'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
            'through', 'during', 'before', 'after', 'above', 'below', 'to'
        }
        domain_keywords = [w for w in words if w not in skip_words and len(w) > 3][:5]
        domain_str = " ".join(domain_keywords[:3])
    else:
        domain_str = ""
    
    loc_str = f" {location}" if location else ""
    queries = []
    
    # Helper to quote string
    def quote(s):
        return f'"{s}"' if s and ' ' in s else s
    
    quoted_name = quote(name)
    
    # Strategy 1: High-precision Event Specific Searches (Most Important)
    if name:
        # Exact event name + role
        queries.append(f'{quoted_name} {role}')
        
        # Event name + year + role (if year known)
        if year and year not in name:
            queries.append(f'{quoted_name} {year} {role}')
            
        # Event name + "people" or "team" (often leads to relevant pages)
        queries.append(f'{quoted_name} {role} list')
    
    # Strategy 2: LinkedIn specific (High value)
    if role in ["speakers", "judges", "mentors", "sponsors"]:
        if name:
            queries.append(f'site:linkedin.com {quoted_name} {role}')
            if year:
                 queries.append(f'site:linkedin.com {quoted_name} {year} {role}')

    # Strategy 3: Broad "Topic" searches (Only if name searches fail)
    # We deprioritize these to avoid "generic and random" results
    # Only include if we have a very specific domain and location
    if domain_str and location and not name:
        queries.append(f"{domain_str} {event_type} {role} {location}")


    # Clean and deduplicate
    uniq = []
    for q in queries:
        q = " ".join(q.split())  # Normalize whitespace
        if q and len(q) > 5 and q not in uniq:
            uniq.append(q)
    
    return uniq[:6]  # Return top 6 queries


def check_page_relevance(html: str, event_details: Dict[str, Any]) -> tuple[bool, str]:
    """
    Check if a page is relevant to the event.
    Returns (is_relevant, reason).
    """
    if not html:
        return False, "Empty HTML"
        
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text().lower()[:10000] # Check first 10k chars
    title = soup.title.string.lower() if soup.title else ""
    
    name = event_details.get("name", "").lower()
    if not name:
        return True, "No event name to check against" # Allow if no name provided
        
    # 1. Check for Event Name presence
    # simplistic token matching
    name_tokens = set(name.split())
    # remove common words
    name_tokens.discard('the')
    name_tokens.discard('event')
    name_tokens.discard('conference')
    name_tokens.discard('2024') 
    name_tokens.discard('2025')
    
    tokens_found = 0
    for token in name_tokens:
        if token in text or token in title:
            tokens_found += 1
            
    # If we find less than 60% of unique significant keywords, it's likely trash
    if name_tokens and (tokens_found / len(name_tokens)) < 0.6:
         return False, f"Event name '{name}' not significantly found in content"

    # 2. Check for Year Mismatch (if year is specified in name or details)
    # This is critical to avoid scraping last year's site
    year_match = re.search(r'20\d{2}', name)
    target_year = year_match.group(0) if year_match else event_details.get("date", "")[:4]
    
    if target_year and re.match(r'20\d{2}', target_year):
        # Scan title for WRONG years
        other_years = [str(y) for y in range(2020, 2030) if str(y) != target_year]
        
        # If title strongly mentions another year and NOT our year, it's suspicious
        # e.g. Title: "PyCon 2023" but we want 2024
        if any(y in title for y in other_years) and target_year not in title:
             return False, f"Page title indicates wrong year (not {target_year})"

    return True, "Relevance check passed"



def find_people_listings_in_html(html: str, role: str) -> List[str]:
    """
    Find potential people listing pages by analyzing HTML structure.
    Looks for common patterns like speaker lists, judge panels, etc.
    """
    try:
        soup = BeautifulSoup(html, 'html.parser')
    except Exception as e:
        print(f"   ⚠️ BeautifulSoup parsing failed: {e}")
        return []
    
    potential_urls = []
    
    # Keywords that suggest people listings
    role_keywords = {
        'speakers': ['speaker', 'talk', 'session', 'presenter', 'keynote'],
        'judges': ['judge', 'jury', 'evaluator', 'panel', 'judging'],
        'mentors': ['mentor', 'advisor', 'coach', 'guidance'],
        'sponsors': ['sponsor', 'partner', 'supporter', 'backing']
    }
    
    keywords = role_keywords.get(role, [role.lower()])
    
    # Look for links with role-related text
    for link in soup.find_all('a', href=True):
        try:
            link_text = link.get_text(strip=True).lower()
            href = link.get('href', '')
            
            # Check if link text contains relevant keywords
            if any(kw in link_text for kw in keywords):
                # Only add if it's a valid URL format
                if href.startswith(('http://', 'https://')):
                    potential_urls.append(href)
                elif href.startswith('/'):
                    # Relative URL - will be resolved by caller
                    potential_urls.append(href)
        except Exception:
            continue
    
    # Look for sections with role-related class names or IDs
    for elem in soup.find_all(['div', 'section'], class_=re.compile('|'.join(keywords), re.I)):
        for link in elem.find_all('a', href=True):
            try:
                href = link.get('href', '')
                if href.startswith(('http://', 'https://')):
                    potential_urls.append(href)
                elif href.startswith('/'):
                    potential_urls.append(href)
            except Exception:
                continue
    
    # Also check for href attributes that contain keywords
    for link in soup.find_all('a', href=re.compile('|'.join(keywords), re.I)):
        try:
            href = link.get('href', '')
            if href.startswith(('http://', 'https://')):
                potential_urls.append(href)
            elif href.startswith('/'):
                potential_urls.append(href)
        except Exception:
            continue
    
    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in potential_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    
    return unique_urls[:15]  # Return up to 15 URLs