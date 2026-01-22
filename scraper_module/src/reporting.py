"""Generate targeted reports from scraper results."""

from typing import Dict, List, Any
import os
from datetime import datetime


def generate_targeted_report(results: Dict[str, Any], output_path: str):
    """Generate comprehensive targeted report."""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        # Header
        f.write(f"# Targeted Discovery Report\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Event Analysis
        analysis = results.get('event_analysis', {})
        f.write("## Event Analysis\n")
        f.write(f"- **Type**: {analysis.get('event_type', 'N/A')}\n")
        f.write(f"- **Domain**: {analysis.get('primary_domain', 'N/A')}\n")
        f.write(f"- **Estimated Size**: {analysis.get('estimated_size', 'N/A')}\n\n")
        
        # Summary Statistics
        candidates = results.get('candidates', {})
        total_candidates = sum(len(v) for v in candidates.values() if isinstance(v, list))
        
        f.write("## Summary\n")
        f.write(f"- **Total Candidates Found**: {total_candidates}\n")
        for role, people in candidates.items():
            f.write(f"- **{role.capitalize()}**: {len(people) if isinstance(people, list) else 0}\n")
        f.write("\n")
        
        # High Priority Candidates
        high_priority = results.get('recommendations', {}).get('high_priority', [])
        if high_priority:
            f.write("## 🎯 High Priority Candidates\n")
            f.write("These candidates have LinkedIn profiles and should be contacted first:\n\n")
            
            for i, candidate in enumerate(high_priority, 1):
                f.write(f"### {i}. {candidate.get('name', 'Unknown')}\n")
                f.write(f"- **Role**: {candidate.get('title', 'N/A')}\n")
                f.write(f"- **Source**: {candidate.get('source', 'N/A')}\n")
                f.write(f"- **LinkedIn**: {candidate.get('linkedin_url', 'N/A')}\n")
                f.write(f"- **Email**: {candidate.get('email', 'N/A')}\n")
                f.write(f"- **Relevance Score**: {candidate.get('relevance_score', 'N/A')}\n\n")
        
        # Role-wise Breakdown
        f.write("## Role-wise Candidates\n")
        
        for role, people in candidates.items():
            if isinstance(people, list) and people:
                f.write(f"### {role.capitalize()}\n")
                
                for i, person in enumerate(people[:5], 1):  # Top 5 per role
                    f.write(f"{i}. **{person.get('name', 'Unknown')}**  \n")
                    f.write(f"   - Company: {person.get('company', 'N/A')}  \n")
                    f.write(f"   - Source: {person.get('source', 'N/A')}  \n")
                    if person.get('linkedin_url'):
                        f.write(f"   - LinkedIn: {person.get('linkedin_url')}  \n")
                    f.write("\n")
                
                if len(people) > 5:
                    f.write(f"... and {len(people) - 5} more candidates\n")
                f.write("\n")
        
        # Recommendations
        recs = results.get('recommendations', {})
        if recs.get('outreach_strategy'):
            f.write("## Outreach Strategy\n")
            for role, timing in recs['outreach_strategy'].items():
                f.write(f"- **{role.capitalize()}**: {timing}\n")
            f.write("\n")
        
        if recs.get('next_steps'):
            f.write("## Next Steps\n")
            for step in recs['next_steps']:
                f.write(f"- {step}\n")
            f.write("\n")
        
        # Data Sources Used
        f.write("## Data Sources Used\n")
        sources = set()
        for role_people in candidates.values():
            if isinstance(role_people, list):
                for person in role_people:
                    sources.add(person.get('source', 'unknown'))
        
        for source in sources:
            f.write(f"- {source}\n")
        
        print(f"📊 Report generated at: {output_path}")