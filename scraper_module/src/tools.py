from langchain_core.tools import tool 
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
from .llm_extractor import LLMExtractor
import json
from urllib.parse import urljoin
import requests


# --- Global WebDriver instance to maintain session across tool uses ---
_driver = None

def get_driver():
    """Initializes and returns a singleton WebDriver instance. Returns None if Chrome is not available."""
    global _driver
    if _driver is None:
        try:
            print("🚀 Initializing browser...")
            chrome_options = Options()
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            
            # Try to find Chrome/Chromium binary
            import shutil
            chrome_paths = ['chromium', 'chromium-browser', 'google-chrome', 'chrome']
            chrome_binary = None
            for path in chrome_paths:
                if shutil.which(path):
                    chrome_binary = shutil.which(path)
                    chrome_options.binary_location = chrome_binary
                    print(f"   ✅ Found Chrome/Chromium at: {chrome_binary}")
                    break
            
            # Try to use manually installed ChromeDriver first
            chromedriver_path = None
            try:
                import os
                manual_path = os.path.expanduser("~/.wdm/drivers/chromedriver/linux64/143.0.7499.192/chromedriver-linux64/chromedriver")
                if os.path.exists(manual_path):
                    chromedriver_path = manual_path
                    print(f"   ✅ Using manually installed ChromeDriver: {chromedriver_path}")
                else:
                    # Fallback to ChromeDriverManager
                    chromedriver_path = ChromeDriverManager().install()
            except Exception:
                chromedriver_path = ChromeDriverManager().install()
            
            service = Service(chromedriver_path)
            _driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Set page load timeout
            _driver.set_page_load_timeout(30)
            
            print("   ✅ ChromeDriver initialized successfully")
        except Exception as e:
            print(f"⚠️ Could not initialize Chrome WebDriver: {e}")
            print("   Will use requests fallback for page fetching")
            _driver = None
    return _driver

def close_driver():
    """Function to close the browser session."""
    global _driver
    if _driver:
        try:
            print("🚪 Closing browser...")
            _driver.quit()
        except Exception as e:
            print(f"⚠️ Error closing driver: {e}")
        finally:
            _driver = None

# --- TOOL DEFINITIONS ---

@tool
def search_the_web(query: str) -> str:
    """
    Performs a web search using DuckDuckGo and returns the top results.
    Use this to find the initial URL of an event when you don't know it.
    Example query: 'PyCon 2025 official website'
    """
    print(f"   - 🔎 Searching the web for: '{query}'")
    
    # Strategy 1: Try ddgs library (better for URL extraction)
    try:
        from ddgs import DDGS
        
        with DDGS() as ddgs:
            search_results = list(ddgs.text(query, max_results=10))
            
            if search_results:
                # Format results with clear URL separation
                formatted = []
                urls_found = []
                
                for idx, result in enumerate(search_results, 1):
                    title = result.get('title', '')
                    url = result.get('href', '')
                    body = result.get('body', '')
                    
                    if url:
                        urls_found.append(url)
                        formatted.append(f"{idx}. {title}\n   URL: {url}\n   {body[:200]}")
                
                result_text = "\n\n".join(formatted)
                
                # Append clean URL list for easier extraction
                if urls_found:
                    result_text += "\n\n--- EXTRACTED URLS ---\n" + "\n".join(urls_found)
                
                print(f"   ✅ Found {len(search_results)} results with {len(urls_found)} URLs")
                return result_text
                
    except ImportError:
        print(f"   ⚠️ ddgs library not available, trying alternative...")
    except Exception as e:
        print(f"   ⚠️ DuckDuckGo search failed: {e}")
    
    # Strategy 2: Try DuckDuckGoSearchRun from langchain
    try:
        from langchain_community.tools import DuckDuckGoSearchRun
        search = DuckDuckGoSearchRun()
        results = search.run(query)
        
        if results and len(results.strip()) > 10:
            print(f"   ✅ Search completed via DuckDuckGoSearchRun")
            return results
    except Exception as e:
        print(f"   ⚠️ DuckDuckGoSearchRun also failed: {e}")
    
    # If all searches fail
    error_msg = f"⚠️ All search methods failed for query: '{query}'\n"
    error_msg += "Please ensure duckduckgo-search is installed: pip install duckduckgo-search"
    return error_msg


