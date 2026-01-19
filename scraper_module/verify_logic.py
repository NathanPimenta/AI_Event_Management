
import sys
# Add project root to path
sys.path.append('/home/nathanpimenta/Projects/Planify-AI_Event_Management_System')

from scraper_module.src.enhanced_search import build_diverse_search_queries, check_page_relevance

def test_search_queries():
    print("\n--- Testing Search Query Generation ---")
    event_details = {
        "name": "PyCon US 2024",
        "type": "conference",
        "description": "Python conference",
        "location": "Pittsburgh",
        "date": "2024-05-15"
    }
    
    queries = build_diverse_search_queries(event_details, "speakers")
    print(f"Generated {len(queries)} queries:")
    for q in queries:
        print(f"  - {q}")
        
    # Validation
    expected_strict = '"PyCon US 2024" speakers'
    if expected_strict in queries:
        print("✅ PASS: Found strict exact-match query")
    else:
        print("❌ FAIL: strict query missing")

def test_relevance_check():
    print("\n--- Testing Page Relevance Logic ---")
    
    event_details = {"name": "PyCon US 2024"}
    
    # Case 1: Relevant HTML
    good_html = """
    <html>
        <title>PyCon US 2024 | Pittsburgh</title>
        <body>
            <h1>Welcome to PyCon US 2024</h1>
            <p>The dates are May 15-23, 2024 in Pittsburgh.</p>
        </body>
    </html>
    """
    is_valid, msg = check_page_relevance(good_html, event_details)
    print(f"Case 1 (Relevant Page): {is_valid} ('{msg}')")
    if is_valid:
        print("✅ PASS: Correctly accepted relevant page")
    else:
        print("❌ FAIL: Incorrectly rejected relevant page")

    # Case 2: Wrong Year
    bad_year_html = """
    <html>
        <title>PyCon US 2023 | Salt Lake City</title>
        <body>
            <h1>Welcome to PyCon US 2023</h1>
            <p>Thanks for coming last year!</p>
        </body>
    </html>
    """
    is_valid, msg = check_page_relevance(bad_year_html, event_details)
    print(f"Case 2 (Wrong Year): {is_valid} ('{msg}')")
    if not is_valid:
        print("✅ PASS: Correctly rejected wrong year")
    else:
        print("❌ FAIL: Incorrectly accepted wrong year")

    # Case 3: Completely Irrelevant
    random_html = """
    <html>
        <title>Best Python Tutorials</title>
        <body>
            <h1>Learn Python Today</h1>
            <p>Python is a great language.</p>
        </body>
    </html>
    """
    is_valid, msg = check_page_relevance(random_html, event_details)
    print(f"Case 3 (Irrelevant Content): {is_valid} ('{msg}')")
    if not is_valid:
        print("✅ PASS: Correctly rejected irrelevant content")
    else:
        print("❌ FAIL: Incorrectly accepted irrelevant content")

if __name__ == "__main__":
    test_search_queries()
    test_relevance_check()
