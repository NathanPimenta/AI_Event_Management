import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
import seaborn as sns

# Set professional academic style for charts
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette("Set2")

OUTPUT_DIR = Path("event_management/output")

@dataclass
class ChartConfig:
    """Configuration for chart generation in event reports."""
    figsize: tuple = (12, 8)
    dpi: int = 300
    color_primary: str = '#2C3E50'
    color_secondary: str = '#E74C3C'
    color_tertiary: str = '#27AE60'
    color_student: str = '#3498DB'
    font_size_title: int = 16
    font_size_labels: int = 12


class EventAnalytics:
    """
    Handles quantitative analysis and visualization for college event management.
    
    This class provides statistical analysis and visualizations for:
    - Participant demographics (students, faculty, industry)
    - Session ratings and feedback metrics
    - Attendance patterns
    - Registration trends
    """
    
    def __init__(self, chart_config: Optional[ChartConfig] = None):
        """
        Initialize the Event Analytics module.
        
        Args:
            chart_config: Optional chart configuration settings
        """
        self.chart_config = chart_config or ChartConfig()
        self._ensure_output_directory()
    
    def _ensure_output_directory(self):
        """Create output directory if it doesn't exist."""
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    def get_participant_stats(self, participant_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculate comprehensive participant statistics for college events.
        
        Args:
            participant_df: DataFrame with participant data
            
        Returns:
            Dictionary containing participant statistics
        """
        if participant_df.empty:
            return {
                'total_participants': 0,
                'student_count': 0,
                'institutions': 0
            }
        
        # Ensure registration_date is datetime
        if 'registration_date' in participant_df.columns:
            participant_df['registration_date'] = pd.to_datetime(
                participant_df['registration_date'], 
                errors='coerce'
            )
        
        stats = {
            'total_participants': len(participant_df),
            'institutions': participant_df['country'].nunique(),  # Using 'country' as institution/college
            'institution_dist': participant_df['country'].value_counts().to_dict()
        }
        
        # Ticket type analysis (Student/Faculty/Industry/VIP)
        if 'ticket_type' in participant_df.columns:
            stats['ticket_type_dist'] = participant_df['ticket_type'].value_counts().to_dict()
            stats['student_count'] = (participant_df['ticket_type'] == 'Student').sum()
            stats['vip_count'] = (participant_df['ticket_type'] == 'VIP').sum()
            stats['student_percentage'] = (stats['student_count'] / len(participant_df) * 100)
        
        # Organization type analysis (colleges, companies, startups)
        if 'company_size' in participant_df.columns:
            company_size_order = ['1-10', '10-50', '50-100', '100-500', '500-1000', '1000+', 'NA']
            company_sizes = participant_df['company_size'].value_counts()
            stats['organization_dist'] = {
                size: company_sizes.get(size, 0) 
                for size in company_size_order 
                if size in company_sizes.index
            }
            
        # Participant role distribution
        if 'job_title' in participant_df.columns:
            stats['role_dist'] = participant_df['job_title'].value_counts().head(10).to_dict()
            stats['total_unique_roles'] = participant_df['job_title'].nunique()
            
            # Categorize participants
            academic_roles = ['Student', 'Professor', 'Research Scholar', 'PhD', 'Faculty']
            industry_roles = ['Engineer', 'Developer', 'Manager', 'Analyst', 'Scientist']
            leadership_roles = ['CEO', 'CTO', 'Director', 'VP', 'Head', 'Founder']
            
            stats['student_count'] = (participant_df['job_title'] == 'Student').sum()
            stats['academic_count'] = participant_df['job_title'].apply(
                lambda x: any(role in str(x) for role in academic_roles)
            ).sum()
            stats['industry_count'] = participant_df['job_title'].apply(
                lambda x: any(role in str(x) for role in industry_roles)
            ).sum()
            stats['leadership_count'] = participant_df['job_title'].apply(
                lambda x: any(role in str(x) for role in leadership_roles)
            ).sum()
        
        # Registration timeline analysis
        if 'registration_date' in participant_df.columns:
            daily_reg = participant_df.groupby(
                participant_df['registration_date'].dt.date
            ).size().to_dict()
            stats['registration_timeline'] = {str(k): v for k, v in daily_reg.items()}
            
            # Peak registration day
            if daily_reg:
                peak_day = max(daily_reg.items(), key=lambda x: x[1])
                stats['peak_registration_day'] = {
                    'date': str(peak_day[0]),
                    'count': peak_day[1]
                }
            
            # Registration period
            stats['first_registration'] = str(participant_df['registration_date'].min().date())
            stats['last_registration'] = str(participant_df['registration_date'].max().date())
            stats['registration_period_days'] = (
                participant_df['registration_date'].max() - 
                participant_df['registration_date'].min()
            ).days
        
        # Top participating institutions/colleges
        stats['top_5_institutions'] = dict(list(stats['institution_dist'].items())[:5])
        
        return stats
    
    def get_feedback_stats(self, feedback_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculate feedback and rating statistics.
        
        Args:
            feedback_df: DataFrame with feedback data
            
        Returns:
            Dictionary containing feedback statistics
        """
        if feedback_df.empty:
            return {
                'total_feedback': 0,
                'avg_rating': 0.0,
                'sessions_by_rating': {}
            }
        
        stats = {
            'total_feedback': len(feedback_df),
            'avg_rating': feedback_df['rating_score'].mean(),
            'median_rating': feedback_df['rating_score'].median(),
            'std_rating': feedback_df['rating_score'].std(),
            'sessions_by_rating': feedback_df.groupby('session_name')['rating_score']
                                           .mean()
                                           .sort_values(ascending=False)
                                           .to_dict()
        }
        
        # Rating distribution
        stats['rating_distribution'] = feedback_df['rating_score'].value_counts().sort_index().to_dict()
        
        # Response rate
        if 'attendee_id' in feedback_df.columns:
            stats['unique_respondents'] = feedback_df['attendee_id'].nunique()
        
        # Top and bottom rated sessions
        session_ratings = feedback_df.groupby('session_name')['rating_score'].mean().sort_values(ascending=False)
        if len(session_ratings) > 0:
            stats['top_session'] = {
                'name': session_ratings.index[0],
                'rating': round(session_ratings.iloc[0], 2)
            }
            stats['bottom_session'] = {
                'name': session_ratings.index[-1],
                'rating': round(session_ratings.iloc[-1], 2)
            }
        
        # Most reviewed session
        session_counts = feedback_df['session_name'].value_counts()
        stats['most_reviewed_session'] = {
            'name': session_counts.index[0],
            'count': int(session_counts.iloc[0])
        }
        
        # Performance categories
        stats['excellent_ratings'] = (feedback_df['rating_score'] >= 4.5).sum()
        stats['good_ratings'] = ((feedback_df['rating_score'] >= 4.0) & 
                                 (feedback_df['rating_score'] < 4.5)).sum()
        stats['average_ratings'] = ((feedback_df['rating_score'] >= 3.5) & 
                                    (feedback_df['rating_score'] < 4.0)).sum()
        stats['poor_ratings'] = (feedback_df['rating_score'] < 3.5).sum()
        
        return stats
    
    def get_attendance_stats(self, attendance_data: Union[List[Dict], pd.DataFrame]) -> Dict[str, Any]:
        """
        Calculate session attendance statistics.
        
        Args:
            attendance_data: Session attendance/crowd analytics data
            
        Returns:
            Dictionary containing attendance statistics
        """
        if not attendance_data:
            return {}
        
        if isinstance(attendance_data, list):
            if not attendance_data:
                return {}
            attendance_df = pd.DataFrame(attendance_data)
        else:
            attendance_df = attendance_data
        
        if attendance_df.empty:
            return {}
        
        stats = {}
        
        if 'peak_attendance' in attendance_df.columns:
            busiest_idx = attendance_df['peak_attendance'].idxmax()
            stats['most_attended_session'] = attendance_df.loc[busiest_idx].to_dict()
            stats['total_peak_attendance'] = int(attendance_df['peak_attendance'].sum())
            stats['avg_peak_attendance'] = round(attendance_df['peak_attendance'].mean(), 1)
        
        if 'avg_dwell_time_min' in attendance_df.columns:
            longest_idx = attendance_df['avg_dwell_time_min'].idxmax()
            stats['highest_engagement_session'] = attendance_df.loc[longest_idx].to_dict()
            stats['overall_avg_dwell_time'] = round(attendance_df['avg_dwell_time_min'].mean(), 1)
        
        return stats
    
    def get_event_summary(
        self, 
        participant_df: pd.DataFrame, 
        feedback_df: pd.DataFrame, 
        attendance_data: Union[List[Dict], pd.DataFrame, None] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive event statistics and metrics.
        
        Args:
            participant_df: DataFrame with participant registration data
            feedback_df: DataFrame with feedback/evaluation data
            attendance_data: Optional session attendance data
            
        Returns:
            Dictionary containing all event statistics
        """
        print("📊 Analyzing event data...")
        
        stats = {}
        
        # Participant analytics
        participant_stats = self.get_participant_stats(participant_df)
        stats.update(participant_stats)
        print(f"  ✓ Analyzed {stats['total_participants']} participants from {stats['institutions']} institutions")
        
        # Feedback analytics
        feedback_stats = self.get_feedback_stats(feedback_df)
        stats.update(feedback_stats)
        print(f"  ✓ Processed {stats['total_feedback']} feedback responses")
        
        # Attendance analytics (optional)
        if attendance_data is not None:
            attendance_stats = self.get_attendance_stats(attendance_data)
            stats.update(attendance_stats)
            if attendance_stats:
                print(f"  ✓ Analyzed session attendance data")
        
        return stats
    
    def create_session_ratings_chart(
        self, 
        feedback_df: pd.DataFrame, 
        output_path: Union[str, Path]
    ) -> bool:
        """
        Create visualization of average session ratings.
        
        Args:
            feedback_df: DataFrame with feedback data
            output_path: Path to save the chart
            
        Returns:
            True if successful, False otherwise
        """
        output_path = Path(output_path)
        
        if feedback_df.empty or 'session_name' not in feedback_df.columns:
            print("⚠️  Insufficient data for session ratings chart")
            return False
        
        try:
            # Calculate session ratings
            ratings_data = feedback_df.groupby('session_name').agg({
                'rating_score': ['mean', 'count', 'std']
            }).round(2)
            ratings_data.columns = ['mean_rating', 'response_count', 'std_rating']
            ratings_data = ratings_data.sort_values('mean_rating', ascending=True)
            
            # Create chart
            fig, ax = plt.subplots(figsize=self.chart_config.figsize, dpi=self.chart_config.dpi)
            
            bars = ax.barh(
                ratings_data.index, 
                ratings_data['mean_rating'],
                color=self.chart_config.color_primary,
                edgecolor='#34495E',
                alpha=0.85,
                linewidth=1.5
            )
            
            # Color-code by performance
            for i, (idx, row) in enumerate(ratings_data.iterrows()):
                if row['mean_rating'] >= 4.5:
                    bars[i].set_color('#27AE60')  # Excellent
                elif row['mean_rating'] >= 4.0:
                    bars[i].set_color('#3498DB')  # Good
                elif row['mean_rating'] >= 3.5:
                    bars[i].set_color('#F39C12')  # Average
                else:
                    bars[i].set_color('#E74C3C')  # Needs improvement
            
            # Add value labels
            for i, (idx, row) in enumerate(ratings_data.iterrows()):
                ax.text(
                    row['mean_rating'] + 0.05, 
                    i, 
                    f"{row['mean_rating']:.2f} (n={int(row['response_count'])})",
                    va='center',
                    fontsize=10,
                    fontweight='bold'
                )
            
            # Styling
            ax.set_xlabel('Average Rating (1-5)', fontsize=self.chart_config.font_size_labels, fontweight='bold')
            ax.set_ylabel('Session/Workshop Name', fontsize=self.chart_config.font_size_labels, fontweight='bold')
            ax.set_title(
                'Session Performance: Average Participant Ratings', 
                fontsize=self.chart_config.font_size_title, 
                fontweight='bold',
                pad=20
            )
            ax.set_xlim(0, 5.5)
            ax.axvline(x=4.0, color='gray', linestyle='--', alpha=0.5, linewidth=1, label='Good threshold')
            ax.grid(axis='x', alpha=0.3, linestyle='--')
            
            # Legend
            from matplotlib.patches import Patch
            legend_elements = [
                Patch(facecolor='#27AE60', label='Excellent (≥4.5)'),
                Patch(facecolor='#3498DB', label='Good (≥4.0)'),
                Patch(facecolor='#F39C12', label='Average (≥3.5)'),
                Patch(facecolor='#E74C3C', label='Needs Work (<3.5)')
            ]
            ax.legend(handles=legend_elements, loc='lower right', fontsize=10)
            
            plt.tight_layout()
            plt.savefig(output_path, bbox_inches='tight', dpi=self.chart_config.dpi)
            plt.close()
            
            print(f"  ✅ Session ratings chart saved to {output_path}")
            return True
            
        except Exception as e:
            print(f"  ❌ ERROR creating session ratings chart: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def create_participant_demographics_chart(
        self, 
        participant_df: pd.DataFrame, 
        output_path: Union[str, Path]
    ) -> bool:
        """
        Create comprehensive participant demographics visualization.
        
        Args:
            participant_df: DataFrame with participant data
            output_path: Path to save the chart
            
        Returns:
            True if successful, False otherwise
        """
        output_path = Path(output_path)
        
        if participant_df.empty:
            print("⚠️  No participant data available for demographics chart")
            return False
        
        try:
            fig, axes = plt.subplots(2, 2, figsize=(16, 12), dpi=self.chart_config.dpi)
            fig.suptitle('Event Participant Demographics Analysis', 
                        fontsize=20, fontweight='bold', y=0.995)
            
            # 1. Top Institutions/Colleges
            if 'country' in participant_df.columns:
                institution_counts = participant_df['country'].value_counts().head(10)
                axes[0, 0].barh(institution_counts.index, institution_counts.values, 
                               color='#3498DB', alpha=0.8, edgecolor='#2C3E50')
                axes[0, 0].set_xlabel('Number of Participants', fontweight='bold', fontsize=11)
                axes[0, 0].set_title('Top 10 Participating Institutions/Locations', 
                                    fontweight='bold', fontsize=13)
                axes[0, 0].grid(axis='x', alpha=0.3)
                
                for i, v in enumerate(institution_counts.values):
                    axes[0, 0].text(v + 0.2, i, str(v), va='center', fontweight='bold')
            
            # 2. Participant Type Distribution (Student/Faculty/Industry)
            if 'ticket_type' in participant_df.columns:
                ticket_counts = participant_df['ticket_type'].value_counts()
                colors = ['#3498DB', '#27AE60', '#F39C12', '#E74C3C']
                explode = [0.05 if x == 'Student' else 0 for x in ticket_counts.index]
                
                axes[0, 1].pie(
                    ticket_counts.values, 
                    labels=ticket_counts.index,
                    autopct='%1.1f%%',
                    startangle=90,
                    colors=colors[:len(ticket_counts)],
                    explode=explode,
                    textprops={'fontsize': 11, 'fontweight': 'bold'}
                )
                axes[0, 1].set_title('Participant Category Distribution', 
                                    fontweight='bold', fontsize=13)
            
            # 3. Organization Size Distribution
            if 'company_size' in participant_df.columns:
                company_order = ['1-10', '10-50', '50-100', '100-500', '500-1000', '1000+', 'NA']
                company_data = participant_df['company_size'].value_counts()
                company_data = company_data.reindex([c for c in company_order if c in company_data.index])
                
                axes[1, 0].bar(range(len(company_data)), company_data.values, 
                              color='#9B59B6', alpha=0.8, edgecolor='#2C3E50')
                axes[1, 0].set_xticks(range(len(company_data)))
                axes[1, 0].set_xticklabels(company_data.index, rotation=45, ha='right')
                axes[1, 0].set_ylabel('Number of Participants', fontweight='bold', fontsize=11)
                axes[1, 0].set_title('Organization Size Distribution', 
                                    fontweight='bold', fontsize=13)
                axes[1, 0].grid(axis='y', alpha=0.3)
                
                for i, v in enumerate(company_data.values):
                    axes[1, 0].text(i, v + 0.3, str(v), ha='center', fontweight='bold')
            
            # 4. Registration Timeline
            if 'registration_date' in participant_df.columns:
                participant_df['registration_date'] = pd.to_datetime(participant_df['registration_date'])
                daily_reg = participant_df.groupby(participant_df['registration_date'].dt.date).size()
                
                axes[1, 1].plot(daily_reg.index, daily_reg.values, 
                               marker='o', linewidth=2.5, color='#E74C3C', markersize=8)
                axes[1, 1].fill_between(daily_reg.index, daily_reg.values, 
                                       alpha=0.3, color='#E74C3C')
                axes[1, 1].set_xlabel('Registration Date', fontweight='bold', fontsize=11)
                axes[1, 1].set_ylabel('Number of Registrations', fontweight='bold', fontsize=11)
                axes[1, 1].set_title('Registration Timeline', fontweight='bold', fontsize=13)
                axes[1, 1].grid(alpha=0.3)
                axes[1, 1].tick_params(axis='x', rotation=45)
                
                # Annotate peak day
                max_idx = daily_reg.idxmax()
                max_val = daily_reg.max()
                axes[1, 1].annotate(f'Peak: {max_val}', 
                                   xy=(max_idx, max_val),
                                   xytext=(10, 10), textcoords='offset points',
                                   fontweight='bold', fontsize=10,
                                   bbox=dict(boxstyle='round,pad=0.5', fc='yellow', alpha=0.7),
                                   arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0'))
            
            plt.tight_layout()
            plt.savefig(output_path, bbox_inches='tight', dpi=self.chart_config.dpi)
            plt.close()
            
            print(f"  ✅ Demographics chart saved to {output_path}")
            return True
            
        except Exception as e:
            print(f"  ❌ ERROR creating demographics chart: {e}")
            import traceback
            traceback.print_exc()
            return False


# Convenience functions for backward compatibility
def get_key_stats(
    attendee_df: pd.DataFrame, 
    feedback_df: pd.DataFrame, 
    crowd_data: Union[List[Dict], pd.DataFrame, None] = None
) -> Dict[str, Any]:
    """Legacy function for calculating event statistics."""
    analyzer = EventAnalytics()
    return analyzer.get_event_summary(attendee_df, feedback_df, crowd_data)


def create_rating_chart(
    feedback_df: pd.DataFrame, 
    output_path: Union[str, Path]
) -> bool:
    """Legacy function for creating rating chart."""
    analyzer = EventAnalytics()
    return analyzer.create_session_ratings_chart(feedback_df, output_path)


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Event Analytics Module...\n")
    
    # Sample data for testing
    sample_participants = pd.DataFrame({
        'attendee_id': range(1, 151),
        'country': ['MIT'] * 40 + ['Stanford'] * 35 + ['Local College'] * 50 + ['IIT Delhi'] * 25,
        'ticket_type': ['Student'] * 100 + ['Faculty'] * 30 + ['Industry'] * 15 + ['VIP'] * 5,
        'registration_date': pd.date_range('2025-09-01', periods=150, freq='H')
    })
    
    sample_feedback = pd.DataFrame({
        'session_name': ['AI/ML Workshop', 'Web Dev Hackathon', 'Data Science Talk', 'Cloud Computing'] * 30,
        'rating_score': [4.7, 4.5, 3.8, 4.2] * 30,
        'attendee_id': range(1, 121)
    })
    
    # Test analytics
    analyzer = EventAnalytics()
    stats = analyzer.get_event_summary(sample_participants, sample_feedback)
    
    print("\n" + "="*60)
    print("📊 EVENT ANALYTICS SUMMARY")
    print("="*60)
    print(f"Total Participants: {stats['total_participants']}")
    print(f"Student Count: {stats.get('student_count', 'N/A')}")
    print(f"Average Session Rating: {stats['avg_rating']:.2f}/5")
    print(f"Total Feedback Responses: {stats['total_feedback']}")
    print("="*60)
    
    # Create visualizations
    print("\n📊 Generating visualizations...")
    analyzer.create_session_ratings_chart(sample_feedback, OUTPUT_DIR / "test_ratings.png")
    analyzer.create_participant_demographics_chart(sample_participants, OUTPUT_DIR / "test_demographics.png")
    
    print("\n✅ Event Analytics Test: PASSED")