# Sample Data for Report Generator

This folder contains sample files for testing the Report Generator.

## Files

### attendees.csv (Required)
Sample participant data with columns:
- `name` - Participant's full name
- `email` - Participant's email address
- `ticket_type` - Registration category (Student, Faculty, Professional)
- `institution` - Organization/institution name
- `registration_date` - Date of registration

### feedback.csv (Required)
Sample feedback data with columns:
- `participant_email` - Email of the participant
- `session_name` - Name of the session
- `session_rating` - Rating out of 5
- `qualitative_comment` - Written feedback comment

### crowd_analytics.json (Optional)
Real-time crowd analytics data (not included in sample).

### social_mentions.json (Optional)
Social media mentions data (not included in sample).

## Usage

1. Upload `attendees.csv` and `feedback.csv` when generating reports
2. Optionally upload crowd analytics and social media data
3. Fill in event details and generate the report

## Custom Overleaf Template

You can upload a custom Overleaf/LaTeX template (.tex) to customize the PDF report format.
