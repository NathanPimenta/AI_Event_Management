
import os
import sys

# Add project root
sys.path.append('/home/nathanpimenta/Projects/Planify-AI_Event_Management_System')

from scraper_module.src.reasoning_agent import ReasoningAgent

def test_reasoning_flow():
    print("--- Testing Ollama Reasoning Flow ---")
    
    agent = ReasoningAgent() # uses defaults
    event = {"name": "PyCon India 2025", "date": "2025-10-15"}
    
    # 1. Test Query Generation
    print("1. Testing Query Generation...")
    queries = agent.generate_search_queries(event, "speakers")
    print(f"   Generated: {queries}")
    if not queries or len(queries) == 0:
        print("   ❌ Failed to generate queries")
    else:
        print("   ✅ Queries generated")

    # 2. Test Extraction (Mock HTML)
    print("\n2. Testing Extraction...")
    mock_html = """
    <html>
    <body>
    <h1>Speakers 2025</h1>
    <div class="speaker">
        <h2>Aditi Sharma</h2>
        <p>Senior AI Engineer at Google</p>
        <p>Bio: Aditi is an expert in LLMs.</p>
    </div>
    <div class="speaker">
        <h2>Rahul Verma</h2>
        <p>CTO at TechCorp</p>
    </div>
    </body>
    </html>
    """
    candidates = agent.extract_from_html(mock_html, "speakers", "http://test.com")
    print(f"   Extracted: {candidates}")
    
    if len(candidates) >= 1:
        print("   ✅ Extraction successful")
    else:
        print("   ❌ Extraction failed (Ollama model might be struggling or missing)")

if __name__ == "__main__":
    test_reasoning_flow()
