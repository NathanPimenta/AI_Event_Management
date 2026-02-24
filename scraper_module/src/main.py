from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import os
import time
from .agentic_agent import run_agentic_scraper
from .document_builder import build_multi_category_review_markdown, build_review_markdown
from .targeted_agent import run_targeted_agent
from .reporting import generate_targeted_report

app = FastAPI(title="AI Scraper Agent API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model for structured event details
class EventDetails(BaseModel):
    name: str
    type: Optional[str] = None  # e.g., "hackathon", "conference", "competition"
    description: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None  # Optional direct URL to event website

# Legacy model for backward compatibility
class AgentRequest(BaseModel):
    goal: str
    url: Optional[str] = None
    category: Optional[str] = "speakers"
    event_label: Optional[str] = None

@app.post("/scrape/")
async def run_agentic_scraper_endpoint(event_details: EventDetails):
    """
    Ollama-driven Agentic Scraper (Reasoning + Search).
    
    1. Agent plans search queries (Ollama).
    2. System searches the web (DuckDuckGo).
    3. System visits pages.
    4. Agent extracts candidates (Ollama).
    5. Sends emails (Logged).
    """
    print(f"📥 Received event details: {event_details.name}")
    
    try:
        from .reasoning_agent import ReasoningAgent
        from .email_agent import FileLogTransport, send_outreach_batch
        from .tools import search_the_web, navigate_to_url, get_driver
        from .enhanced_search import extract_urls_enhanced
        
        # Initialize
        agent = ReasoningAgent() # uses Ollama
        email_transport = FileLogTransport()
        
        # Default roles targeted
        roles = ["speakers", "judges", "mentors", "sponsors"]
        
        results = {}
        total_emails_sent = 0
        event_dict = event_details.dict()
        event_name = event_dict.get("name")
        
        for role in roles:
            print(f"   🤖 Agent: Planning search for {role}...")
            
            # 1. PLAN: Generate Queries
            queries = agent.generate_search_queries(event_dict, role)
            print(f"   📋 Queries: {queries}")
            
            role_candidates = []
            visited_urls = set()
            
            # 2. ACT: Execute Search
            for query in queries[:3]: # Limit queries
                try:
                    print(f"   🔎 Searching: {query}")
                    search_res = search_the_web.run(query)
                    urls = extract_urls_enhanced(search_res, min_confidence=0.3)
                    
                    # 3. OBSERVE: Visit Pages
                    for u in urls[:3]: # Limit URLs per query
                        url = u['url']
                        if url in visited_urls: continue
                        visited_urls.add(url)
                        
                        try:
                            print(f"   🌐 Visiting: {url}")
                            # We use navigate_to_url just to load the page in the driver/fetch it
                            # But navigate_to_url returns a summary. We want raw HTML for the extractor.
                            summary = navigate_to_url.run(url) 
                            
                            # Get raw HTML
                            driver = get_driver()
                            if driver:
                                html = driver.page_source
                            else:
                                # Fallback if no driver allowed/working (shouldn't happen with updated tools.py)
                                html = summary 
                            
                            # 4. EXTRACT: Agent logic
                            extracted = agent.extract_from_html(html, role, url)
                            if extracted:
                                print(f"   ✨ Found {len(extracted)} candidates on {url}")
                                role_candidates.extend(extracted)
                                
                        except Exception as e:
                            print(f"   ⚠️ Failed to visit/extract {url}: {e}")
                            
                except Exception as e:
                    print(f"   ⚠️ Search error: {e}")
            
            # Deduplicate
            unique_candidates = []
            seen_names = set()
            for c in role_candidates:
                name = c.get('name', '').strip().lower()
                if name and name not in seen_names:
                    seen_names.add(name)
                    unique_candidates.append(c)
            
            results[role] = unique_candidates
            
            # 5. OUTREACH: Send Emails
            if unique_candidates:
                sent = send_outreach_batch(unique_candidates, event_name, email_transport)
                total_emails_sent += sent
                
        # Save results
        output_dir = "scraper_module/output"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        json_output_path = os.path.join(output_dir, f"reasoning_results_{timestamp}.json")
        
        with open(json_output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
            
        print(f"✅ Scraper completed. Emails sent: {total_emails_sent}")
        
        return {
            "success": True,
            "message": f"Completed. Found {sum(len(v) for v in results.values())} candidates. Sent {total_emails_sent} emails.",
            "data": results,
            "emails_sent": total_emails_sent,
            "json_path": json_output_path
        }

    except Exception as e:
        print(f"❌ An error occurred in the scraper endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@app.post("/scrape/legacy")
async def run_legacy_agent_endpoint(request: AgentRequest):
    """
    Legacy endpoint for backward compatibility.
    Uses the old goal-based approach.
    """
    from .agent import run_scraper_agent
    
    print(f"Received legacy agent request with goal: {request.goal}")
    
    try:
        scraped_data = run_scraper_agent(request.goal, initial_url=request.url)

        if not scraped_data:
            raise HTTPException(status_code=404, detail="The agent could not find or extract the requested information.")

        output_dir = "scraper_module/output"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        json_output_path = os.path.join(output_dir, f"legacy_results_{timestamp}.json")

        with open(json_output_path, 'w', encoding='utf-8') as f:
            if isinstance(scraped_data, (list, dict)):
                json.dump(scraped_data, f, indent=2)
            else:
                f.write(scraped_data)

        review_doc_path = None
        as_list = scraped_data
        if isinstance(scraped_data, dict):
            if len(scraped_data) == 1 and isinstance(next(iter(scraped_data.values())), list):
                as_list = next(iter(scraped_data.values()))

        if isinstance(as_list, list):
            try:
                review_doc_path = build_review_markdown(
                    as_list,
                    category=request.category or "speakers",
                    event_label=request.event_label or request.goal,
                )
            except Exception as e:
                print(f"⚠️ Failed to generate review document: {e}")

        return {
            "success": True,
            "message": "Legacy agent completed successfully.",
            "data": scraped_data,
            "json_path": json_output_path,
            "review_document_path": review_doc_path,
        }

    except Exception as e:
        print(f"❌ An error occurred in the legacy endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@app.post("/scrape/targeted")
async def run_targeted_scraper_endpoint(event_details: EventDetails):
    """
    Targeted scraper endpoint - uses curated sources and smart discovery.
    
    Returns high-quality, relevant candidates instead of random search results.
    """
    print(f"🎯 Targeted scraper for: {event_details.name}")
    
    try:
        event_dict = event_details.dict()
        
        # Run targeted agent
        result = run_targeted_agent(event_dict)
        
        if not result:
            raise HTTPException(status_code=404, detail="Targeted agent could not find relevant candidates.")
        
        # Save results
        output_dir = "scraper_module/output"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        
        # Save detailed results
        json_path = os.path.join(output_dir, f"targeted_results_{timestamp}.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        
        # Generate summary report
        report_path = os.path.join(output_dir, f"targeted_report_{timestamp}.md")
        generate_targeted_report(result, report_path)
        
        return {
            "success": True,
            "message": "Targeted scraper completed successfully.",
            "event_analysis": result.get('event_analysis'),
            "candidates": result.get('candidates'),
            "recommendations": result.get('recommendations'),
            "high_priority_count": len(result.get('recommendations', {}).get('high_priority', [])),
            "report_path": report_path,
            "json_path": json_path
        }
        
    except Exception as e:
        print(f"❌ Targeted scraper error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # To run, use: python -m scraper_module.src.main
    uvicorn.run("scraper_module.src.main:app", host="0.0.0.0", port=8001, reload=True)