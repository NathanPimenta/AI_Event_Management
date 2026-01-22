"""Agentic scraper implementation."""

from typing import Any, Dict, List, Optional
import json
import time
import re
from .event_classifier import EnhancedEventClassifier
from .enhanced_search import build_diverse_search_queries, extract_urls_enhanced, check_page_relevance
from .llm_extractor import LLMExtractor
from . import tools


def run_agentic_scraper(event_details: Dict[str, Any], initial_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Run the agentic scraper: classify event, determine roles, search web, extract data.
    
    Args:
        event_details: Dict with event info (name, type, description, etc.)
        initial_url: Optional direct URL to event website
    
    Returns:
        Dict with classification, results, metadata
    """
    print(f"🤖 Agentic Scraper: {event_details.get('name', 'Unknown Event')}")
    
    # Step 1: Classify event and determine roles
    print("   🧠 Classifying event...")
    classifier = EnhancedEventClassifier()
    classification = classifier.classify_event(event_details)
    print(f"   ✅ Event type: {classification.get('event_type')}")
    print(f"   ✅ Roles to find: {classification.get('roles_to_find')}")
    
    roles = classification.get('roles_to_find', [])
    if not roles:
        print("   ⚠️ No roles determined")
        roles = ['speakers']  # fallback
    
    results = {}
    roles_found = []
    
    # Step 2: For each role, search and extract
    for role in roles:
        print(f"   🔎 Searching for {role}...")
        
        # Build search queries
        queries = build_diverse_search_queries(event_details, role)
        print(f"   🔎 Queries for {role}: {queries}")
        
        all_candidates = []
        visited_urls = set()
        
        # Try each query
        for query in queries[:3]:  # Limit to 3 queries per role
            try:
                print(f"   🔎 Searching: '{query}'")
                search_results = tools.search_the_web.run(query)
                
                # Extract URLs from search results
                urls = extract_urls_enhanced(search_results, min_confidence=0.4)
                print(f"   🌐 Found {len(urls)} promising URLs")
                
                # Visit top URLs
                for url_info in urls[:5]:  # Top 5 URLs per query
                    url = url_info['url']
                    if url in visited_urls:
                        continue
                    visited_urls.add(url)
                    
                    try:
                        print(f"   🌐 Visiting URL for {role}: {url}")
                        try:
                            page_content = tools.navigate_to_url.run(url)
                            # Get access to the driver via tools helper to check HTML content for relevance
                            driver = tools.get_driver()
                            if driver:
                                html = driver.page_source
                            else:
                                # If no driver, we might have just got text summary, skip strict HTML check or fetch again
                                # For simplicity, let's assume we can get it if navigate_to_url worked with driver
                                # If navigate_to_url used requests, we need another way? 
                                # Actually tools.navigate_to_url returns a string summary.
                                # But we can use fetch_page_html to get the raw HTML if needed, 
                                # OR we can rely on shared driver state.
                                html, _ = tools.fetch_page_html(url)
                                
                            # Check Relevance
                            is_relevant, reason = check_page_relevance(html, event_details)
                            if not is_relevant:
                                print(f"   🚫 Page rejected: {reason}")
                                continue
                            print(f"   ✅ Page passed relevance check")
                                
                        except Exception as e:
                            print(f"   ⚠️ Navigation/Relevance check failed: {e}")
                            continue
                        
                        # Extract data
                        print(f"   📄 Page loaded, extracting {role}...")
                        extracted_json = tools.extract_structured_data.run(role)
                        
                        if extracted_json and extracted_json.strip():
                            try:
                                candidates = json.loads(extracted_json)
                                if isinstance(candidates, list) and candidates:
                                    all_candidates.extend(candidates)
                                    print(f"   ✅ Extracted {len(candidates)} {role} candidates")
                            except json.JSONDecodeError:
                                print(f"   ⚠️ Invalid JSON from extraction")
                        else:
                            print(f"   ⚠️ No {role} data extracted")
                            
                    except Exception as e:
                        print(f"   ⚠️ Failed to process URL {url}: {e}")
                        continue
                        
            except Exception as e:
                print(f"   ⚠️ Search failed for query '{query}': {e}")
                continue
        
        # Deduplicate candidates (by name)
        seen_names = set()
        unique_candidates = []
        for candidate in all_candidates:
            name = candidate.get('name', '').strip().lower()
            if name and name not in seen_names:
                seen_names.add(name)
                unique_candidates.append(candidate)
        
        results[role] = unique_candidates
        if unique_candidates:
            roles_found.append(role)
        
        print(f"   📊 {role}: {len(unique_candidates)} unique candidates found")
    
    # Cleanup
    tools.close_driver()
    
    # Prepare metadata
    metadata = {
        'event_url': initial_url,
        'event_name': event_details.get('name'),
        'extraction_timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'roles_searched': roles,
        'roles_found': roles_found
    }
    
    return {
        'event_classification': classification,
        'results': results,
        'metadata': metadata
    }


# Legacy functions for backward compatibility

def _extract_first_url(text: str) -> Optional[str]:
    """Extract first URL from text."""
    import re
    m = re.search(r"https?://[\w./?&=%-]+", text)
    return m.group(0) if m else None


def _call_tool(tool_obj, *args, **kwargs):
    """Invoke a tool."""
    if callable(tool_obj):
        return tool_obj(*args, **kwargs)
    if hasattr(tool_obj, "run"):
        return tool_obj.run(*args, **kwargs)
    if hasattr(tool_obj, "arun"):
        import asyncio
        return asyncio.run(tool_obj.arun(*args, **kwargs))
    raise TypeError(f"Tool {tool_obj!r} not callable")


def run_scraper_agent(goal: str, initial_url: Optional[str] = None) -> Any:
    """
    Legacy agent runner - simple goal-based scraping.
    
    Args:
        goal: Scraping goal (e.g., "find speakers for PyCon 2025")
        initial_url: Optional direct URL
    
    Returns:
        Extracted data (JSON or text)
    """
    print(f"🤖 Legacy Agent: {goal}")
    
    url = initial_url
    
    # If no URL, search for one
    if not url:
        try:
            print("   🔎 Searching for URL...")
            search_out = _call_tool(tools.search_the_web, goal)
            url = _extract_first_url(search_out)
        except Exception as e:
            print(f"   ⚠️ Search failed: {e}")
    
    if not url:
        raise RuntimeError("Could not find URL. Provide a direct URL or ensure search is working.")
    
    # Navigate to URL
    try:
        print(f"   🌐 Navigating to: {url}")
        nav_result = _call_tool(tools.navigate_to_url, url)
        print(f"   ✅ Page loaded")
    except Exception as e:
        raise RuntimeError(f"Navigation failed: {e}")
    
    # Try to extract data (default to speakers)
    try:
        print("   📊 Extracting data...")
        extracted = _call_tool(tools.extract_structured_data, "speakers")
        
        # Parse if JSON
        try:
            return json.loads(extracted)
        except:
            return extracted
            
    except Exception as e:
        raise RuntimeError(f"Extraction failed: {e}")
    finally:
        tools.close_driver()