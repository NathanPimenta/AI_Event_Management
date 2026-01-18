# Troubleshooting Guide

## Issues Found and Fixed

### 1. ✅ Ollama Model Not Found
**Problem**: `llama3:8b` model wasn't available, causing classification to fall back to keyword matching.

**Solution**: 
```bash
# Pull the required Ollama model
ollama pull llama3:8b

# Verify it's available
ollama list
```

### 2. ✅ Search Queries Too Verbose
**Problem**: Queries were too long (e.g., "top Game development event the event is where students form groups...") which don't work well with search engines.

**Fixed**: 
- Queries are now shorter and more focused (max ~80 chars)
- Extracts key domain keywords from description (e.g., "game development", "unity", "godot")
- Limits to 3 queries per role
- Better query construction logic

### 3. ✅ Event Classification Improved
**Problem**: "Teknack" wasn't being classified as a hackathon/competition despite game development description.

**Fixed**:
- Fallback classification now checks description field
- Detects game development keywords (unity, godot, unreal, blender)
- Better keyword matching for hackathons/competitions

### 4. ✅ Better Extraction Debugging
**Problem**: No visibility into why extraction was failing.

**Fixed**:
- Added detailed logging for each step
- Shows page content length
- Better error messages with tracebacks
- Warns when pages don't contain structured people data

## Testing the Fixes

After pulling the Ollama model, try running again:

```bash
curl -X POST "http://localhost:8002/scrape/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teknack",
    "type": "hackathon",
    "description": "Game development event where students form groups and learn to develop games using Unity, Godot, Unreal, Blender",
    "location": "Mumbai"
  }'
```

Expected improvements:
- ✅ Event should be classified as "hackathon" (not "other")
- ✅ Should search for "judges", "mentors", "sponsors" (not just "speakers", "sponsors")
- ✅ Queries should be shorter and more focused
- ✅ Better logging to see what's happening at each step

## Why You Might Still Get 0 Results

Even with these fixes, you might get 0 candidates if:

1. **Search results don't contain structured people data**
   - Many web pages don't have structured speaker/judge listings
   - The LLM extractor needs HTML with clear person profiles

2. **Pages require authentication or have anti-scraping**
   - Some sites block automated browsers
   - LinkedIn profiles often require login

3. **Pages are JavaScript-heavy and need more time**
   - Currently waits 3 seconds, might need more for complex pages

## Next Steps to Improve Results

1. **Use LinkedIn-specific searches** (if you have LinkedIn API access):
   - "game development professionals Mumbai LinkedIn"
   - "Unity developers India LinkedIn"

2. **Search for past event pages**:
   - "Teknack 2024 speakers"
   - "Teknack past judges"

3. **Consider adding manual seed URLs**:
   - If you know specific pages with speaker/judge lists, add them to the search results

4. **Improve extraction prompts**:
   - The LLM extractor might need more specific prompts for certain page types
   - Consider adding page-type detection

## Debugging Tips

Check the terminal output for:
- `🔎 Queries for {role}: [...]` - Are queries reasonable?
- `🌐 Visiting URL for {role}: ...` - Are URLs being visited?
- `📄 Page loaded ({len} chars), extracting...` - Is content being loaded?
- `⚠️ No {role} data extracted` - Extraction is running but finding nothing
- `✅ Extracted {n} {role} candidates` - Success!

## Common Issues

### "model 'llama3:8b' not found"
```bash
ollama pull llama3:8b
```

### "No compatible LLM class found"
```bash
pip install langchain-ollama
# or
pip install langchain-community
```

### "Browser navigation failed"
- Ensure Chromium/Chrome is installed
- Check webdriver-manager can download chromedriver

### Search returns no URLs
- Check DuckDuckGo search is working: `pip install ddgs`
- Try simpler queries manually to verify search works

