import os
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

import data_ingestor as data_ingestor
import quantitative_analyzer as qa
import llm_analyzer as llm_analyzer

@dataclass
class EventReportConfig:
    """Configuration for event report generation."""
    event_name: str = "TechFest 2025"
    event_type: str = "Tech Workshop & Hackathon"
    institution_name: str = "College of Engineering"
    ollama_model: str = "llama3:8b"
    output_dir: Path = Path("report_generator/output")
    report_filename: str = "event_report.md"
    ratings_chart: str = "session_ratings.png"
    demographics_chart: str = "participant_demographics.png"
    generate_ai_recommendations: bool = True
    
    @property
    def report_path(self) -> Path:
        """
        Returns a unique report path, adding a serial number if file exists.
        """
        base = self.output_dir / self.report_filename
        if not base.exists():
            return base
        stem = base.stem
        suffix = base.suffix
        i = 1
        while True:
            candidate = self.output_dir / f"{stem}_{i}{suffix}"
            if not candidate.exists():
                return candidate
            i += 1
    
    @property
    def ratings_chart_path(self) -> Path:
        return self.output_dir / self.ratings_chart
    
    @property
    def demographics_chart_path(self) -> Path:
        return self.output_dir / self.demographics_chart


class EventReportGenerator:
    """
    AI-Powered Post-Event Report Generator for College Events.
    
    This system automatically generates comprehensive post-event reports
    combining quantitative analytics with AI-powered qualitative insights
    for college tech events, workshops, hackathons, and conferences.
    """
    
    def __init__(self, config: Optional[EventReportConfig] = None):
        """
        Initialize the Event Report Generator.
        
        Args:
            config: Optional report configuration settings
        """
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
            print("\n❌ Failed to load event data. Cannot generate report.")
            return None
        
        return data
    
    def _perform_quantitative_analysis(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform statistical analysis on event data."""
        print("\n" + "="*70)
        print("📊 STEP 2: QUANTITATIVE ANALYSIS")
        print("="*70)
        
        analyzer = qa.EventAnalytics()
        
        # Calculate statistics
        stats = analyzer.get_event_summary(
            data['participants'], 
            data['feedback'], 
            data.get('attendance', [])
        )
        
        # Generate visualizations
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
        
        # Analyze participant feedback
        comments = data['feedback']['qualitative_comment'].dropna().tolist()
        valid_comments = [c.strip() for c in comments if c and c.strip()]
        
        if valid_comments:
            print(f"\n💬 Analyzing {len(valid_comments)} participant feedback comments...")
            results['positive_themes'], results['improvement_areas'] = \
                analyzer.analyze_event_feedback(valid_comments)
        else:
            print("\n⚠️  No feedback comments available")
            results['positive_themes'] = "No feedback comments provided by participants."
            results['improvement_areas'] = "No feedback comments provided by participants."
        
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
        """Generate the final markdown report."""
        print("\n" + "="*70)
        print("📝 STEP 5: GENERATING REPORT")
        print("="*70)
        
        timestamp = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        
        with open(self.config.report_path, 'w', encoding='utf-8') as f:
            # Header
            f.write(f"# 📊 Post-Event Analysis Report\n\n")
            f.write(f"## {self.config.event_name}\n")
            f.write(f"**{self.config.event_type}**  \n")
            f.write(f"*{self.config.institution_name}*\n\n")
            f.write(f"---\n\n")
            f.write(f"*Report Generated: {timestamp}*  \n")
            f.write(f"*Generated by: AI Event Management System*\n\n")
            f.write("---\n\n")
            
            # Executive Summary
            f.write("## 📋 Executive Summary\n\n")
            
            student_pct = stats.get('student_percentage', 0)
            f.write(
                f"The **{self.config.event_name}** successfully concluded with "
                f"**{stats['total_participants']} participants** from "
                f"**{stats['institutions']} institutions**. "
            )
            
            if stats.get('student_count'):
                f.write(
                    f"The event saw strong student engagement with **{stats['student_count']} students** "
                    f"({student_pct:.1f}% of total participants). "
                )
            
            f.write(
                f"Participant feedback was {'highly ' if stats['avg_rating'] >= 4.5 else ''}"
                f"{'positive' if stats['avg_rating'] >= 4.0 else 'mixed'}, "
                f"with an average session rating of **{stats['avg_rating']:.2f} out of 5**.\n\n"
            )
            
            f.write(
                "This report combines quantitative metrics with AI-powered qualitative insights "
                "to provide actionable recommendations for future events.\n\n"
            )
            
            # Participant Demographics
            f.write("---\n\n")
            f.write("## 👥 Participant Demographics\n\n")
            
            f.write("### Key Statistics\n\n")
            f.write(f"- **Total Participants:** {stats['total_participants']}\n")
            
            if stats.get('student_count'):
                f.write(f"- **Students:** {stats['student_count']} ({stats.get('student_percentage', 0):.1f}%)\n")
            if stats.get('academic_count'):
                f.write(f"- **Academic Participants:** {stats['academic_count']}\n")
            if stats.get('industry_count'):
                f.write(f"- **Industry Professionals:** {stats['industry_count']}\n")
            
            f.write(f"- **Institutions Represented:** {stats['institutions']}\n\n")
            
            # Top participating institutions
            if stats.get('top_5_institutions'):
                f.write("### Top Participating Institutions\n\n")
                for i, (institution, count) in enumerate(list(stats['top_5_institutions'].items())[:5], 1):
                    f.write(f"{i}. **{institution}**: {count} participants\n")
                f.write("\n")
            
            # Participant category distribution
            if stats.get('ticket_type_dist'):
                f.write("### Participant Categories\n\n")
                for category, count in stats['ticket_type_dist'].items():
                    percentage = (count / stats['total_participants']) * 100
                    f.write(f"- **{category}**: {count} ({percentage:.1f}%)\n")
                f.write("\n")
            
            # Registration insights
            if stats.get('registration_period_days'):
                f.write("### Registration Insights\n\n")
                f.write(f"- **Registration Period:** {stats['registration_period_days']} days\n")
                f.write(f"- **First Registration:** {stats.get('first_registration', 'N/A')}\n")
                f.write(f"- **Last Registration:** {stats.get('last_registration', 'N/A')}\n")
                
                if stats.get('peak_registration_day'):
                    f.write(
                        f"- **Peak Registration Day:** {stats['peak_registration_day']['date']} "
                        f"({stats['peak_registration_day']['count']} registrations)\n"
                    )
                f.write("\n")
            
            # Demographics visualization
            f.write("### Demographics Visualization\n\n")
            f.write(f"![Participant Demographics]({self.config.demographics_chart})\n\n")
            
            # Session Performance
            f.write("---\n\n")
            f.write("## 🎯 Session Performance & Feedback\n\n")
            
            f.write("### Overall Feedback Metrics\n\n")
            f.write(f"- **Total Feedback Responses:** {stats['total_feedback']}\n")
            f.write(f"- **Average Session Rating:** {stats['avg_rating']:.2f}/5 ⭐\n")
            f.write(f"- **Median Rating:** {stats.get('median_rating', 'N/A')}/5\n\n")
            
            # Rating distribution
            if stats.get('excellent_ratings') is not None:
                f.write("### Rating Distribution\n\n")
                f.write(f"- **Excellent (≥4.5):** {stats['excellent_ratings']} responses\n")
                f.write(f"- **Good (4.0-4.5):** {stats['good_ratings']} responses\n")
                f.write(f"- **Average (3.5-4.0):** {stats['average_ratings']} responses\n")
                f.write(f"- **Needs Improvement (<3.5):** {stats['poor_ratings']} responses\n\n")
            
            # Top and bottom sessions
            if stats.get('top_session'):
                f.write("### Session Highlights\n\n")
                f.write(
                    f"🏆 **Top Rated Session:** {stats['top_session']['name']} "
                    f"({stats['top_session']['rating']:.2f}/5)\n\n"
                )
                
                if stats.get('bottom_session') and stats['bottom_session']['rating'] < 4.0:
                    f.write(
                        f"⚠️ **Needs Attention:** {stats['bottom_session']['name']} "
                        f"({stats['bottom_session']['rating']:.2f}/5)\n\n"
                    )
            
            # Session ratings chart
            f.write("### Session-wise Ratings\n\n")
            f.write(f"![Session Ratings]({self.config.ratings_chart})\n\n")
            f.write("*Chart shows average ratings with response counts (n=responses)*\n\n")
            
            # Attendance analytics (if available)
            if stats.get('most_attended_session'):
                f.write("### Attendance Analytics\n\n")
                session = stats['most_attended_session']
                f.write(
                    f"- **Most Attended Session:** {session.get('session_name', 'N/A')} "
                    f"({session.get('peak_attendance', 'N/A')} peak attendance)\n"
                )
                
                if stats.get('highest_engagement_session'):
                    eng_session = stats['highest_engagement_session']
                    f.write(
                        f"- **Highest Engagement:** {eng_session.get('session_name', 'N/A')} "
                        f"({eng_session.get('avg_dwell_time_min', 'N/A')} min average)\n"
                    )
                f.write("\n")
            
            # Qualitative Feedback Analysis
            f.write("---\n\n")
            f.write("## 💬 Participant Feedback Analysis\n\n")
            f.write("*The following insights were generated using AI-powered analysis of participant feedback.*\n\n")
            
            f.write("### ✅ What Participants Loved\n\n")
            f.write(f"{analysis['positive_themes']}\n\n")
            
            f.write("### 📈 Areas for Improvement\n\n")
            f.write(f"{analysis['improvement_areas']}\n\n")
            
            # Social Media Sentiment
            f.write("---\n\n")
            f.write("## 📱 Social Media Sentiment\n\n")
            f.write(f"{analysis['social_sentiment']}\n\n")
            
            # AI Recommendations
            f.write("---\n\n")
            f.write("## 💡 Recommendations for Future Events\n\n")
            f.write("*AI-generated actionable recommendations based on event data and feedback:*\n\n")
            f.write(f"{recommendations}\n\n")
            
            # Conclusion
            f.write("---\n\n")
            f.write("## 🎓 Conclusion\n\n")
            
            if stats['avg_rating'] >= 4.5:
                f.write(
                    f"The {self.config.event_name} was a **highly successful event** with excellent "
                    "participant satisfaction and strong engagement. "
                )
            elif stats['avg_rating'] >= 4.0:
                f.write(
                    f"The {self.config.event_name} was a **successful event** with good participant "
                    "satisfaction and positive feedback. "
                )
            else:
                f.write(
                    f"The {self.config.event_name} had **mixed reception** with several areas "
                    "identified for improvement. "
                )
            
            f.write(
                "By implementing the recommendations above and building upon the successful aspects, "
                "future events can deliver even better experiences for participants.\n\n"
            )
            
            # Footer
            f.write("---\n\n")
            f.write("### 📊 Report Methodology\n\n")
            f.write("This report was generated using the **AI Event Management System**, which combines:\n\n")
            f.write("- **Quantitative Analytics:** Statistical analysis of participant data and ratings\n")
            f.write("- **Qualitative Insights:** AI-powered natural language processing of feedback comments\n")
            f.write(f"- **AI Model:** {self.config.ollama_model}\n")
            f.write("- **Visualization:** Automated chart generation for key metrics\n\n")
            f.write("*For questions about this report, contact the event organizing team.*\n")
        
        print(f"\n✅ Report saved to: {self.config.report_path}")
    
    def generate(self) -> bool:
        """
        Generate the complete post-event report.
        
        This method orchestrates the entire report generation process:
        1. Data loading
        2. Quantitative analysis
        3. Qualitative (AI) analysis
        4. Recommendation generation
        5. Report writing
        
        Returns:
            True if successful, False otherwise
        """
        print("\n" + "="*70)
        print("🎓 AI EVENT MANAGEMENT SYSTEM")
        print("📊 POST-EVENT REPORT GENERATOR")
        print("="*70)
        print(f"\nEvent: {self.config.event_name}")
        print(f"Institution: {self.config.institution_name}")
        print(f"Type: {self.config.event_type}\n")
        
        try:
            # Step 1: Load data
            data = self._load_event_data()
            if data is None:
                return False
            
            # Step 2: Quantitative analysis
            stats = self._perform_quantitative_analysis(data)
            
            # Step 3: Qualitative analysis
            analysis = self._perform_qualitative_analysis(data)
            
            # Step 4: Generate recommendations
            recommendations = self._generate_ai_recommendations(stats, analysis)
            
            # Step 5: Write report
            self._write_report(stats, analysis, recommendations)
            
            # Success summary
            print("\n" + "="*70)
            print("✅ REPORT GENERATION COMPLETE!")
            print("="*70)
            print(f"\n📄 Report: {self.config.report_path}")
            print(f"📊 Charts: {self.config.output_dir}")
            print(f"\n💡 View your report with: open {self.config.report_path}")
            print(f"   Or navigate to: {self.config.output_dir}\n")
            
            return True
            
        except KeyboardInterrupt:
            print("\n\n⚠️  Report generation cancelled by user.")
            return False
        except Exception as e:
            print(f"\n❌ ERROR during report generation: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """
    Entry point for the AI Event Management Report Generator.
    
    This function can be customized for different types of college events:
    - Tech Workshops
    - Hackathons
    - Academic Conferences
    - Cultural Fests
    - Guest Lectures
    - Career Fairs
    """
    # Configure your event details
    config = EventReportConfig(
        event_name="TechFest 2025",
        event_type="AI/ML Workshop Series & Hackathon",
        institution_name="Department of Computer Science",
        ollama_model="llama3:8b",
        generate_ai_recommendations=True
    )
    
    # Generate report
    print("\n🚀 Starting AI-powered event report generation...\n")
    generator = EventReportGenerator(config)
    success = generator.generate()
    
    if success:
        print("="*70)
        print("🎉 SUCCESS! Your event report is ready.")
        print("="*70)
        print("\n📌 Next Steps:")
        print("  1. Review the generated report")
        print("  2. Share with event stakeholders")
        print("  3. Use insights for planning future events")
        print("  4. Archive for institutional records\n")
    else:
        print("="*70)
        print("❌ Report generation failed.")
        print("="*70)
        print("\n🔍 Troubleshooting:")
        print("  1. Check that all required data files exist")
        print("  2. Verify Ollama is running: ollama serve")
        print("  3. Ensure required model is installed: ollama pull llama3:8b")
        print("  4. Check file permissions in data directory\n")
    
    # Exit with appropriate code
    exit(0 if success else 1)


if __name__ == "__main__":
    main()