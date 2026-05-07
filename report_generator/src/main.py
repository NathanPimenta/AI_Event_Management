import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

# Ensure sibling modules in src/ are importable regardless of how the app is launched
sys.path.insert(0, str(Path(__file__).parent))

import data_ingestor
import quantitative_analyzer as qa
import llm_analyzer

@dataclass
class EventReportConfig:
    """Configuration for event report generation."""
    event_name: str = ""
    event_type: str = ""
    department_name: str = ""
    event_title: str = ""
    event_date: str = ""
    event_time: str = ""
    event_venue: str = ""
    target_audience: str = ""
    dbit_students_count: str = ""
    non_dbit_students_count: str = ""
    resource_person_name: str = ""
    resource_person_org: str = ""
    organizing_body: str = ""
    faculty_coordinator: str = ""
    objective_1: str = ""
    objective_2: str = ""
    objective_3: str = ""
    outcome_1: str = ""
    outcome_2: str = ""
    outcome_3: str = ""
    detailed_description: str = ""
    snapshot_description: str = ""
    facebook_link: str = ""
    instagram_link: str = ""
    linkedin_link: str = ""
    approver_1_name: str = ""
    approver_1_post: str = ""
    approver_2_name: str = ""
    approver_2_post: str = ""
    preparer_1_name: str = ""
    preparer_1_post: str = ""
    preparer_2_name: str = ""
    preparer_2_post: str = ""

    college_logo_path: str = ""
    club_logo_path: str = ""
    poster_image_path: str = ""
    feedback_image_path: str = ""
    snapshot_image_path: str = ""
    event_photos: list = field(default_factory=list)

    ollama_model: str = "llama3:8b"
    generate_ai_recommendations: bool = True
    output_dir: Path = Path(__file__).parent.parent / "output"
    report_filename: str = "event_report.txt"
    ratings_chart: str = "session_ratings.png"
    demographics_chart: str = "participant_demographics.png"

    @property
    def report_path(self) -> Path:
        """Returns the full path for the report file."""
        return self.output_dir / self.report_filename

    @property
    def ratings_chart_path(self) -> Path:
        """Returns the full path for the ratings chart image."""
        return self.output_dir / self.ratings_chart

    @property
    def demographics_chart_path(self) -> Path:
        """Returns the full path for the demographics chart image."""
        return self.output_dir / self.demographics_chart