def fetch_page_html(url: str) -> tuple[str, str]:
    """
    Fetches HTML content from a URL. Returns (html_content, base_url).
    Tries Chrome first, falls back to requests.
    """
    print(f"   📥 Fetching page: {url}")
    
    # Strategy 1: Try Selenium/Chrome for JS-rendered pages
    driver = get_driver()
    if driver:
        try:
            driver.get(url)
            # Wait for page to load
            time.sleep(3)
            
            # Get the final URL after redirects
            final_url = driver.current_url
            html = driver.page_source
            
            print(f"   ✅ Fetched via Chrome: {len(html)} chars")
            return html, final_url
            
        except Exception as e:
            print(f"   ⚠️ Chrome fetch failed ({e}), falling back to requests")
    
    # Strategy 2: Fallback to requests for static pages
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        }
        
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()
        
        # Get final URL after redirects
        final_url = response.url
        html = response.text
        
        print(f"   ✅ Fetched via requests: {len(html)} chars")
        return html, final_url
        
    except requests.exceptions.Timeout:
        print(f"   ⚠️ Timeout fetching {url}")
        return "", url
    except requests.exceptions.HTTPError as e:
        print(f"   ⚠️ HTTP error {e.response.status_code}: {url}")
        return "", url
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️ Request failed: {e}")
        return "", url
    except Exception as e:
        print(f"   ⚠️ Unexpected error fetching page: {e}")
        return "", url


@tool
def navigate_to_url(url: str) -> str:
    """
    Navigates the browser to a specific URL and returns a summary of the page content,
    including the title and all visible links, to help decide the next action.

    Falls back to a requests-based fetch when a WebDriver/browser isn't available.
    """
    print(f"   - 🌐 Navigating to URL: {url}")
    html_content, base_url = fetch_page_html(url)
    
    if not html_content:
        return f"Failed to fetch {url}"
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
    except Exception as e:
        print(f"   ⚠️ BeautifulSoup parsing failed: {e}")
        return f"Failed to parse HTML from {url}"

    # Create a clean, text-only representation of links for the agent
    links_text = []
    for a in soup.find_all('a', href=True):
        try:
            href = a['href']
            # Resolve relative URLs to absolute ones
            absolute_url = urljoin(base_url, href)
            link_text = a.get_text(strip=True)
            
            if link_text and len(link_text) > 0:
                # Truncate very long link texts
                if len(link_text) > 100:
                    link_text = link_text[:97] + "..."
                links_text.append(f"Link: '{link_text}' → {absolute_url}")
        except Exception:
            continue

    title = soup.title.string if soup.title else "No title found"
    
    # Limit the number of links returned to avoid overwhelming output
    links_sample = links_text[:30]  # First 30 links
    links_summary = "\n".join(links_sample)
    
    if len(links_text) > 30:
        links_summary += f"\n... and {len(links_text) - 30} more links"
    
    return f"Fetched {url}\nPage Title: '{title}'\n\nAvailable links on the page:\n{links_summary}"


@tool
def extract_structured_data(category: str) -> str:
    """
    Extracts structured information from the CURRENTLY LOADED WEBPAGE.
    This should be the final step after you have successfully navigated to the correct page.
    Valid categories are: 'speakers', 'sponsors', 'judges', 'mentors'.
    """
    print(f"   - 📊 Preparing to extract '{category}' from current page...")
    
    driver = get_driver()
    if not driver:
        return "Error: WebDriver not initialized. Cannot extract data without a loaded page."
    
    try:
        extractor = LLMExtractor()
        base_url = driver.current_url
        html = driver.page_source
        
        if not html or len(html) < 100:
            return f"Error: Current page has insufficient content ({len(html) if html else 0} chars)"
        
        # Use the existing LLM Extractor logic on the current page source
        data = extractor.extract_data(html, category, base_url)
        
        if not data or len(data) == 0:
            return f"Could not extract any data for category '{category}'. The page might not contain this information or the HTML structure is incompatible."
        
        # Return data as a JSON string so the agent can see the final result
        print(f"   ✅ Successfully extracted {len(data)} items for '{category}'")
        return json.dumps(data, indent=2)
        
    except Exception as e:
        print(f"   ⚠️ Extraction failed: {e}")
        return f"Error during extraction: {str(e)}"