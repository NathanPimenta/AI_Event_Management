# Agentic Scraper Module

An intelligent, autonomous scraper agent that classifies events, determines what roles to find, and extracts contact information for speakers, judges, mentors, and sponsors.

## Features

- **Event Classification**: Automatically classifies events (hackathon, conference, competition, etc.)
- **Intelligent Role Detection**: Determines what roles to find based on event type
- **Autonomous Talent Search**: Searches the broader web for suitable speakers, judges, mentors, sponsors based on event details (no event website required)
- **Multi-Category Extraction**: Extracts speakers, judges, mentors, sponsors in one pass
- **Contact Information**: Extracts emails, LinkedIn profiles, and other contact URLs
- **Review Documents**: Generates human-readable Markdown documents for cross-verification

## Setup

### 1. Install Dependencies

```bash
cd /home/nathanpimenta/Projects/Planify-AI_Event_Management_System
pip install -r scraper_module/requirements.txt
```

Or install individually:
```bash
pip install selenium webdriver-manager beautifulsoup4 langchain langchain-core langchain-community langchain-ollama duckduckgo-search ollama fastapi uvicorn[standard] ddgs
```

### 2. Install Browser (Chromium/Chrome)

**Fedora:**
```bash
sudo dnf install -y chromium
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y chromium-browser
```

**macOS:**
```bash
brew install chromium
```

### 3. Setup Ollama

1. Install Ollama from https://ollama.com/download
2. Start Ollama service:
```bash
ollama serve
```

3. Pull the required model:
```bash
ollama pull llama3:8b
```

## Running the API

From the project root:

```bash
cd /home/nathanpimenta/Projects/Planify-AI_Event_Management_System
uvicorn scraper_module.src.main:app --host 0.0.0.0 --port 8002 --reload
```

The API will be available at `http://localhost:8002`

API docs: `http://localhost:8002/docs`

## Usage

### Agentic Scraper (Recommended)

Send structured event details. The agent will:
1. Classify the event type
2. Determine what roles to find (e.g., speakers, judges, mentors, sponsors)
3. For each role, search the web for suitable people using the event context
4. Visit promising pages and extract all relevant people

**Example Request:**
```bash
curl -X POST "http://localhost:8002/scrape/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PyCon India 2025",
    "type": "conference",
    "description": "Annual Python conference in India",
    "date": "2025-10-15",
    "location": "Bangalore, India"
  }'
```

**With Direct URL (skips search):**
```bash
curl -X POST "http://localhost:8002/scrape/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hackathon 2025",
    "type": "hackathon",
    "url": "https://example.com/hackathon"
  }'
```

**Response Structure:**
```json
{
  "success": true,
  "message": "Agentic scraper completed successfully.",
  "event_classification": {
    "event_type": "conference",
    "roles_to_find": ["speakers", "sponsors"],
    "reasoning": "Conferences typically feature speakers..."
  },
  "data": {
    "speakers": [
      {
        "name": "John Doe",
        "title": "Senior Engineer",
        "company": "Tech Corp",
        "email": "john@example.com",
        "linkedin_url": "https://linkedin.com/in/johndoe",
        "bio": "...",
        "photo_url": "..."
      }
    ],
    "sponsors": [...]
  },
  "metadata": {
    "event_url": "https://...",
    "extraction_timestamp": "2025-01-15 10:30:00",
    "roles_searched": ["speakers", "sponsors"],
    "roles_found": ["speakers", "sponsors"]
  },
  "json_path": "/path/to/output/agentic_results_20250115-103000.json",
  "review_document_path": "/path/to/output/pycon-india-2025_review_20250115-103000.md"
}
```

### Legacy Endpoint (Backward Compatibility)

For simple goal-based scraping:

```bash
curl -X POST "http://localhost:8002/scrape/legacy" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Find all speakers for PyCon India 2025",
    "category": "speakers"
  }'
```

## Event Types and Roles

The agent automatically determines roles based on event type:

| Event Type | Typical Roles Found |
|------------|---------------------|
| Hackathon | judges, mentors, sponsors |
| Conference | speakers, sponsors |
| Competition | judges, sponsors |
| Workshop | speakers, instructors, sponsors |
| Meetup | speakers, sponsors |
| Summit | speakers, sponsors |
| Expo | exhibitors, sponsors |
| Festival | performers, sponsors |

## Output Files

All outputs are saved in `scraper_module/output/`:

- **JSON files**: Raw structured data (`agentic_results_TIMESTAMP.json`)
- **Markdown files**: Human-readable review documents (`EVENT_NAME_review_TIMESTAMP.md`)

## How It Works

1. **Event Classification**: Uses LLM to classify event type from provided details
2. **Role Determination**: Maps event type to appropriate roles (speakers, judges, mentors, sponsors, etc.)
3. **Web Search**: For each role, builds intelligent queries from event context and searches the web for relevant people
4. **Navigation**: Uses Selenium (or requests fallback) to fetch and render pages as needed
5. **Extraction**: Uses LLM to extract structured data (name, title, company, email, LinkedIn, etc.) from HTML
6. **Aggregation & Deduplication**: Merges results from multiple sources and removes duplicates
7. **Document Generation**: Creates comprehensive review documents for manual verification

## Troubleshooting

### "No module named 'scraper_module'"
- Make sure you're running from the project root, not from inside `scraper_module/`

### "Could not find event website"
- Install `ddgs`: `pip install ddgs`
- Or provide the `url` field in your request

### "Browser navigation failed"
- Ensure Chromium/Chrome is installed
- Check that `chromedriver` is accessible (webdriver-manager should handle this)

### "No compatible LLM class found"
- Install: `pip install langchain-ollama` or `pip install langchain-community`
- Ensure Ollama is running: `ollama serve`
- Pull the model: `ollama pull llama3:8b`

## Next Steps

After reviewing the generated Markdown document, you can:
1. Approve contacts for outreach
2. Use the `/outreach/send/` endpoint (to be implemented) to send emails
3. Handle acknowledgments via email agent (to be implemented)