class EventReportGenerator:
    """
    AI-Powered Post-Event Report Generator for College Events.
    """

    def __init__(self, config: Optional[EventReportConfig] = None):
        self.config = config or EventReportConfig()
        self._ensure_output_directory()

    def _ensure_output_directory(self):
        """Create output directory for reports and visualizations."""
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        print(f"📁 Output directory: {self.config.output_dir}")

    def _load_event_data(self) -> Optional[Dict[str, Any]]:
        """Load all event data sources."""
        print("\n" + "="*70)
        print("📥 STEP 1: LOADING EVENT DATA")
        print("="*70)

        data = data_ingestor.load_data()

        if data is None:
            print("\n Failed to load event data. Cannot generate report.")
            return None

        return data

    def _perform_quantitative_analysis(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform statistical analysis on event data."""
        print("\n" + "="*70)
        print("📊 STEP 2: QUANTITATIVE ANALYSIS")
        print("="*70)

        analyzer = qa.EventAnalytics()

        stats = analyzer.get_event_summary(
            data['participants'],
            data['feedback'],
            data.get('attendance', [])
        )

        print("\n📊 Generating visualizations...")
        analyzer.create_session_ratings_chart(
            data['feedback'],
            str(self.config.ratings_chart_path)
        )
        analyzer.create_participant_demographics_chart(
            data['participants'],
            str(self.config.demographics_chart_path)
        )

        print(f"\n✅ Quantitative analysis complete!")
        return stats

    def _perform_qualitative_analysis(self, data: Dict[str, Any]) -> Dict[str, str]:
        """Perform AI-powered qualitative analysis."""
        print("\n" + "="*70)
        print("🤖 STEP 3: AI-POWERED QUALITATIVE ANALYSIS")
        print("="*70)

        config = llm_analyzer.LLMConfig(model_name=self.config.ollama_model)
        analyzer = llm_analyzer.EventFeedbackAnalyzer(config)

        results = {}

        comments = data['feedback']['qualitative_comment'].dropna().tolist()
        valid_comments = [c.strip() for c in comments if c and c.strip()]

        event_details = {'name': self.config.event_name, 'type': self.config.event_type}

        if valid_comments:
            print(f"\n💬 Analyzing {len(valid_comments)} participant feedback comments...")
            results['positive_themes'], results['improvement_areas'] = \
                analyzer.analyze_event_feedback(valid_comments, event_details)
            results['feedback_summary_text'] = analyzer.generate_feedback_summary_text(valid_comments, self.config.event_name)
        else:
            print("\n⚠️  No feedback comments available")
            results['positive_themes'] = "No feedback comments provided by participants."
            results['improvement_areas'] = "No feedback comments provided by participants."
            results['feedback_summary_text'] = "No feedback comments provided by participants."

        # Analyze social media sentiment
        if data.get('social'):
            print(f"\n📱 Analyzing {len(data['social'])} social media posts...")
            results['social_sentiment'] = analyzer.analyze_social_sentiment(data['social'])
        else:
            results['social_sentiment'] = "No social media data collected for this event."

        print(f"\n✅ Qualitative analysis complete!")
        return results

    def _generate_ai_recommendations(
        self,
        stats: Dict[str, Any],
        analysis: Dict[str, str]
    ) -> str:
        """Generate AI-powered recommendations for future events."""
        if not self.config.generate_ai_recommendations:
            return self._get_default_recommendations()

        print("\n" + "="*70)
        print("💡 STEP 4: GENERATING AI RECOMMENDATIONS")
        print("="*70)

        config = llm_analyzer.LLMConfig(model_name=self.config.ollama_model)
        analyzer = llm_analyzer.EventFeedbackAnalyzer(config)

        try:
            recommendations = analyzer.generate_recommendations(
                stats,
                analysis['positive_themes'],
                analysis['improvement_areas']
            )
            return recommendations
        except Exception as e:
            print(f"\n⚠️  Could not generate AI recommendations: {e}")
            return self._get_default_recommendations()

    def _get_default_recommendations(self) -> str:
        """Get default recommendations template."""
        return """- Continue successful aspects from this event
- Address identified logistical and technical issues
- Enhance student engagement and participation
- Improve communication and feedback mechanisms
- Consider feedback for next event planning"""

    def _write_report(
        self,
        stats: Dict[str, Any],
        analysis: Dict[str, str],
        recommendations: str
    ):
        """Generate the final report based on the LaTeX and Text templates."""
        from latex_pdf_generator import LatexPdfGenerator
        from text_report_generator import TextReportGenerator
        
        print("\n" + "="*70)
        print("📝 STEP 5: GENERATING REPORTS (PDF & TEXT)")
        print("="*70)

        # Get AI generated detailed report paragraph
        print("🔗 Asking LLM to generate qualitative sections...")
        llm_config = llm_analyzer.LLMConfig(model_name=self.config.ollama_model)
        analyzer_instance = llm_analyzer.EventFeedbackAnalyzer(llm_config)

        detailed_report_paragraph = analyzer_instance.generate_detailed_report(
            self.config.detailed_description, self.config.event_name
        )

        
        # Build comprehensive data dictionary with proper field mapping
        data = {
            # Event metadata
            'event_name': self.config.event_name,
            'event_title': self.config.event_title,
            'title': self.config.event_title,
            'event_type': self.config.event_type,
            'department_name': self.config.department_name,
            'institution_name': self.config.department_name,
            'date': self.config.event_date,
            'time': self.config.event_time,
            'venue': self.config.event_venue,
            'address': 'Mumbai, India',
            
            # Participants
            'target_audience': self.config.target_audience,
            'total_participants': stats.get('total_participants', 0),
            'female_count': stats.get('female_count', 0),
            'girl_participants': stats.get('female_count', 0),
            'male_count': stats.get('male_count', 0),
            'boy_participants': stats.get('male_count', 0),
            'dbit_students': self.config.dbit_students_count or 0,
            'non_dbit_students': self.config.non_dbit_students_count or 0,
            
            # Organizers and signatories
            'resource_person': self.config.resource_person_name,
            'resource_org': self.config.resource_person_org,
            'rp_org': self.config.resource_person_org,
            'organizing_body': self.config.organizing_body,
            'department': self.config.organizing_body or self.config.department_name,
            'coordinator': self.config.faculty_coordinator,
            'faculty_coordinator': self.config.faculty_coordinator,
            
            # Content
            'objectives': [o for o in [self.config.objective_1, self.config.objective_2, self.config.objective_3] if o],
            'outcomes': [o for o in [self.config.outcome_1, self.config.outcome_2, self.config.outcome_3] if o],
            'detailed_report': detailed_report_paragraph,
            'snapshot_description': self.config.snapshot_description,
            'feedback_summary_text': analysis.get('feedback_summary_text', ''),
            'feedback_text': analysis.get('feedback_summary_text', ''),
            
            # Social media
            'facebook_link': self.config.facebook_link or '',
            'instagram_link': self.config.instagram_link or '',
            'linkedin_link': self.config.linkedin_link or '',
            
            # Signatories
            'approver_1_name': self.config.approver_1_name,
            'approver_1_post': self.config.approver_1_post,
            'preparer_1_name': self.config.preparer_1_name,
            'preparer_1_post': self.config.preparer_1_post,
            
            # Student list
            'student_list_table': stats.get('student_list_table', []),
            'registration': {'students': stats.get('student_list_table', [])}
        }

        # Properly map image paths with multiple key options
        data.update({
            'college_logo': self.config.college_logo_path or '',
            'club_logo': self.config.club_logo_path or '',
            'poster_image': self.config.poster_image_path or '',
            'event_photos': [str(self.config.snapshot_image_path)] if self.config.snapshot_image_path else [],
            'feedback_images': [str(self.config.feedback_image_path)] if self.config.feedback_image_path else [],
        })
        
        # Merge social media link dicts
        data['social_media'] = {
            'Facebook': data['facebook_link'],
            'Instagram': data['instagram_link'],
            'LinkedIn': data['linkedin_link']
        }

        text_generator = TextReportGenerator()

        try:
            pdf_path = self.config.report_path.with_suffix('.pdf')
            txt_path = self.config.report_path.with_suffix('.txt')
            
            from reportlab_pdf_generator import generate_report_pdf
            generate_report_pdf(data, str(pdf_path))
            text_generator.generate_report(data, txt_path)
            
            print(f"\n✅ Reports saved to:")
            print(f"   - {pdf_path}")
            print(f"   - {txt_path}")
        except Exception as e:
            print(f"\n❌ Error generating reports: {e}")
            import traceback
            traceback.print_exc()

    def generate(self) -> bool:
        """
        Generate the complete post-event report.
        """
        print("\n" + "="*70)
        print("🎓 AI EVENT MANAGEMENT SYSTEM")
        print("📊 POST-EVENT REPORT GENERATOR")
        print("="*70)
        print(f"\nEvent: {self.config.event_name}")
        print(f"Department: {self.config.department_name}")
        print(f"Type: {self.config.event_type}\n")

        try:
            data = self._load_event_data()
            if data is None:
                return False

            stats = self._perform_quantitative_analysis(data)
            analysis = self._perform_qualitative_analysis(data)
            recommendations = self._generate_ai_recommendations(stats, analysis)
            self._write_report(stats, analysis, recommendations)

            print("\n" + "="*70)
            print("✅ REPORT GENERATION COMPLETE!")
            print("="*70)
            print(f"\n📄 Report: {self.config.report_path}")
            print(f"📊 Charts: {self.config.output_dir}")

            return True

        except KeyboardInterrupt:
            print("\n\n⚠️  Report generation cancelled by user.")
            return False
        except Exception as e:
            print(f"\n ERROR during report generation: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Entry point for local CLI usage"""
    config = EventReportConfig(
        event_name="TechFest 2025",
        event_type="AI/ML Workshop Series & Hackathon",
        department_name="Department of Computer Science",
        ollama_model="llama3:8b",
        generate_ai_recommendations=True
    )

    print("\n🚀 Starting AI-powered event report generation...\n")
    generator = EventReportGenerator(config)
    generator.generate()


if __name__ == "__main__":
    main()